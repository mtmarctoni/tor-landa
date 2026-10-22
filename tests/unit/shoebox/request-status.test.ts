import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DELETE as statusDelete,
  GET as statusGet,
  HEAD as statusHead,
  OPTIONS as statusOptions,
  POST as statusPost,
} from "@/app/api/shoebox/requests/[requestId]/route";
import { ShoeboxError } from "@/features/shoebox/server/errors";
import { createMemoryHandlers } from "@/features/shoebox/server/memory-handlers";
import { createMemoryService } from "@/features/shoebox/server/memory-service";
import { createNotionGateway } from "@/features/shoebox/server/notion-gateway";
import type { RequestStatus } from "@/types/shoebox";
import {
  buildPage,
  createMockNotion,
  DATABASE_ID,
  type MockNotionOptions,
  memoryId,
  notionError,
} from "../../helpers/mock-notion";
import { FAKE_APP_ORIGIN } from "../../helpers/safe-env";

const REQUEST_ID = "7c0ffee0-2222-4a2b-8c3d-000000000001";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

function setup(options: MockNotionOptions = {}, writeMs = 45_000) {
  const mock = createMockNotion(options);
  const gateway = createNotionGateway({
    client: mock.client,
    sleep: async () => undefined,
    random: () => 0,
    deadlines: { readMs: 15_000, writeMs },
  });
  const service = createMemoryService(gateway, { databaseId: DATABASE_ID });
  return { mock, service };
}

const writes = (mock: ReturnType<typeof createMockNotion>) =>
  mock.counters.pagesCreate +
  mock.counters.pagesUpdate +
  mock.counters.fileUploadsCreate +
  mock.counters.fileUploadsSend +
  mock.counters.fileUploadsComplete;

const saved = (n: number, overrides = {}) =>
  buildPage({
    id: memoryId(n),
    kind: "text",
    text: "guardado",
    requestId: REQUEST_ID,
    ...overrides,
  });

describe("service: findRequest", () => {
  it("returns found with the sanitized record for exactly one match", async () => {
    const { mock, service } = setup({ pages: [saved(1)] });
    const status = await service.findRequest(REQUEST_ID);
    expect(status).toEqual({
      state: "found",
      memory: expect.objectContaining({ id: memoryId(1), text: "guardado" }),
    });
    expect(JSON.stringify(status)).not.toMatch(/Request|7c0ffee0|notion/);
    expect(writes(mock)).toBe(0);
  });

  it("returns not_found when nothing matches", async () => {
    const { mock, service } = setup({ pages: [saved(1, { requestId: "x" })] });
    expect(await service.findRequest(REQUEST_ID)).toEqual({
      state: "not_found",
    });
    expect(writes(mock)).toBe(0);
  });

  it("returns ambiguous for several matches or an invalid matching record", async () => {
    const two = setup({ pages: [saved(1), saved(2)] });
    expect(await two.service.findRequest(REQUEST_ID)).toEqual({
      state: "ambiguous",
    });
    const broken = setup({ pages: [saved(3, { kind: "photo", files: [] })] });
    expect(await broken.service.findRequest(REQUEST_ID)).toEqual({
      state: "ambiguous",
    });
    expect(writes(two.mock) + writes(broken.mock)).toBe(0);
  });

  it("uses an exact Request ID filter with a small cap and re-checks the stored text", async () => {
    const { mock, service } = setup({
      pages: [saved(1, { requestId: REQUEST_ID.toUpperCase() })],
    });
    expect(await service.findRequest(REQUEST_ID)).toEqual({
      state: "not_found",
    });
    expect(mock.queries[0].filter).toEqual({
      property: "Request ID",
      rich_text: { equals: REQUEST_ID },
    });
    expect(mock.queries[0].page_size).toBeLessThanOrEqual(5);
  });

  it("retries a transient read but never writes", async () => {
    const { mock, service } = setup({ pages: [saved(1)] });
    mock.failNext("dataSourcesQuery", notionError({ status: 503 }));
    expect((await service.findRequest(REQUEST_ID)).state).toBe("found");
    expect(mock.counters.dataSourcesQuery).toBe(2);
    expect(writes(mock)).toBe(0);
  });

  it("not_found is not proof: an in-flight create can still finish later", async () => {
    const { mock, service } = setup();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = mock.client.pages.create;
    mock.client.pages.create = async (args) => {
      await gate;
      return original(args);
    };
    const pending = service.createMemory({
      requestId: REQUEST_ID,
      kind: "text",
      text: "tarde",
      caption: "",
      memoryDate: "2026-10-21",
    });
    await vi.waitFor(() => expect(mock.counters.dataSourcesQuery).toBe(1));
    expect(await service.findRequest(REQUEST_ID)).toEqual({
      state: "not_found",
    });
    release();
    await pending;
    expect((await service.findRequest(REQUEST_ID)).state).toBe("found");
  });

  it("rejects a non-UUID before any upstream call", async () => {
    const { mock, service } = setup();
    const error = await service.findRequest("not-a-uuid").catch((e) => e);
    expect(error).toBeInstanceOf(ShoeboxError);
    expect((error as ShoeboxError).status).toBe(400);
    expect(mock.total()).toBe(0);
  });
});

function statusRequest(
  id: string,
  headers: Record<string, string> = { "sec-fetch-site": "same-origin" },
  method = "GET",
): Request {
  return new Request(`${FAKE_APP_ORIGIN}/api/shoebox/requests/${id}`, {
    method,
    headers,
  });
}

function handlersFor(options: MockNotionOptions = {}) {
  const { mock, service } = setup(options);
  const factory = vi.fn(() => service);
  const requireSession = vi.fn(async () => ({
    id: "s",
    issuedAt: 1,
    expiresAt: 2,
  }));
  const handlers = createMemoryHandlers({ service: factory, requireSession });
  return { mock, factory, requireSession, handlers };
}

describe("handler: GET /api/shoebox/requests/:requestId", () => {
  it("returns the RequestStatus as private JSON", async () => {
    const { handlers, mock } = handlersFor({ pages: [saved(1)] });
    const response = await handlers.status(
      statusRequest(REQUEST_ID),
      REQUEST_ID,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = (await response.json()) as RequestStatus;
    expect(body.state).toBe("found");
    expect(writes(mock)).toBe(0);
  });

  it("returns not_found and ambiguous as 200 states, never creating", async () => {
    const none = handlersFor();
    expect(
      await (
        await none.handlers.status(statusRequest(REQUEST_ID), REQUEST_ID)
      ).json(),
    ).toEqual({ state: "not_found" });
    const many = handlersFor({ pages: [saved(1), saved(2)] });
    expect(
      await (
        await many.handlers.status(statusRequest(REQUEST_ID), REQUEST_ID)
      ).json(),
    ).toEqual({ state: "ambiguous" });
    expect(writes(none.mock) + writes(many.mock)).toBe(0);
  });

  it("authenticates before any upstream work and rejects cross-site reads", async () => {
    const { handlers, mock, factory, requireSession } = handlersFor();
    const cross = await handlers.status(
      statusRequest(REQUEST_ID, { "sec-fetch-site": "cross-site" }),
      REQUEST_ID,
    );
    expect(cross.status).toBe(403);
    requireSession.mockRejectedValueOnce(new ShoeboxError("UNAUTHORIZED"));
    const anonymous = await handlers.status(
      statusRequest(REQUEST_ID),
      REQUEST_ID,
    );
    expect(anonymous.status).toBe(401);
    expect(factory).not.toHaveBeenCalled();
    expect(mock.total()).toBe(0);
  });

  it("answers 400 for a malformed id", async () => {
    const { handlers, mock } = handlersFor();
    const response = await handlers.status(statusRequest("abc"), "abc");
    expect(response.status).toBe(400);
    expect(mock.total()).toBe(0);
  });

  it("maps an upstream outage to a safe 503", async () => {
    const { handlers, mock } = handlersFor();
    mock.failNext(
      "dataSourcesQuery",
      notionError({ status: 503 }),
      notionError({ status: 503 }),
      notionError({ status: 503 }),
    );
    const response = await handlers.status(
      statusRequest(REQUEST_ID),
      REQUEST_ID,
    );
    expect(response.status).toBe(503);
    expect(writes(mock)).toBe(0);
  });
});

describe("route: /api/shoebox/requests/[requestId]", () => {
  const context = (requestId: string) => ({
    params: Promise.resolve({ requestId }),
  });

  it("GET and HEAD follow the auth path (401 without a session)", async () => {
    const get = await statusGet(statusRequest(REQUEST_ID), context(REQUEST_ID));
    expect(get.status).toBe(401);
    const head = await statusHead(
      statusRequest(REQUEST_ID, { "sec-fetch-site": "same-origin" }, "HEAD"),
      context(REQUEST_ID),
    );
    expect(head.status).toBe(401);
    expect(await head.text()).toBe("");
  });

  it("answers 405 with Allow for every other method", () => {
    for (const handler of [statusPost, statusDelete, statusOptions]) {
      const response = handler();
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD");
      expect(response.headers.get("cache-control")).toContain("no-store");
    }
  });
});
