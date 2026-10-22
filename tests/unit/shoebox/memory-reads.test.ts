import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GET as detailGet,
  HEAD as detailHead,
  OPTIONS as detailOptions,
  PUT as detailPut,
} from "@/app/api/shoebox/memories/[id]/route";
import {
  GET as listGet,
  HEAD as listHead,
  OPTIONS as listOptions,
  PUT as listPut,
} from "@/app/api/shoebox/memories/route";
import { ShoeboxError } from "@/features/shoebox/server/errors";
import { createMemoryHandlers } from "@/features/shoebox/server/memory-handlers";
import { createMemoryService } from "@/features/shoebox/server/memory-service";
import { createNotionGateway } from "@/features/shoebox/server/notion-gateway";
import type { MemoryPage, MemorySummary } from "@/types/shoebox";
import {
  buildPage,
  createMockNotion,
  DATA_SOURCE_ID,
  DATABASE_ID,
  type MockNotionOptions,
  memoryId,
  OTHER_DATA_SOURCE_ID,
  type PageSpec,
} from "../../helpers/mock-notion";
import { FAKE_APP_ORIGIN } from "../../helpers/safe-env";

let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

function day(n: number): string {
  return new Date(Date.UTC(2026, 9, 21) - n * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function spec(n: number, overrides: Partial<PageSpec> = {}): PageSpec {
  return {
    id: memoryId(n),
    kind: n % 3 === 0 ? "photo" : n % 3 === 1 ? "text" : "audio",
    date: day(n),
    createdTime: `${day(n)}T10:00:00.000Z`,
    ...overrides,
  };
}

function records121(): MockNotionOptions {
  return {
    pages: Array.from({ length: 121 }, (_, i) => buildPage(spec(i + 1))),
  };
}

function setup(options: MockNotionOptions = records121()) {
  const mock = createMockNotion(options);
  const gateway = createNotionGateway({ client: mock.client });
  const service = createMemoryService(gateway, { databaseId: DATABASE_ID });
  return { mock, service };
}

function get(
  path: string,
  headers: Record<string, string> = {},
  method = "GET",
): Request {
  return new Request(`${FAKE_APP_ORIGIN}${path}`, {
    method,
    headers: { "sec-fetch-site": "same-origin", ...headers },
  });
}

function handlersFor(options: MockNotionOptions = records121()) {
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

describe("service: single memory and media", () => {
  it("reads a valid backdated record absent from the newest page", async () => {
    const { service, mock } = setup({
      pages: [
        ...(records121().pages ?? []),
        buildPage({
          id: memoryId(500),
          kind: "text",
          text: "antiguo",
          date: "1999-01-01",
        }),
      ],
    });
    const first = await service.listMemories({});
    expect(first.items.map((item) => item.id)).not.toContain(memoryId(500));
    const memory = await service.getMemory(memoryId(500));
    expect(memory).toMatchObject({
      id: memoryId(500),
      kind: "text",
      text: "antiguo",
      memoryDate: "1999-01-01",
    });
    expect(mock.counters.pagesRetrieve).toBe(1);
    expect(mock.counters.dataSourcesQuery).toBe(1);
  });

  it("returns NOT_FOUND for missing, malformed, trashed, foreign and invalid records", async () => {
    const { service, mock } = setup({
      pages: [
        buildPage(spec(1, { inTrash: true })),
        buildPage(
          spec(2, {
            parent: {
              type: "data_source_id",
              data_source_id: OTHER_DATA_SOURCE_ID,
              database_id: DATABASE_ID,
            },
          }),
        ),
        buildPage(spec(3, { kind: "video" })),
        buildPage(spec(4, { kind: "photo", files: [] })),
      ],
    });
    for (const id of [
      memoryId(1),
      memoryId(2),
      memoryId(3),
      memoryId(4),
      memoryId(99),
    ]) {
      await expect(service.getMemory(id)).rejects.toMatchObject({
        code: "NOT_FOUND",
        status: 404,
      });
    }
    const before = mock.counters.pagesRetrieve;
    await expect(service.getMemory("not-a-uuid")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      service.getMemory(`${memoryId(1)}/../x`),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mock.counters.pagesRetrieve).toBe(before);
  });

  it("treats a data-source parent without database_id as not a member instead of throwing", async () => {
    const { service } = setup({
      pages: [
        buildPage(
          spec(1, {
            parent: { type: "data_source_id", data_source_id: DATA_SOURCE_ID },
          }),
        ),
      ],
    });
    await expect(service.getMemory(memoryId(1))).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });

  it("resolves trusted media without ever returning it as a summary", async () => {
    const { service } = setup();
    const photo = await service.resolveMemoryMedia(memoryId(3));
    expect(photo.kind).toBe("photo");
    expect(photo.url).toBeInstanceOf(URL);
    expect(photo.url.protocol).toBe("https:");
    expect(photo.expectedMimeType).toBe("image/jpeg");
    const audio = await service.resolveMemoryMedia(memoryId(2));
    expect(audio.kind).toBe("audio");
    expect(audio.expectedMimeType).toBe("audio/webm");
    await expect(service.resolveMemoryMedia(memoryId(1))).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
  });

  it("refuses media for external attachments and plain-http urls", async () => {
    const { service } = setup({
      pages: [
        buildPage(spec(3, { files: [{ name: "a.jpg", type: "external" }] })),
        buildPage(
          spec(6, { files: [{ name: "a.jpg", url: "http://x.test/a" }] }),
        ),
      ],
    });
    await expect(service.resolveMemoryMedia(memoryId(3))).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
    await expect(service.resolveMemoryMedia(memoryId(6))).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
  });
});

describe("weba audio", () => {
  it("lists, reads and resolves a .weba recording as audio/webm", async () => {
    const { service, mock } = setup({
      pages: [
        buildPage({
          id: memoryId(7),
          kind: "audio",
          date: "2026-10-21",
          files: [{ name: "memory.weba" }],
        }),
      ],
    });
    void mock;
    const list = await service.listMemories({});
    expect(list.items[0]).toMatchObject({
      kind: "audio",
      mimeType: "audio/webm",
    });
    expect(await service.getMemory(memoryId(7))).toMatchObject({
      mimeType: "audio/webm",
    });
    const media = await service.resolveMemoryMedia(memoryId(7));
    expect(media.expectedMimeType).toBe("audio/webm");
  });
});

describe("handlers: authenticate before the service", () => {
  it("returns 401 for an unauthenticated list without constructing the service", async () => {
    const { mock, factory, requireSession, handlers } = handlersFor();
    requireSession.mockRejectedValueOnce(new ShoeboxError("UNAUTHORIZED"));
    const response = await handlers.list(get("/api/shoebox/memories"));
    expect(response.status).toBe(401);
    expect(factory).not.toHaveBeenCalled();
    expect(mock.total()).toBe(0);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("returns 401 for an unauthenticated detail request, even for a bad id", async () => {
    const { factory, requireSession, handlers } = handlersFor();
    requireSession.mockRejectedValue(new ShoeboxError("UNAUTHORIZED"));
    const response = await handlers.get(
      get("/api/shoebox/memories/not-a-uuid"),
      "not-a-uuid",
    );
    expect(response.status).toBe(401);
    expect(factory).not.toHaveBeenCalled();
  });

  it("rejects cross-site reads before session or service work", async () => {
    const { factory, requireSession, handlers } = handlersFor();
    const response = await handlers.list(
      get("/api/shoebox/memories", { "sec-fetch-site": "cross-site" }),
    );
    expect(response.status).toBe(403);
    expect(requireSession).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
  });

  it("serves the first batch privately once authenticated", async () => {
    const { factory, requireSession, handlers } = handlersFor();
    const response = await handlers.list(get("/api/shoebox/memories"));
    expect(response.status).toBe(200);
    expect(requireSession).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = (await response.json()) as MemoryPage;
    expect(body.items).toHaveLength(12);
    expect(body.nextCursor).not.toBeNull();
    expect(JSON.stringify(body)).not.toContain("https://");
  });

  it("follows a cursor and accepts nothing else in the query", async () => {
    const { handlers } = handlersFor();
    const first = (await (
      await handlers.list(get("/api/shoebox/memories"))
    ).json()) as MemoryPage;
    const next = await handlers.list(
      get(
        `/api/shoebox/memories?cursor=${encodeURIComponent(first.nextCursor ?? "")}`,
      ),
    );
    expect(next.status).toBe(200);
    const nextBody = (await next.json()) as MemoryPage;
    expect(nextBody.items[0].id).toBe(memoryId(13));

    for (const query of [
      "?limit=500",
      "?cursor=a&cursor=b",
      "?cursor=",
      `?cursor=${"a".repeat(1_025)}`,
      "?cursor=%E0%A4%A",
    ]) {
      const response = await handlers.list(
        get(`/api/shoebox/memories${query}`),
      );
      expect(response.status, query).toBe(400);
    }
  });

  it("reads a single memory after authentication", async () => {
    const { handlers, mock } = handlersFor();
    const ok = await handlers.get(
      get(`/api/shoebox/memories/${memoryId(121)}`),
      memoryId(121),
    );
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { memory: MemorySummary };
    expect(body.memory.id).toBe(memoryId(121));
    expect(mock.counters.dataSourcesQuery).toBe(0);

    const bad = await handlers.get(get("/api/shoebox/memories/nope"), "nope");
    expect(bad.status).toBe(404);
    const missing = await handlers.get(
      get(`/api/shoebox/memories/${memoryId(900)}`),
      memoryId(900),
    );
    expect(missing.status).toBe(404);
    expect(
      ((await missing.json()) as { error: { code: string } }).error.code,
    ).toBe("NOT_FOUND");
  });

  it("sanitizes unexpected service failures", async () => {
    const requireSession = vi.fn(async () => ({
      id: "s",
      issuedAt: 1,
      expiresAt: 2,
    }));
    const handlers = createMemoryHandlers({
      requireSession,
      service: () => ({
        listMemories: async () => {
          throw new Error(`boom https://secret.test/${DATABASE_ID}`);
        },
        getMemory: async () => {
          throw new Error("boom");
        },
        resolveMemoryMedia: async () => {
          throw new Error("boom");
        },
        createMemory: async () => {
          throw new Error("boom");
        },
        findRequest: async () => {
          throw new Error("boom");
        },
        correctMemory: async () => {
          throw new Error("boom");
        },
        removeMemory: async () => {
          throw new Error("boom");
        },
      }),
    });
    const response = await handlers.list(get("/api/shoebox/memories"));
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain("secret.test");
    expect(text).not.toContain(DATABASE_ID);
    expect(text).not.toContain("boom");
    expect(errorLog.mock.calls.join(" ")).not.toContain("secret.test");
  });

  it("surfaces setup problems as SETUP_REQUIRED without details", async () => {
    const { handlers } = handlersFor({
      pages: [],
      dataSources: [],
    });
    const response = await handlers.list(get("/api/shoebox/memories"));
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { code: string } };
    expect(["SETUP_REQUIRED", "UNAVAILABLE"]).toContain(body.error.code);
    expect(JSON.stringify(body)).not.toContain(DATA_SOURCE_ID);
  });
});

describe("route modules", () => {
  const detailContext = (id: string) => ({
    params: Promise.resolve({ id }),
  });

  it("answers an unauthenticated GET with 401 JSON, not a redirect", async () => {
    const response = await listGet(get("/api/shoebox/memories"));
    expect(response.status).toBe(401);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("makes HEAD follow the GET auth path without a body", async () => {
    const response = await listHead(get("/api/shoebox/memories", {}, "HEAD"));
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("");

    const detail = await detailHead(
      get(`/api/shoebox/memories/${memoryId(1)}`, {}, "HEAD"),
      detailContext(memoryId(1)),
    );
    expect(detail.status).toBe(401);
    expect(await detail.text()).toBe("");
  });

  it("returns 405 with Allow for other methods on the list route", async () => {
    for (const handler of [listPut, listOptions]) {
      const response = handler();
      expect(response.status).toBe(405);
      // Task 5 added POST (multipart create) to the list route.
      expect(response.headers.get("allow")).toBe("GET, HEAD, POST");
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    }
  });

  it("returns 405 with Allow for other methods on the detail route", async () => {
    for (const handler of [detailPut, detailOptions]) {
      const response = handler();
      expect(response.status).toBe(405);
      // Task 7 added PATCH (correction) and DELETE (trash) to the detail route.
      expect(response.headers.get("allow")).toBe("GET, HEAD, PATCH, DELETE");
    }
  });

  it("authenticates the detail GET before reading params-driven data", async () => {
    const response = await detailGet(
      get("/api/shoebox/memories/not-a-uuid"),
      detailContext("not-a-uuid"),
    );
    expect(response.status).toBe(401);
  });
});
