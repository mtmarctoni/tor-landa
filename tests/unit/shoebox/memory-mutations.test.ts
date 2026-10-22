import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DELETE as detailDelete,
  OPTIONS as detailOptions,
  PATCH as detailPatch,
  PUT as detailPut,
} from "@/app/api/shoebox/memories/[id]/route";
import { ShoeboxError } from "@/features/shoebox/server/errors";
import { createMemoryHandlers } from "@/features/shoebox/server/memory-handlers";
import { createMemoryService } from "@/features/shoebox/server/memory-service";
import { createNotionGateway } from "@/features/shoebox/server/notion-gateway";
import { ValidationError } from "@/features/shoebox/validation";
import type { MemorySummary } from "@/types/shoebox";
import {
  buildPage,
  createMockNotion,
  DATA_SOURCE_ID,
  DATABASE_ID,
  type MockNotionOptions,
  memoryId,
  notionError,
  OTHER_DATA_SOURCE_ID,
  OTHER_DATABASE_ID,
} from "../../helpers/mock-notion";
import { FAKE_APP_ORIGIN, SAFE_ENV } from "../../helpers/safe-env";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const TEXT_ID = memoryId(1);
const PHOTO_ID = memoryId(2);
const AUDIO_ID = memoryId(3);
const TRASHED_ID = memoryId(4);
const FOREIGN_ID = memoryId(5);
const MISSING_ID = memoryId(99);

const foreignParent = {
  type: "data_source_id",
  data_source_id: OTHER_DATA_SOURCE_ID,
  database_id: OTHER_DATABASE_ID,
};

function pages() {
  return [
    buildPage({ id: TEXT_ID, kind: "text", text: "viejo", caption: "pie" }),
    buildPage({ id: PHOTO_ID, kind: "photo", caption: "foto" }),
    buildPage({ id: AUDIO_ID, kind: "audio", caption: "voz" }),
    buildPage({ id: TRASHED_ID, kind: "text", text: "ya", inTrash: true }),
    buildPage({
      id: FOREIGN_ID,
      kind: "text",
      text: "ajeno",
      parent: foreignParent,
    }),
  ];
}

function setup(options: MockNotionOptions = {}) {
  const mock = createMockNotion({ pages: pages(), ...options });
  const gateway = createNotionGateway({
    client: mock.client,
    sleep: async () => undefined,
    random: () => 0,
    deadlines: { readMs: 15_000, writeMs: 45_000 },
  });
  const service = createMemoryService(gateway, { databaseId: DATABASE_ID });
  return { mock, service };
}

const config = () => ({
  notionApiKey: SAFE_ENV.NOTION_API_KEY,
  notionDbId: DATABASE_ID,
  passwordHash: SAFE_ENV.SHOEBOX_PASSWORD_HASH,
  sessionSecret: SAFE_ENV.SHOEBOX_SESSION_SECRET,
  appOrigin: FAKE_APP_ORIGIN,
});

function handlersFor(options: MockNotionOptions = {}) {
  const built = setup(options);
  const factory = vi.fn(() => built.service);
  const requireSession = vi.fn(async () => ({
    id: "s",
    issuedAt: 1,
    expiresAt: 2,
  }));
  const handlers = createMemoryHandlers({
    service: factory,
    requireSession,
    config,
  });
  return { ...built, factory, requireSession, handlers };
}

async function rejection(promise: Promise<unknown>): Promise<ShoeboxError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ShoeboxError);
    return error as ShoeboxError;
  }
  throw new Error("expected a rejection");
}

function mutation(
  method: "PATCH" | "DELETE",
  body?: BodyInit,
  headers: Record<string, string> = {},
): Request {
  return new Request(`${FAKE_APP_ORIGIN}/api/shoebox/memories/x`, {
    method,
    headers: {
      origin: FAKE_APP_ORIGIN,
      "sec-fetch-site": "same-origin",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body,
  });
}

async function invalid(
  promise: Promise<unknown>,
): Promise<"shape" | "semantic"> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    return (error as ValidationError).type;
  }
  throw new Error("expected a rejection");
}

const patchBody = (value: unknown) => JSON.stringify(value);
const textPatch = {
  text: "nuevo",
  caption: "otro pie",
  memoryDate: "2026-01-02",
};
const mediaPatch = { caption: "nuevo pie", memoryDate: "2026-01-03" };

describe("service: correctMemory", () => {
  it("writes only Caption, Text and Memory date for a text memory", async () => {
    const { mock, service } = setup();
    const memory = await service.correctMemory(TEXT_ID, textPatch);
    expect(mock.pageUpdateCalls).toHaveLength(1);
    const call = mock.pageUpdateCalls[0];
    expect(call.page_id).toBe(TEXT_ID);
    expect(call.in_trash).toBeUndefined();
    expect(Object.keys(call.properties ?? {}).sort()).toEqual([
      "Caption",
      "Memory date",
      "Text",
    ]);
    expect(memory).toMatchObject({
      id: TEXT_ID,
      kind: "text",
      text: "nuevo",
      caption: "otro pie",
      memoryDate: "2026-01-02",
    });
    expect(await service.getMemory(TEXT_ID)).toEqual(memory);
  });

  it("changes only caption and date on photo and audio and never touches Media or Text", async () => {
    const { mock, service } = setup();
    for (const id of [PHOTO_ID, AUDIO_ID]) {
      const before = mock.pages.get(id)?.properties;
      const mediaBefore = JSON.stringify(before?.Media);
      const textBefore = JSON.stringify(before?.Text);
      const memory = await service.correctMemory(id, mediaPatch);
      expect(memory).toMatchObject(mediaPatch);
      expect(JSON.stringify(mock.pages.get(id)?.properties.Media)).toBe(
        mediaBefore,
      );
      expect(JSON.stringify(mock.pages.get(id)?.properties.Text)).toBe(
        textBefore,
      );
    }
    for (const call of mock.pageUpdateCalls) {
      expect(Object.keys(call.properties ?? {}).sort()).toEqual([
        "Caption",
        "Memory date",
      ]);
    }
  });

  it("rejects text on a media memory and a missing text on a text memory before any write", async () => {
    const { mock, service } = setup();
    expect(
      await invalid(
        service.correctMemory(PHOTO_ID, { ...mediaPatch, text: "x" }),
      ),
    ).toBe("shape");
    expect(await invalid(service.correctMemory(TEXT_ID, mediaPatch))).toBe(
      "shape",
    );
    expect(mock.pageUpdateCalls).toHaveLength(0);
  });

  it("rejects an empty note, bad date and over-long caption as 422 and writes nothing", async () => {
    const { mock, service } = setup();
    const bad = [
      { ...textPatch, text: "" },
      { ...textPatch, memoryDate: "2026-02-30" },
      { ...textPatch, caption: "a".repeat(501) },
    ];
    for (const patch of bad) {
      expect(await invalid(service.correctMemory(TEXT_ID, patch))).toBe(
        "semantic",
      );
    }
    expect(mock.pageUpdateCalls).toHaveLength(0);
  });

  it("cannot mutate kind, media, request id, createTime or unknown fields", async () => {
    const { mock, service } = setup();
    for (const extra of [
      { kind: "photo" },
      { media: [] },
      { Media: [] },
      { requestId: "7c0ffee0-1111-4a2b-8c3d-000000000001" },
      { createdAt: "2020-01-01T00:00:00.000Z" },
      { createTime: "2020-01-01" },
      { surprise: 1 },
    ]) {
      expect(
        await invalid(
          service.correctMemory(TEXT_ID, { ...textPatch, ...extra }),
        ),
      ).toBe("shape");
    }
    expect(mock.pageUpdateCalls).toHaveLength(0);
  });

  it("answers 404 before any write for wrong source, trashed, missing and malformed ids", async () => {
    const { mock, service } = setup();
    for (const id of [FOREIGN_ID, TRASHED_ID, MISSING_ID, "not-a-uuid"]) {
      const error = await rejection(service.correctMemory(id, textPatch));
      expect(error.code).toBe("NOT_FOUND");
    }
    expect(mock.pageUpdateCalls).toHaveLength(0);
  });

  it("surfaces 404 when the record disappears between lookup and update", async () => {
    const { mock, service } = setup();
    mock.failNext(
      "pagesUpdate",
      notionError({ status: 404, code: "object_not_found" }),
    );
    const error = await rejection(service.correctMemory(TEXT_ID, textPatch));
    expect(error.code).toBe("NOT_FOUND");
    expect(mock.counters.pagesUpdate).toBe(1);
  });

  it("surfaces 404 when the page was trashed between lookup and update", async () => {
    const { mock, service } = setup();
    mock.failNext("pagesUpdate", () => {
      const page = mock.pages.get(TEXT_ID);
      if (page) page.in_trash = true;
      return notionError({ status: 400, code: "validation_error" });
    });
    const error = await rejection(service.correctMemory(TEXT_ID, textPatch));
    expect(error.code).toBe("NOT_FOUND");
  });

  it("maps a permission failure to SETUP_REQUIRED without repeating the write", async () => {
    const { mock, service } = setup();
    mock.failNext(
      "pagesUpdate",
      notionError({ status: 403, code: "restricted_resource" }),
    );
    const error = await rejection(service.correctMemory(TEXT_ID, textPatch));
    expect(error.code).toBe("SETUP_REQUIRED");
    expect(mock.counters.pagesUpdate).toBe(1);
  });

  it("returns success after an uncertain update that did commit, re-reading once and never rewriting", async () => {
    const { mock, service } = setup();
    mock.failAfterCommit("pagesUpdate", notionError({ status: 504 }));
    const reads = mock.counters.pagesRetrieve;
    const memory = await service.correctMemory(TEXT_ID, textPatch);
    expect(memory).toMatchObject({ text: "nuevo", caption: "otro pie" });
    expect(mock.counters.pagesUpdate).toBe(1);
    // one membership read, one reconciliation read
    expect(mock.counters.pagesRetrieve - reads).toBe(2);
  });

  it("returns OUTCOME_UNKNOWN when the uncertain update did not show up, without rewriting", async () => {
    const { mock, service } = setup();
    mock.failNext("pagesUpdate", notionError({ status: 504 }));
    const error = await rejection(service.correctMemory(TEXT_ID, textPatch));
    expect(error.code).toBe("OUTCOME_UNKNOWN");
    expect(error.status).toBe(202);
    expect(mock.counters.pagesUpdate).toBe(1);
    expect(mock.pages.get(TEXT_ID)?.properties.Caption).toMatchObject({
      rich_text: [{ plain_text: "pie" }],
    });
  });

  it("returns OUTCOME_UNKNOWN when the reconciliation read itself fails", async () => {
    const { mock, service } = setup();
    mock.failNext("pagesUpdate", () => {
      const down = notionError({ status: 500 });
      mock.failNext("pagesRetrieve", down, down, down);
      return notionError({ status: 504 });
    });
    const error = await rejection(service.correctMemory(TEXT_ID, textPatch));
    expect(error.code).toBe("OUTCOME_UNKNOWN");
    expect(mock.counters.pagesUpdate).toBe(1);
  });

  it("keeps spaces and line breaks verbatim through the uncertain path", async () => {
    const { mock, service } = setup();
    mock.failAfterCommit("pagesUpdate", notionError({ status: 504 }));
    const text = "  primera línea\r\nsegunda\n\n  tercera  ";
    const memory = await service.correctMemory(TEXT_ID, {
      text,
      caption: " pie ",
      memoryDate: "2026-01-02",
    });
    expect(memory).toMatchObject({ text, caption: " pie " });
    expect(mock.counters.pagesUpdate).toBe(1);
  });

  it("is last confirmed write wins for two independent corrections", async () => {
    const { mock, service } = setup();
    await service.correctMemory(TEXT_ID, textPatch);
    const second = await service.correctMemory(TEXT_ID, {
      text: "segundo",
      caption: "",
      memoryDate: "2026-02-02",
    });
    expect(second).toMatchObject({ text: "segundo", caption: "" });
    expect(await service.getMemory(TEXT_ID)).toEqual(second);
    // no read-modify-write guard of any kind: both writes went out blind
    expect(mock.pageUpdateCalls).toHaveLength(2);
  });

  it("chunks a long text exactly like create and round-trips it", async () => {
    const { mock, service } = setup();
    const long = "ñ".repeat(1_500);
    const memory = await service.correctMemory(TEXT_ID, {
      ...textPatch,
      text: long,
    });
    const sent = mock.pageUpdateCalls[0].properties?.Text;
    expect(sent && "rich_text" in sent && sent.rich_text.length).toBe(2);
    expect(memory.kind === "text" && memory.text).toBe(long);
  });
});

describe("service: removeMemory", () => {
  it("rejects a foreign-source id with NOT_FOUND and zero writes", async () => {
    const { mock, service } = setup();
    await expect(service.removeMemory(FOREIGN_ID)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(service.removeMemory(MISSING_ID)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(service.removeMemory("nope")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mock.pageUpdateCalls).toHaveLength(0);
  });

  it("moves a member to the trash with exactly in_trash true", async () => {
    const { mock, service } = setup();
    await service.removeMemory(TEXT_ID);
    expect(mock.pageUpdateCalls).toHaveLength(1);
    expect(mock.pageUpdateCalls[0]).toEqual({
      page_id: TEXT_ID,
      in_trash: true,
    });
    await expect(service.getMemory(TEXT_ID)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("is idempotent for a member already in the trash", async () => {
    const { mock, service } = setup();
    await expect(service.removeMemory(TRASHED_ID)).resolves.toBeUndefined();
    expect(mock.pageUpdateCalls).toHaveLength(0);
    await service.removeMemory(PHOTO_ID);
    await expect(service.removeMemory(PHOTO_ID)).resolves.toBeUndefined();
    expect(mock.pageUpdateCalls).toHaveLength(1);
  });

  it("treats a trashed page without database_id as not a member, with no throw and no write", async () => {
    const { mock, service } = setup({
      pages: [
        buildPage({
          id: TRASHED_ID,
          kind: "text",
          text: "ya",
          inTrash: true,
          parent: { type: "data_source_id", data_source_id: DATA_SOURCE_ID },
        }),
      ],
    });
    await expect(service.removeMemory(TRASHED_ID)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mock.pageUpdateCalls).toHaveLength(0);
  });

  it("surfaces 404 when the record disappears between lookup and update", async () => {
    const { mock, service } = setup();
    mock.failNext(
      "pagesUpdate",
      notionError({ status: 404, code: "object_not_found" }),
    );
    await expect(service.removeMemory(TEXT_ID)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("treats an uncertain update that did trash the page as success, without a second write", async () => {
    const { mock, service } = setup();
    mock.failAfterCommit("pagesUpdate", notionError({ status: 504 }));
    await expect(service.removeMemory(TEXT_ID)).resolves.toBeUndefined();
    expect(mock.counters.pagesUpdate).toBe(1);
  });

  it("returns OUTCOME_UNKNOWN when the page is still live after an uncertain update", async () => {
    const { mock, service } = setup();
    mock.failNext("pagesUpdate", notionError({ status: 504 }));
    const error = await rejection(service.removeMemory(TEXT_ID));
    expect(error.code).toBe("OUTCOME_UNKNOWN");
    expect(mock.counters.pagesUpdate).toBe(1);
    expect(mock.pages.get(TEXT_ID)?.in_trash).toBe(false);
  });

  it("returns success when the re-read after an uncertain update finds the page gone", async () => {
    const { mock, service } = setup();
    mock.failNext("pagesUpdate", () => {
      mock.failNext(
        "pagesRetrieve",
        notionError({ status: 404, code: "object_not_found" }),
      );
      return notionError({ status: 504 });
    });
    await expect(service.removeMemory(TEXT_ID)).resolves.toBeUndefined();
    expect(mock.counters.pagesUpdate).toBe(1);
  });

  it("stays unknown when the re-read after an uncertain update fails with 503", async () => {
    const { mock, service } = setup();
    mock.failNext("pagesUpdate", () => {
      const down = notionError({ status: 503 });
      mock.failNext("pagesRetrieve", down, down, down);
      return notionError({ status: 504 });
    });
    const error = await rejection(service.removeMemory(TEXT_ID));
    expect(error.code).toBe("OUTCOME_UNKNOWN");
    expect(error.status).toBe(202);
    expect(mock.counters.pagesUpdate).toBe(1);
  });

  it("maps a permission failure to SETUP_REQUIRED without a retry loop", async () => {
    const { mock, service } = setup();
    mock.failNext(
      "pagesUpdate",
      notionError({ status: 403, code: "restricted_resource" }),
    );
    await expect(service.removeMemory(TEXT_ID)).rejects.toMatchObject({
      code: "SETUP_REQUIRED",
    });
    expect(mock.counters.pagesUpdate).toBe(1);
  });

  it("exposes no permanent-delete or replace operation", () => {
    const { service } = setup();
    expect(Object.keys(service).sort()).toEqual(
      [
        "correctMemory",
        "createMemory",
        "findRequest",
        "getMemory",
        "listMemories",
        "removeMemory",
        "resolveMemoryMedia",
      ].sort(),
    );
  });
});

describe("handler: PATCH /api/shoebox/memories/:id", () => {
  it("returns the corrected memory as private JSON", async () => {
    const { handlers } = handlersFor();
    const response = await handlers.correct(
      mutation("PATCH", patchBody(textPatch)),
      TEXT_ID,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = (await response.json()) as { memory: MemorySummary };
    expect(body.memory).toMatchObject({ id: TEXT_ID, text: "nuevo" });
    expect(JSON.stringify(body)).not.toMatch(/notion|secret|sig=/);
  });

  it("checks origin before session, body or upstream", async () => {
    const { handlers, requireSession, factory, mock } = handlersFor();
    const hostile: Record<string, string>[] = [
      { origin: "https://evil.test" },
      { "sec-fetch-site": "cross-site" },
    ];
    for (const headers of hostile) {
      const response = await handlers.correct(
        mutation("PATCH", patchBody(textPatch), headers),
        TEXT_ID,
      );
      expect(response.status).toBe(403);
    }
    const noOrigin = new Request("https://shoebox.test/x", {
      method: "PATCH",
      body: patchBody(textPatch),
    });
    expect((await handlers.correct(noOrigin, TEXT_ID)).status).toBe(403);
    expect(requireSession).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
    expect(mock.total()).toBe(0);
  });

  it("answers 401 without a session and touches nothing", async () => {
    const built = handlersFor();
    const handlers = createMemoryHandlers({
      service: built.factory,
      config,
      requireSession: async () => {
        throw new ShoeboxError("UNAUTHORIZED");
      },
    });
    const response = await handlers.correct(
      mutation("PATCH", patchBody(textPatch)),
      TEXT_ID,
    );
    expect(response.status).toBe(401);
    expect(built.factory).not.toHaveBeenCalled();
  });

  it("maps invalid JSON and unknown fields to 400, semantic errors to 422, oversize to 413", async () => {
    const { handlers, mock } = handlersFor();
    const status = async (body: string) =>
      (await handlers.correct(mutation("PATCH", body), TEXT_ID)).status;
    expect(await status("{nope")).toBe(400);
    expect(await status("")).toBe(400);
    expect(await status("[]")).toBe(400);
    expect(await status(patchBody({ ...textPatch, kind: "photo" }))).toBe(400);
    expect(await status(patchBody({ ...textPatch, text: "" }))).toBe(422);
    expect(
      await status(patchBody({ ...textPatch, memoryDate: "2026-13-01" })),
    ).toBe(422);
    expect(
      await status(patchBody({ ...textPatch, caption: "a".repeat(20_000) })),
    ).toBe(413);
    expect(mock.pageUpdateCalls).toHaveLength(0);
  });

  it("rejects text on a media memory and gives 404 for a foreign source with no write", async () => {
    const { handlers, mock } = handlersFor();
    const media = await handlers.correct(
      mutation("PATCH", patchBody({ ...mediaPatch, text: "x" })),
      PHOTO_ID,
    );
    expect(media.status).toBe(400);
    const foreign = await handlers.correct(
      mutation("PATCH", patchBody(textPatch)),
      FOREIGN_ID,
    );
    expect(foreign.status).toBe(404);
    expect(mock.pageUpdateCalls).toHaveLength(0);
  });

  it("returns 202 OUTCOME_UNKNOWN for an unconfirmed update", async () => {
    const { handlers, mock } = handlersFor();
    mock.failNext("pagesUpdate", notionError({ status: 504 }));
    const response = await handlers.correct(
      mutation("PATCH", patchBody(textPatch)),
      TEXT_ID,
    );
    expect(response.status).toBe(202);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("OUTCOME_UNKNOWN");
  });
});

describe("handler: DELETE /api/shoebox/memories/:id", () => {
  it("returns 204 with no body and a trashed page", async () => {
    const { handlers, mock } = handlersFor();
    const response = await handlers.remove(mutation("DELETE"), TEXT_ID);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mock.pageUpdateCalls[0]).toMatchObject({
      page_id: TEXT_ID,
      in_trash: true,
    });
  });

  it("returns 204 for an already trashed member and 404 for a wrong source", async () => {
    const { handlers, mock } = handlersFor();
    expect((await handlers.remove(mutation("DELETE"), TRASHED_ID)).status).toBe(
      204,
    );
    expect((await handlers.remove(mutation("DELETE"), FOREIGN_ID)).status).toBe(
      404,
    );
    expect(mock.pageUpdateCalls).toHaveLength(0);
  });

  it("rejects a foreign origin before session or upstream", async () => {
    const { handlers, requireSession, mock } = handlersFor();
    const hostile: Record<string, string>[] = [
      { origin: "https://evil.test" },
      { "sec-fetch-site": "same-site" },
    ];
    for (const headers of hostile) {
      const response = await handlers.remove(
        mutation("DELETE", undefined, headers),
        TEXT_ID,
      );
      expect(response.status).toBe(403);
    }
    expect(requireSession).not.toHaveBeenCalled();
    expect(mock.total()).toBe(0);
  });

  it("rejects any body bytes with 413 before any Notion call", async () => {
    const { handlers, mock } = handlersFor();
    const withBody = await handlers.remove(mutation("DELETE", "x"), TEXT_ID);
    expect(withBody.status).toBe(413);
    const json = await handlers.remove(mutation("DELETE", "{}"), TEXT_ID);
    expect(json.status).toBe(413);
    expect(mock.total()).toBe(0);
  });

  it("returns 202 when the removal cannot be confirmed", async () => {
    const { handlers, mock } = handlersFor();
    mock.failNext("pagesUpdate", notionError({ status: 504 }));
    const response = await handlers.remove(mutation("DELETE"), TEXT_ID);
    expect(response.status).toBe(202);
    expect(mock.counters.pagesUpdate).toBe(1);
  });
});

describe("route: [id]", () => {
  const context = (id: string) => ({ params: Promise.resolve({ id }) });

  it("no longer answers 405 for PATCH and DELETE, and lists them in Allow", async () => {
    const patch = await detailPatch(
      mutation("PATCH", patchBody(textPatch), { origin: "https://evil.test" }),
      context(TEXT_ID),
    );
    expect(patch.status).not.toBe(405);
    const del = await detailDelete(
      mutation("DELETE", undefined, { origin: "https://evil.test" }),
      context(TEXT_ID),
    );
    expect(del.status).not.toBe(405);
    for (const response of [detailPut(), detailOptions()]) {
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD, PATCH, DELETE");
    }
  });
});
