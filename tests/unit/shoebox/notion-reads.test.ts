import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShoeboxError } from "@/features/shoebox/server/errors";
import { toErrorResponse } from "@/features/shoebox/server/http";
import {
  createMemoryService,
  type MemoryService,
} from "@/features/shoebox/server/memory-service";
import {
  createNotionGateway,
  createSdkClient,
  type NotionClientLike,
} from "@/features/shoebox/server/notion-gateway";
import { splitRichText } from "@/features/shoebox/server/rich-text";
import {
  buildDatabase,
  buildDataSource,
  buildPage,
  createMockNotion,
  DATA_SOURCE_ID,
  DATABASE_ID,
  type MockNotionOptions,
  memoryId,
  notionError,
  OTHER_DATA_SOURCE_ID,
  OTHER_DATABASE_ID,
  type PageSpec,
} from "../../helpers/mock-notion";

let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

function fakeTime() {
  let now = 1_000_000;
  const sleeps: number[] = [];
  return {
    sleeps,
    clock: () => now,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      now += ms;
    },
  };
}

function setup(options: MockNotionOptions = {}, databaseId = DATABASE_ID) {
  const mock = createMockNotion(options);
  const time = fakeTime();
  const gateway = createNotionGateway({
    client: mock.client,
    clock: time.clock,
    sleep: time.sleep,
    random: () => 0.5,
  });
  const service = createMemoryService(gateway, { databaseId });
  return { mock, time, gateway, service };
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

function dayOffset(n: number): string {
  const date = new Date(Date.UTC(2026, 9, 21) - n * 86_400_000);
  return date.toISOString().slice(0, 10);
}

/** Record n is newer than n+1, so list position is n - 1. */
function spec(n: number, overrides: Partial<PageSpec> = {}): PageSpec {
  const kind = n % 3 === 0 ? "photo" : n % 3 === 1 ? "text" : "audio";
  return {
    id: memoryId(n),
    kind,
    date: dayOffset(n),
    createdTime: `${dayOffset(n)}T10:00:00.000Z`,
    caption: `caption ${n}`,
    ...overrides,
  };
}

const INVALID: Record<number, Partial<PageSpec>> = {
  20: { kind: "video" },
  45: { inTrash: true },
  70: { files: [{ name: "a.jpg", type: "external" }], kind: "photo" },
  95: {
    kind: "photo",
    files: [{ name: "a.jpg" }, { name: "b.jpg" }],
  },
  110: {
    parent: {
      type: "data_source_id",
      data_source_id: OTHER_DATA_SOURCE_ID,
      database_id: OTHER_DATABASE_ID,
    },
  },
  118: { date: null },
};

function fixture121() {
  const pages = Array.from({ length: 121 }, (_, index) => {
    const n = index + 1;
    return buildPage(spec(n, INVALID[n] ?? {}));
  });
  return { pages, leakTrashedInQueries: true };
}

async function traverse(service: MemoryService) {
  const ids: string[] = [];
  let cursor: string | undefined;
  let batches = 0;
  do {
    const page = await service.listMemories({ cursor });
    batches += 1;
    ids.push(...page.items.map((item) => item.id));
    cursor = page.nextCursor ?? undefined;
    expect(batches).toBeLessThan(50);
  } while (cursor);
  return { ids, batches };
}

describe("schema verification", () => {
  it("accepts one database with exactly one matching data source", async () => {
    const { service } = setup({ pages: [buildPage(spec(1))] });
    const page = await service.listMemories({});
    expect(page.items).toHaveLength(1);
  });

  it("verifies once per instance and caches ids only", async () => {
    const { service, mock } = setup({ pages: [buildPage(spec(1))] });
    await service.listMemories({});
    await service.listMemories({});
    await service.getMemory(memoryId(1));
    expect(mock.counters.databasesRetrieve).toBe(1);
    expect(mock.counters.dataSourcesRetrieve).toBe(1);
    expect(mock.counters.dataSourcesQuery).toBe(2);
  });

  it("does not cache a failed verification", async () => {
    const { service, mock } = setup({ pages: [buildPage(spec(1))] });
    mock.failNext("databasesRetrieve", notionError({ status: 503 }));
    mock.failNext("databasesRetrieve", notionError({ status: 503 }));
    mock.failNext("databasesRetrieve", notionError({ status: 503 }));
    await rejection(service.listMemories({}));
    await expect(service.listMemories({})).resolves.toBeDefined();
  });

  it("requires SETUP_REQUIRED for two ambiguous data sources", async () => {
    const { service } = setup({
      database: buildDatabase({
        dataSourceIds: [DATA_SOURCE_ID, OTHER_DATA_SOURCE_ID],
      }),
      dataSources: [
        buildDataSource(),
        buildDataSource({ id: OTHER_DATA_SOURCE_ID }),
      ],
    });
    const error = await rejection(service.listMemories({}));
    expect(error.code).toBe("SETUP_REQUIRED");
  });

  it("requires SETUP_REQUIRED for a database without data sources", async () => {
    const { service } = setup({
      database: buildDatabase({ dataSourceIds: [] }),
    });
    expect((await rejection(service.listMemories({}))).code).toBe(
      "SETUP_REQUIRED",
    );
  });

  it("requires SETUP_REQUIRED for a trashed database or data source", async () => {
    const a = setup({ database: buildDatabase({ inTrash: true }) });
    expect((await rejection(a.service.listMemories({}))).code).toBe(
      "SETUP_REQUIRED",
    );
    const b = setup({ dataSources: [buildDataSource({ inTrash: true })] });
    expect((await rejection(b.service.listMemories({}))).code).toBe(
      "SETUP_REQUIRED",
    );
  });

  it.each([
    ["Kind", null],
    ["Media", "rich_text"],
    ["Memory date", "rich_text"],
    ["Caption", "number"],
    ["Text", "title"],
    ["Request ID", "number"],
    ["Width", "rich_text"],
    ["Height", null],
    ["Duration", "date"],
    ["Name", "rich_text"],
  ])("requires SETUP_REQUIRED when %s is %s", async (name, type) => {
    const { service, mock } = setup({
      dataSources: [buildDataSource({ overrides: { [name]: type } })],
    });
    const error = await rejection(service.listMemories({}));
    expect(error.code).toBe("SETUP_REQUIRED");
    expect(error.detail).toBe(`schema:${name}`);
    expect(mock.counters.dataSourcesQuery).toBe(0);
  });

  it("logs the failing property but never sends it to the client", async () => {
    const { service } = setup({
      dataSources: [buildDataSource({ overrides: { "Memory date": null } })],
    });
    const response = toErrorResponse(await rejection(service.listMemories({})));
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toContain("SETUP_REQUIRED");
    expect(body).not.toContain("Memory date");
    expect(body).not.toContain("schema");
    const logged: string[] = errorLog.mock.calls.map((call: unknown[]) =>
      String(call[0]),
    );
    expect(
      logged.some((line) => line.includes('"detail":"schema:Memory date"')),
    ).toBe(true);
  });

  it("rejects a configured database that is not the reachable one", async () => {
    const { service, mock } = setup({}, OTHER_DATABASE_ID);
    const error = await rejection(service.listMemories({}));
    expect(error.code).toBe("SETUP_REQUIRED");
    expect(mock.counters.dataSourcesQuery).toBe(0);
  });

  it("does not leak upstream details in the setup error", async () => {
    const { service } = setup({
      database: buildDatabase({ dataSourceIds: [] }),
    });
    const error = await rejection(service.listMemories({}));
    expect(JSON.stringify(error)).not.toContain(DATABASE_ID);
    expect(error.message).not.toContain(DATABASE_ID);
  });
});

describe("pagination over 121 records", () => {
  it("returns a first batch of 12 with an opaque next cursor", async () => {
    const { service } = setup(fixture121());
    const result = await service.listMemories({});
    expect(result.items).toHaveLength(12);
    expect(result.nextCursor).not.toBeNull();
    expect(JSON.stringify(result)).not.toContain("https://");
    expect(result.nextCursor).not.toContain("mock-cursor");
  });

  it("uses page_size 12 and the exact sorts, loading lazily", async () => {
    const { service, mock } = setup(fixture121());
    await service.listMemories({});
    expect(mock.counters.dataSourcesQuery).toBe(1);
    expect(mock.queries[0]).toMatchObject({
      data_source_id: DATA_SOURCE_ID,
      page_size: 12,
      sorts: [
        { property: "Memory date", direction: "descending" },
        { timestamp: "created_time", direction: "descending" },
      ],
    });
    expect(mock.queries[0].start_cursor ?? null).toBeNull();
  });

  it("traverses every valid record beyond 100 without eager loading", async () => {
    const { service, mock } = setup(fixture121());
    const { ids, batches } = await traverse(service);
    const expected = Array.from({ length: 121 }, (_, i) => i + 1)
      .filter((n) => !(n in INVALID))
      .map(memoryId);
    expect(ids).toEqual(expected);
    expect(ids).toContain(memoryId(121));
    expect(batches).toBe(11);
    expect(mock.counters.dataSourcesQuery).toBe(11);
  });

  it("sorts newest memory date first, then newest creation time", async () => {
    const same = "2026-05-05";
    const { service } = setup({
      pages: [
        buildPage({
          id: memoryId(1),
          date: same,
          createdTime: "2026-05-06T00:00:00.000Z",
        }),
        buildPage({
          id: memoryId(2),
          date: same,
          createdTime: "2026-05-07T00:00:00.000Z",
        }),
        buildPage({
          id: memoryId(3),
          date: "2026-06-01",
          createdTime: "2026-05-01T00:00:00.000Z",
        }),
      ],
    });
    const { items } = await service.listMemories({});
    expect(items.map((item) => item.id)).toEqual([
      memoryId(3),
      memoryId(2),
      memoryId(1),
    ]);
  });

  it("never exposes bearer URLs, ids of the database or file names", async () => {
    const { service } = setup(fixture121());
    const text =
      JSON.stringify((await traverse(service)).ids) +
      JSON.stringify(await service.listMemories({}));
    for (const forbidden of [
      "https://",
      "http://",
      DATABASE_ID,
      DATA_SOURCE_ID,
      "private-original-name",
      "secret",
      "sig=",
      "request",
    ]) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("maps each kind to its strict summary shape", async () => {
    const { service } = setup({
      pages: [
        buildPage(spec(3)),
        buildPage(spec(1, { text: "hola mundo" })),
        buildPage(spec(2)),
      ].map((page, i) => (i === 0 ? page : page)),
    });
    const { items } = await service.listMemories({});
    const byId = Object.fromEntries(items.map((item) => [item.id, item]));
    expect(byId[memoryId(1)]).toEqual({
      id: memoryId(1),
      kind: "text",
      text: "hola mundo",
      caption: "caption 1",
      memoryDate: dayOffset(1),
      createdAt: `${dayOffset(1)}T10:00:00.000Z`,
    });
    expect(byId[memoryId(3)]).toEqual({
      id: memoryId(3),
      kind: "photo",
      mediaPath: `/api/shoebox/memories/${memoryId(3)}/media`,
      width: 640,
      height: 480,
      caption: "caption 3",
      memoryDate: dayOffset(3),
      createdAt: `${dayOffset(3)}T10:00:00.000Z`,
    });
    expect(byId[memoryId(2)]).toEqual({
      id: memoryId(2),
      kind: "audio",
      mediaPath: `/api/shoebox/memories/${memoryId(2)}/media`,
      durationSeconds: 12.5,
      mimeType: "audio/webm",
      caption: "caption 2",
      memoryDate: dayOffset(2),
      createdAt: `${dayOffset(2)}T10:00:00.000Z`,
    });
  });

  it("returns an empty batch with a cursor when a whole batch is invalid", async () => {
    const bad = Array.from({ length: 12 }, (_, i) =>
      buildPage(spec(i + 1, { kind: "video" })),
    );
    const good = Array.from({ length: 5 }, (_, i) => buildPage(spec(i + 13)));
    const { service, mock } = setup({ pages: [...bad, ...good] });
    const first = await service.listMemories({});
    expect(first.items).toEqual([]);
    expect(first.nextCursor).not.toBeNull();
    expect(mock.counters.dataSourcesQuery).toBe(1);
    const second = await service.listMemories({
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    expect(mock.counters.dataSourcesQuery).toBe(2);
  });

  it("rejects an oversized or malformed cursor before any upstream call", async () => {
    const { service, mock } = setup(fixture121());
    for (const cursor of ["a".repeat(1_025), "!!not base64!!", "", "e30"]) {
      const error = await rejection(service.listMemories({ cursor }));
      expect(error.code).toBe("INVALID_INPUT");
      expect(error.status).toBe(400);
    }
    expect(mock.total()).toBe(0);
  });

  it("does not turn a raw Notion cursor into an accepted cursor", async () => {
    const { service } = setup(fixture121());
    const error = await rejection(
      service.listMemories({ cursor: "mock-cursor-12" }),
    );
    expect(error.code).toBe("INVALID_INPUT");
  });
});

describe("record validation", () => {
  const cases: [string, Partial<PageSpec>][] = [
    ["invalid kind", { kind: "video" }],
    ["missing kind", { kind: null }],
    ["trashed", { inTrash: true }],
    [
      "wrong data source",
      {
        parent: {
          type: "data_source_id",
          data_source_id: OTHER_DATA_SOURCE_ID,
          database_id: DATABASE_ID,
        },
      },
    ],
    ["page parent", { parent: { type: "page_id", page_id: memoryId(9) } }],
    [
      "external attachment",
      {
        kind: "photo",
        files: [{ name: "a.jpg", type: "external" }],
      },
    ],
    ["photo without file", { kind: "photo", files: [] }],
    [
      "photo with two files",
      {
        kind: "photo",
        files: [{ name: "a.jpg" }, { name: "b.jpg" }],
      },
    ],
    ["audio without file", { kind: "audio", files: [] }],
    ["text with a file", { kind: "text", files: [{ name: "a.jpg" }] }],
    [
      "photo with a non-jpeg file",
      {
        kind: "photo",
        files: [{ name: "a.png" }],
      },
    ],
    [
      "audio with an unknown extension",
      {
        kind: "audio",
        files: [{ name: "a.exe" }],
      },
    ],
    ["missing date", { date: null }],
    ["date with time", { date: "2026-10-21T10:00:00.000Z" }],
    ["impossible date", { date: "2026-02-30" }],
    ["date range", { dateExtra: { end: "2026-10-22" } }],
    ["empty text", { kind: "text", text: [] }],
    ["text over 2,000 code points", { kind: "text", text: "x".repeat(2_001) }],
    ["caption over 500 code points", { caption: "y".repeat(501) }],
    ["photo without width", { kind: "photo", width: null }],
    ["photo with NaN height", { kind: "photo", height: Number.NaN }],
    ["photo with zero width", { kind: "photo", width: 0 }],
    ["photo wider than 2,048", { kind: "photo", width: 4_096 }],
    ["photo with fractional width", { kind: "photo", width: 10.5 }],
    ["audio without duration", { kind: "audio", duration: null }],
    ["audio with zero duration", { kind: "audio", duration: 0 }],
    ["audio longer than 60 s", { kind: "audio", duration: 61 }],
    ["audio with infinite duration", { kind: "audio", duration: Infinity }],
    ["invalid id", { id: "not-a-uuid" }],
  ];

  it.each(cases)(
    "omits %s without exposing raw errors",
    async (_name, over) => {
      const valid = buildPage(spec(1));
      const { service } = setup({
        pages: [valid, buildPage(spec(2, over))],
        leakTrashedInQueries: true,
      });
      const { items } = await service.listMemories({});
      expect(items.map((item) => item.id)).toEqual([memoryId(1)]);
      expect(errorLog).not.toHaveBeenCalled();
    },
  );

  it("counts caption and text in code points, not UTF-16 units", async () => {
    const emoji = "😀".repeat(2_000);
    const caption = "😀".repeat(500);
    const { service } = setup({
      pages: [buildPage(spec(1, { kind: "text", text: emoji, caption }))],
    });
    const { items } = await service.listMemories({});
    expect(items).toHaveLength(1);
  });

  it("joins multi-chunk rich text back into one string", async () => {
    const { service } = setup({
      pages: [buildPage(spec(1, { kind: "text", text: ["ab", "cd", "ef"] }))],
    });
    const { items } = await service.listMemories({});
    expect(items[0]).toMatchObject({ text: "abcdef" });
  });
});

describe("rich text chunking", () => {
  const codePoints = (value: string) => [...value].length;

  it("returns no chunks for an empty string", () => {
    expect(splitRichText("")).toEqual([]);
  });

  it("keeps short text as one chunk shaped for the Notion API", () => {
    expect(splitRichText("hola")).toEqual([
      { type: "text", text: { content: "hola" } },
    ]);
  });

  it.each([
    ["ascii 2,000", "a".repeat(2_000)],
    ["emoji 2,000", "😀".repeat(2_000)],
    ["mixed", `${"é".repeat(999)}😀${"z".repeat(999)}😀😀`],
    ["exactly 1,000", "b".repeat(1_000)],
    ["1,001", "c".repeat(1_001)],
  ])("round-trips %s within both limits", (_name, text) => {
    const chunks = splitRichText(text);
    expect(chunks.map((chunk) => chunk.text.content).join("")).toBe(text);
    for (const chunk of chunks) {
      expect(codePoints(chunk.text.content)).toBeLessThanOrEqual(1_000);
      expect(chunk.text.content.length).toBeLessThanOrEqual(2_000);
      expect(chunk.text.content.length).toBeGreaterThan(0);
      // never a lone surrogate
      expect(chunk.text.content.isWellFormed()).toBe(true);
    }
  });

  it("splits 2,000 emoji into exactly two 1,000 code point chunks", () => {
    const chunks = splitRichText("😀".repeat(2_000));
    expect(chunks).toHaveLength(2);
    expect(chunks.every((chunk) => chunk.text.content.length === 2_000)).toBe(
      true,
    );
  });

  it("round-trips through the service reader", async () => {
    const text = `${"😀".repeat(1_500)}fin`;
    const chunks = splitRichText(text).map((chunk) => chunk.text.content);
    const { service } = setup({
      pages: [buildPage(spec(1, { kind: "text", text: chunks }))],
    });
    const { items } = await service.listMemories({});
    expect(items[0]).toMatchObject({ text });
  });
});

describe("gateway retries and bounds", () => {
  const query = { data_source_id: DATA_SOURCE_ID, page_size: 12 };

  it("honors Retry-After and succeeds on the third attempt", async () => {
    const { gateway, mock, time } = setup();
    mock.failNext(
      "dataSourcesQuery",
      notionError({ status: 429, code: "rate_limited", retryAfter: "2" }),
      notionError({ status: 429, code: "rate_limited", retryAfter: "3" }),
    );
    await expect(gateway.queryDataSource(query)).resolves.toBeDefined();
    expect(mock.counters.dataSourcesQuery).toBe(3);
    expect(time.sleeps).toEqual([2_000, 3_000]);
  });

  it("makes at most three attempts for a read", async () => {
    const { gateway, mock } = setup();
    mock.failNext(
      "dataSourcesQuery",
      ...[1, 2, 3, 4].map(() =>
        notionError({ status: 429, code: "rate_limited", retryAfter: "1" }),
      ),
    );
    const error = await rejection(gateway.queryDataSource(query));
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.status).toBe(429);
    expect(mock.counters.dataSourcesQuery).toBe(3);
  });

  it("uses a bounded jitter delay when Retry-After is absent", async () => {
    const { gateway, mock, time } = setup();
    mock.failNext("dataSourcesQuery", notionError({ status: 429 }));
    await gateway.queryDataSource(query);
    expect(time.sleeps).toHaveLength(1);
    expect(time.sleeps[0]).toBeGreaterThan(0);
    expect(time.sleeps[0]).toBeLessThanOrEqual(5_000);
  });

  it("returns a bounded retry hint instead of sleeping past the budget", async () => {
    const { gateway, mock, time } = setup();
    mock.failNext(
      "dataSourcesQuery",
      notionError({ status: 429, code: "rate_limited", retryAfter: "3600" }),
    );
    const error = await rejection(gateway.queryDataSource(query));
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(error.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(time.sleeps).toEqual([]);
    expect(mock.counters.dataSourcesQuery).toBe(1);
  });

  it("returns 503 with a hint for an overloaded service past the budget", async () => {
    const { gateway, mock } = setup();
    mock.failNext(
      "dataSourcesQuery",
      notionError({ status: 529, code: "service_overload", retryAfter: "900" }),
    );
    const error = await rejection(gateway.queryDataSource(query));
    expect(error.code).toBe("UNAVAILABLE");
    expect(error.status).toBe(503);
    expect(error.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it.each([500, 502, 503, 504])("retries a read after %i", async (status) => {
    const { gateway, mock } = setup({ pages: [buildPage(spec(1))] });
    mock.failNext("pagesRetrieve", notionError({ status }));
    await expect(
      gateway.retrievePage({ page_id: memoryId(1) }),
    ).resolves.toBeDefined();
    expect(mock.counters.pagesRetrieve).toBe(2);
  });

  it("treats the query POST as a safe read but never create-page", async () => {
    const { gateway, mock } = setup();
    mock.failNext("dataSourcesQuery", notionError({ status: 503 }));
    await gateway.queryDataSource(query);
    expect(mock.counters.dataSourcesQuery).toBe(2);

    mock.failNext("pagesCreate", notionError({ status: 503 }));
    const error = await rejection(
      gateway.createPage({ parent: { data_source_id: DATA_SOURCE_ID } }),
    );
    expect(mock.counters.pagesCreate).toBe(1);
    expect(error.code).toBe("OUTCOME_UNKNOWN");
  });

  it("does not repeat an ambiguous write after 5xx or a thrown transport error", async () => {
    const { gateway, mock } = setup({ pages: [buildPage(spec(1))] });
    mock.failNext("pagesUpdate", notionError({ status: 500 }));
    expect(
      (await rejection(gateway.updatePage({ page_id: memoryId(1) }))).code,
    ).toBe("OUTCOME_UNKNOWN");
    mock.failNext("pagesUpdate", new TypeError("socket hang up"));
    expect(
      (await rejection(gateway.updatePage({ page_id: memoryId(1) }))).code,
    ).toBe("OUTCOME_UNKNOWN");
    expect(mock.counters.pagesUpdate).toBe(2);
  });

  it("retries an explicit 429 or 529 for a write", async () => {
    const { gateway, mock } = setup({ pages: [buildPage(spec(1))] });
    mock.failNext(
      "pagesUpdate",
      notionError({ status: 429, retryAfter: "1" }),
      notionError({ status: 529, retryAfter: "1" }),
    );
    await expect(
      gateway.updatePage({ page_id: memoryId(1), in_trash: true }),
    ).resolves.toBeDefined();
    expect(mock.counters.pagesUpdate).toBe(3);
  });

  it.each([
    [
      "public_api_request_blocked 403",
      403,
      "restricted_resource",
      "public_api_request_blocked",
    ],
    ["block_creation 403", 403, "restricted_resource", "block_creation"],
    [
      "public_api_request_blocked 429",
      429,
      "rate_limited",
      "public_api_request_blocked",
    ],
    ["unauthorized 401", 401, "unauthorized", "{}"],
  ])("does not retry %s", async (_name, status, code, body) => {
    const { gateway, mock } = setup();
    mock.failNext(
      "dataSourcesQuery",
      notionError({
        status,
        code,
        body: `{"code":"${body}"}`,
        retryAfter: "1",
      }),
    );
    const error = await rejection(gateway.queryDataSource(query));
    expect(mock.counters.dataSourcesQuery).toBe(1);
    expect(["SETUP_REQUIRED", "UNAVAILABLE", "RATE_LIMITED"]).toContain(
      error.code,
    );
  });

  it("maps a missing object to NOT_FOUND", async () => {
    const { gateway } = setup();
    const error = await rejection(
      gateway.retrievePage({ page_id: memoryId(7) }),
    );
    expect(error.code).toBe("NOT_FOUND");
  });

  it("sanitizes every error: no upstream message, body, ids or urls", async () => {
    const { gateway, mock } = setup();
    mock.failNext(
      "dataSourcesQuery",
      notionError({
        status: 400,
        code: "validation_error",
        body: `{"message":"https://secret.example/${DATABASE_ID}"}`,
      }),
    );
    const error = await rejection(gateway.queryDataSource(query));
    const dump = JSON.stringify({
      message: error.message,
      detail: error.detail,
      code: error.code,
    });
    expect(dump).not.toContain("SECRET-DETAIL");
    expect(dump).not.toContain("secret.example");
    expect(dump).not.toContain(DATABASE_ID);
    expect(error.cause).toBeUndefined();
  });

  it("stops before any call when already aborted", async () => {
    const { gateway, mock } = setup();
    const controller = new AbortController();
    controller.abort();
    const error = await rejection(
      gateway.queryDataSource(query, { signal: controller.signal }),
    );
    expect(error.code).toBe("UNAVAILABLE");
    expect(mock.counters.dataSourcesQuery).toBe(0);
  });

  it("stops retrying when aborted during the retry wait", async () => {
    const controller = new AbortController();
    const mock = createMockNotion();
    const gateway = createNotionGateway({
      client: mock.client,
      clock: () => 0,
      sleep: async () => controller.abort(),
      random: () => 0.5,
    });
    mock.failNext(
      "dataSourcesQuery",
      notionError({ status: 429, retryAfter: "1" }),
    );
    const error = await rejection(
      gateway.queryDataSource(query, { signal: controller.signal }),
    );
    expect(error.code).toBe("UNAVAILABLE");
    expect(mock.counters.dataSourcesQuery).toBe(1);
  });

  it("enforces the read deadline on a hung upstream", async () => {
    const mock = createMockNotion();
    const gateway = createNotionGateway({
      client: mock.client,
      deadlines: { readMs: 25, writeMs: 50 },
    });
    mock.hangNext("dataSourcesQuery");
    const error = await rejection(gateway.queryDataSource(query));
    expect(error.code).toBe("UNAVAILABLE");
    expect(mock.counters.dataSourcesQuery).toBe(1);
  });

  it("reports an unknown outcome when a write hits its deadline", async () => {
    const mock = createMockNotion({ pages: [buildPage(spec(1))] });
    const gateway = createNotionGateway({
      client: mock.client,
      deadlines: { readMs: 25, writeMs: 25 },
    });
    mock.hangNext("pagesUpdate");
    const error = await rejection(gateway.updatePage({ page_id: memoryId(1) }));
    expect(error.code).toBe("OUTCOME_UNKNOWN");
    expect(mock.counters.pagesUpdate).toBe(1);
  });

  it("allows at most two concurrent gateway operations per instance", async () => {
    const mock = createMockNotion();
    let inFlight = 0;
    let peak = 0;
    const releases: (() => void)[] = [];
    const client: NotionClientLike = {
      ...mock.client,
      dataSources: {
        ...mock.client.dataSources,
        query: async (args) => {
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await new Promise<void>((resolve) => releases.push(resolve));
          inFlight -= 1;
          return mock.client.dataSources.query(args);
        },
      },
    };
    const gateway = createNotionGateway({ client });
    const calls = [1, 2, 3, 4].map(() => gateway.queryDataSource(query));
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    expect(peak).toBe(2);
    for (const release of releases.splice(0)) release();
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    expect(peak).toBe(2);
    for (const release of releases.splice(0)) release();
    await Promise.all(calls);
    expect(peak).toBe(2);
  });

  it("releases its slot after a failure", async () => {
    const mock = createMockNotion();
    const gateway = createNotionGateway({ client: mock.client });
    for (let i = 0; i < 5; i += 1) {
      mock.failNext("dataSourcesQuery", notionError({ status: 400 }));
      await rejection(gateway.queryDataSource(query));
    }
    await expect(gateway.queryDataSource(query)).resolves.toBeDefined();
  });
});

describe("SDK client construction", () => {
  it("pins the API version, disables SDK retries and sends the bearer", async () => {
    const calls: { url: string; headers: Headers }[] = [];
    const fetchStub = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, headers: new Headers(init?.headers) });
        return new Response(JSON.stringify({ code: "rate_limited" }), {
          status: 429,
          headers: { "retry-after": "1", "content-type": "application/json" },
        });
      },
    );
    const client = createSdkClient("synthetic-key", fetchStub);
    await expect(
      client.dataSources.query({ data_source_id: DATA_SOURCE_ID }),
    ).rejects.toBeDefined();
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(calls[0].headers.get("notion-version")).toBe("2026-03-11");
    expect(calls[0].headers.get("authorization")).toBe("Bearer synthetic-key");
  });
});
