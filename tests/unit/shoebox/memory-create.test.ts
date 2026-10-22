import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OPTIONS as listOptions,
  POST as listPost,
  PUT as listPut,
} from "@/app/api/shoebox/memories/route";
import { ShoeboxError } from "@/features/shoebox/server/errors";
import type { ValidatedMedia } from "@/features/shoebox/server/media-validation";
import { validateMedia } from "@/features/shoebox/server/media-validation";
import { createMemoryHandlers } from "@/features/shoebox/server/memory-handlers";
import {
  type CreateInput,
  createMemoryService,
} from "@/features/shoebox/server/memory-service";
import {
  createNotionGateway,
  createSdkClient,
} from "@/features/shoebox/server/notion-gateway";
import type { MemorySummary } from "@/types/shoebox";
import { fixtureBytes, fixtureFile } from "../../helpers/mock-media";
import {
  buildPage,
  createMockNotion,
  DATA_SOURCE_ID,
  DATABASE_ID,
  type MockNotionOptions,
  memoryId,
  notionError,
} from "../../helpers/mock-notion";
import { FAKE_APP_ORIGIN, SAFE_ENV } from "../../helpers/safe-env";
import { multipartRequest } from "../../helpers/shoebox-fixtures";

const REQUEST_ID = "7c0ffee0-1111-4a2b-8c3d-000000000001";
const OTHER_ID = "7c0ffee0-1111-4a2b-8c3d-000000000002";
const NOW = Date.UTC(2026, 9, 21, 12, 0, 0);

let errorLog: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const textInput: CreateInput = {
  requestId: REQUEST_ID,
  kind: "text",
  text: "una nota sintética",
  caption: "pie sintético",
  memoryDate: "2026-10-20",
};

function photoMedia(overrides: Partial<ValidatedMedia> = {}): ValidatedMedia {
  return {
    bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]),
    mimeType: "image/jpeg",
    filename: "memory.jpg",
    width: 640,
    height: 480,
    ...overrides,
  };
}

function audioMedia(overrides: Partial<ValidatedMedia> = {}): ValidatedMedia {
  return {
    bytes: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 9, 9]),
    mimeType: "audio/webm",
    filename: "memory.weba",
    durationSeconds: 2.0015,
    ...overrides,
  };
}

const photoInput = (media = photoMedia()): CreateInput => ({
  requestId: REQUEST_ID,
  kind: "photo",
  caption: "",
  memoryDate: "2026-10-21",
  media,
});

const audioInput = (media = audioMedia()): CreateInput => ({
  requestId: REQUEST_ID,
  kind: "audio",
  caption: "voz",
  memoryDate: "2026-10-21",
  media,
});

type SetupOptions = MockNotionOptions & {
  clock?: () => number;
  writeMs?: number;
  readMs?: number;
};

function setup(options: SetupOptions = {}) {
  const clock = options.clock ?? (() => NOW);
  const mock = createMockNotion({ now: clock, ...options });
  const sleep = vi.fn(async () => undefined);
  const gateway = createNotionGateway({
    client: mock.client,
    clock,
    sleep,
    random: () => 0,
    deadlines: {
      readMs: options.readMs ?? 15_000,
      writeMs: options.writeMs ?? 45_000,
    },
  });
  const service = createMemoryService(gateway, {
    databaseId: DATABASE_ID,
    clock,
  });
  return { mock, service, gateway, sleep };
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

const writeCount = (mock: ReturnType<typeof createMockNotion>) =>
  mock.counters.pagesCreate +
  mock.counters.pagesUpdate +
  mock.counters.fileUploadsCreate +
  mock.counters.fileUploadsSend +
  mock.counters.fileUploadsComplete;

describe("service: create text", () => {
  it("replays the same Request ID without a second write or any upload", async () => {
    const { mock: fakeNotion, service } = setup();
    const input = textInput;
    const first = await service.createMemory(input);
    const replay = await service.createMemory(input);
    expect(first.replayed).toBe(false);
    expect(replay).toEqual({ memory: first.memory, replayed: true });
    expect(fakeNotion.pageCreateCalls).toHaveLength(1);
    expect(fakeNotion.fileUploadCalls).toHaveLength(0);
    expect(fakeNotion.fileSendCalls).toHaveLength(0);
  });

  it("writes the exact schema values in one page create", async () => {
    const { mock, service } = setup();
    const { memory } = await service.createMemory(textInput);
    expect(mock.pageCreateCalls).toHaveLength(1);
    const call = mock.pageCreateCalls[0];
    expect(call.parent).toEqual({ data_source_id: DATA_SOURCE_ID });
    expect(Object.keys(call).sort()).toEqual(["parent", "properties"]);
    expect(call.properties).toEqual({
      Name: { title: [{ type: "text", text: { content: "Recuerdo text" } }] },
      Kind: { select: { name: "text" } },
      "Memory date": { date: { start: "2026-10-20" } },
      Caption: {
        rich_text: [{ type: "text", text: { content: "pie sintético" } }],
      },
      Text: {
        rich_text: [{ type: "text", text: { content: "una nota sintética" } }],
      },
      Media: { files: [] },
      "Request ID": {
        rich_text: [{ type: "text", text: { content: REQUEST_ID } }],
      },
    });
    expect(memory).toEqual({
      id: memoryId(9_001),
      kind: "text",
      text: "una nota sintética",
      caption: "pie sintético",
      memoryDate: "2026-10-20",
      createdAt: new Date(NOW).toISOString(),
    });
  });

  it("never puts private text into the generated Name", async () => {
    const { mock, service } = setup();
    await service.createMemory({ ...textInput, text: "secreto-nombre" });
    expect(
      JSON.stringify(mock.pageCreateCalls[0].properties?.Name),
    ).not.toContain("secreto");
  });

  it("chunks long emoji text and empty captions round-trip", async () => {
    const { mock, service } = setup();
    const text = `${"🐟".repeat(1_500)}fin`;
    const { memory } = await service.createMemory({
      ...textInput,
      text,
      caption: "",
    });
    const props = mock.pageCreateCalls[0].properties ?? {};
    const chunks = (
      props.Text as { rich_text: { text: { content: string } }[] }
    ).rich_text;
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.content.length).toBeLessThanOrEqual(2_000);
    }
    expect(props.Caption).toEqual({ rich_text: [] });
    expect(memory).toMatchObject({ kind: "text", text, caption: "" });
  });

  it("queries the Request ID with an exact filter and a small cap before writing", async () => {
    const { mock, service } = setup();
    await service.createMemory(textInput);
    const reconcile = mock.queries.find((query) => query.filter);
    expect(reconcile).toBeDefined();
    expect(reconcile?.filter).toEqual({
      property: "Request ID",
      rich_text: { equals: REQUEST_ID },
    });
    expect(reconcile?.page_size).toBeGreaterThanOrEqual(2);
    expect(reconcile?.page_size).toBeLessThanOrEqual(5);
  });

  it("ignores a looser upstream match whose stored ID differs in case", async () => {
    const { mock, service } = setup({
      pages: [
        buildPage({
          id: memoryId(1),
          kind: "text",
          text: "otra cosa",
          requestId: REQUEST_ID.toUpperCase(),
        }),
      ],
    });
    const result = await service.createMemory(textInput);
    expect(result.replayed).toBe(false);
    expect(mock.pageCreateCalls).toHaveLength(1);
  });
});

describe("service: create photo and audio", () => {
  it("creates an upload, sends the binary, then attaches it in one page create", async () => {
    const { mock, service } = setup();
    const media = photoMedia();
    const { memory, replayed } = await service.createMemory(photoInput(media));
    expect(replayed).toBe(false);
    expect(mock.fileUploadCalls).toEqual([
      {
        mode: "single_part",
        filename: "memory.jpg",
        content_type: "image/jpeg",
      },
    ]);
    expect(mock.fileSendCalls).toHaveLength(1);
    const send = mock.fileSendCalls[0];
    const uploadId = [...mock.uploads.keys()][0];
    expect(send.file_upload_id).toBe(uploadId);
    expect(send.filename).toBe("memory.jpg");
    expect(send.type).toBe("image/jpeg");
    expect([...send.bytes]).toEqual([...media.bytes]);
    expect(mock.counters.fileUploadsComplete).toBe(0);

    expect(mock.pageCreateCalls).toHaveLength(1);
    const props = mock.pageCreateCalls[0].properties ?? {};
    expect(props.Media).toEqual({
      files: [
        {
          type: "file_upload",
          file_upload: { id: uploadId },
          name: "memory.jpg",
        },
      ],
    });
    expect(props.Width).toEqual({ number: 640 });
    expect(props.Height).toEqual({ number: 480 });
    expect(props.Duration).toBeUndefined();
    expect(props.Text).toEqual({ rich_text: [] });
    expect(props.Name).toEqual({
      title: [{ type: "text", text: { content: "Recuerdo photo" } }],
    });
    expect(memory).toEqual({
      id: memoryId(9_002),
      kind: "photo",
      caption: "",
      memoryDate: "2026-10-21",
      createdAt: new Date(NOW).toISOString(),
      mediaPath: `/api/shoebox/memories/${memoryId(9_002)}/media`,
      width: 640,
      height: 480,
    });
  });

  it("stores WebM audio as memory.weba so reads map it back to audio/webm", async () => {
    const { mock, service } = setup();
    const { memory } = await service.createMemory(audioInput());
    expect(mock.fileUploadCalls[0]).toEqual({
      mode: "single_part",
      filename: "memory.weba",
      content_type: "audio/webm",
    });
    const props = mock.pageCreateCalls[0].properties ?? {};
    expect(props.Duration).toEqual({ number: 2.0015 });
    expect(props.Width).toBeUndefined();
    expect(props.Height).toBeUndefined();
    expect(memory).toMatchObject({
      kind: "audio",
      durationSeconds: 2.0015,
      mimeType: "audio/webm",
    });
    expect(memory).not.toHaveProperty("url");
  });

  it("replays a media create without uploading the file again", async () => {
    const { mock, service } = setup();
    const first = await service.createMemory(photoInput());
    const replay = await service.createMemory(photoInput());
    expect(replay).toEqual({ memory: first.memory, replayed: true });
    expect(mock.fileUploadCalls).toHaveLength(1);
    expect(mock.fileSendCalls).toHaveLength(1);
    expect(mock.pageCreateCalls).toHaveLength(1);
  });

  it("refuses to attach an upload whose one-hour expiry has passed", async () => {
    let now = NOW;
    const { mock, service } = setup({ clock: () => now });
    const original = mock.client.fileUploads.send;
    mock.client.fileUploads.send = async (args) => {
      const result = await original(args);
      now += 3_600_001; // the attach would land after Notion's expiry
      return result;
    };
    const error = await rejection(service.createMemory(photoInput()));
    expect(error.code).toBe("UNAVAILABLE");
    expect(mock.pageCreateCalls).toHaveLength(0);
  });

  it("honours Notion's reported expiry_time with a safety margin, inside the request budget", async () => {
    let now = NOW;
    // Notion reports expiry 90 s after creation; 31 s later only 59 s remain,
    // under the one-minute margin, while the create budget is still open.
    const { mock, service } = setup({
      clock: () => now,
      uploadLifetimeMs: 90_000,
    });
    const original = mock.client.fileUploads.send;
    mock.client.fileUploads.send = async (args) => {
      const result = await original(args);
      now += 31_000;
      return result;
    };
    const error = await rejection(service.createMemory(photoInput()));
    expect(error).toMatchObject({
      code: "UNAVAILABLE",
      detail: "upload_expired",
    });
    expect(mock.pageCreateCalls).toHaveLength(0);
  });

  it("attaches within the hour exactly once", async () => {
    let now = NOW;
    const { mock, service } = setup({ clock: () => now });
    const original = mock.client.fileUploads.send;
    mock.client.fileUploads.send = async (args) => {
      const result = await original(args);
      now += 5_000;
      return result;
    };
    await service.createMemory(photoInput());
    expect(mock.pageCreateCalls).toHaveLength(1);
    const upload = [...mock.uploads.values()][0];
    expect(upload.attached).toBe(true);
    expect(now - upload.createdMs).toBeLessThan(3_600_000);
  });

  it("treats a send that reports an expired or failed upload as a safe failure", async () => {
    const { mock, service } = setup();
    const original = mock.client.fileUploads.send;
    mock.client.fileUploads.send = async (args) => ({
      ...(await original(args)),
      status: "failed",
    });
    const error = await rejection(service.createMemory(photoInput()));
    expect(error.code).toBe("UNAVAILABLE");
    expect(mock.pageCreateCalls).toHaveLength(0);
  });

  it("maps Notion rejecting an expired upload at attach time to a safe failure, once", async () => {
    const { mock, service } = setup();
    const original = mock.client.fileUploads.send;
    mock.client.fileUploads.send = async (args) => {
      const result = await original(args);
      mock.expireUploads();
      return result;
    };
    const error = await rejection(service.createMemory(photoInput()));
    expect(error.code).toBe("UNAVAILABLE");
    expect(mock.pageCreateCalls).toHaveLength(1);
    expect(mock.pages.size).toBe(0);
  });

  it.each([
    ["create 500", "fileUploadsCreate", notionError({ status: 500 })],
    ["create transport", "fileUploadsCreate", new TypeError("socket hang up")],
    ["send 503", "fileUploadsSend", notionError({ status: 503 })],
    ["send transport", "fileUploadsSend", new TypeError("socket hang up")],
    [
      "send 400",
      "fileUploadsSend",
      notionError({ status: 400, code: "validation_error" }),
    ],
  ] as const)(
    "an upload %s failure is a safe UNAVAILABLE with no page and no repeat",
    async (_label, method, failure) => {
      const { mock, service } = setup();
      mock.failNext(method, failure);
      const error = await rejection(service.createMemory(photoInput()));
      expect(error.code).toBe("UNAVAILABLE");
      expect(error.status).toBe(503);
      expect(mock.counters[method]).toBe(1);
      expect(mock.pageCreateCalls).toHaveLength(0);
    },
  );

  it("retries an explicit 429 on upload create and still attaches once", async () => {
    const { mock, service } = setup();
    mock.failNext(
      "fileUploadsCreate",
      notionError({ status: 429, retryAfter: "1" }),
    );
    const result = await service.createMemory(photoInput());
    expect(result.replayed).toBe(false);
    expect(mock.counters.fileUploadsCreate).toBe(2);
    expect(mock.pageCreateCalls).toHaveLength(1);
  });

  it("surfaces a long Retry-After on upload as RATE_LIMITED without a page", async () => {
    const { mock, service } = setup();
    mock.failNext(
      "fileUploadsCreate",
      notionError({ status: 429, retryAfter: "120" }),
    );
    const error = await rejection(service.createMemory(photoInput()));
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryAfterSeconds).toBeGreaterThan(0);
    expect(mock.pageCreateCalls).toHaveLength(0);
  });
});

describe("service: page create failures and reconciliation", () => {
  it.each([429, 529])(
    "retries an explicit %i on page create (never committed)",
    async (status) => {
      const { mock, service } = setup();
      mock.failNext("pagesCreate", notionError({ status, retryAfter: "1" }));
      const result = await service.createMemory(textInput);
      expect(result.replayed).toBe(false);
      expect(mock.counters.pagesCreate).toBe(2);
      expect(mock.pages.size).toBe(1);
    },
  );

  it("returns RATE_LIMITED, not unknown, when a 429 wait exceeds the budget", async () => {
    const { mock, service } = setup();
    mock.failNext(
      "pagesCreate",
      notionError({ status: 429, retryAfter: "120" }),
    );
    const error = await rejection(service.createMemory(textInput));
    expect(error.code).toBe("RATE_LIMITED");
    expect(mock.counters.pagesCreate).toBe(1);
  });

  it("reads the committed resource id from a 503 and returns the saved record", async () => {
    const { mock, service } = setup();
    mock.failAfterCommit("pagesCreate", () =>
      notionError({
        status: 503,
        code: "service_unavailable",
        additionalData: {
          committed_resource_id: memoryId(9_001),
          retry_guidance: "Do not repeat the write.",
        },
      }),
    );
    const result = await service.createMemory(textInput);
    expect(result).toEqual({
      memory: expect.objectContaining({ id: memoryId(9_001), kind: "text" }),
      replayed: false,
    });
    expect(mock.counters.pagesCreate).toBe(1);
    expect(mock.counters.pagesRetrieve).toBe(1);
  });

  it("ignores a committed id that is not a member and falls back to the Request ID", async () => {
    const { mock, service } = setup({
      pages: [buildPage({ id: memoryId(77), kind: "text", text: "ajeno" })],
    });
    mock.failAfterCommit("pagesCreate", () =>
      notionError({
        status: 503,
        additionalData: { committed_resource_id: memoryId(77) },
      }),
    );
    const result = await service.createMemory(textInput);
    expect(result.memory.id).toBe(memoryId(9_001));
    expect(result.memory).toMatchObject({ text: textInput.text });
  });

  it.each([
    ["504", () => notionError({ status: 504, code: "gateway_timeout" })],
    ["500", () => notionError({ status: 500 })],
    ["transport", () => new TypeError("socket hang up")],
  ])(
    "finds a committed create by Request ID after a %s",
    async (_label, failure) => {
      const { mock, service } = setup();
      mock.failAfterCommit("pagesCreate", failure);
      const result = await service.createMemory(textInput);
      expect(result.replayed).toBe(false);
      expect(result.memory.id).toBe(memoryId(9_001));
      expect(mock.counters.pagesCreate).toBe(1);
    },
  );

  it("finds a committed create after a deadline timeout", async () => {
    const { mock, service } = setup({ writeMs: 20 });
    mock.failAfterCommit("pagesCreate", "hang");
    const result = await service.createMemory(textInput);
    expect(result.memory.id).toBe(memoryId(9_001));
    expect(mock.counters.pagesCreate).toBe(1);
  });

  it("returns OUTCOME_UNKNOWN (never repeating the create) when nothing is found", async () => {
    const { mock, service } = setup();
    mock.failNext("pagesCreate", notionError({ status: 500 }));
    const error = await rejection(service.createMemory(textInput));
    expect(error.code).toBe("OUTCOME_UNKNOWN");
    expect(error.status).toBe(202);
    expect(mock.counters.pagesCreate).toBe(1);
  });

  it("returns OUTCOME_UNKNOWN after a timeout before commit", async () => {
    const { mock, service } = setup({ writeMs: 20 });
    mock.hangNext("pagesCreate");
    const error = await rejection(service.createMemory(textInput));
    expect(error.code).toBe("OUTCOME_UNKNOWN");
    expect(mock.counters.pagesCreate).toBe(1);
  });

  it("returns OUTCOME_UNKNOWN when the reconciliation read itself fails", async () => {
    const { mock, service } = setup();
    // First query is the pre-write check; then every reconciliation read fails.
    mock.failAfterCommit("pagesCreate", () => notionError({ status: 502 }));
    const originalQuery = mock.client.dataSources.query;
    let calls = 0;
    mock.client.dataSources.query = async (args) => {
      calls += 1;
      if (calls > 1)
        throw notionError({ status: 400, code: "validation_error" });
      return originalQuery(args);
    };
    const error = await rejection(service.createMemory(textInput));
    expect(error.code).toBe("OUTCOME_UNKNOWN");
    expect(mock.counters.pagesCreate).toBe(1);
  });

  it("does not let a later same-ID request auto-repeat after an unknown outcome", async () => {
    const { mock, service } = setup();
    mock.failAfterCommit("pagesCreate", () => notionError({ status: 500 }));
    // Reconciliation cannot see it yet (eventual consistency).
    const originalQuery = mock.client.dataSources.query;
    let hide = true;
    mock.client.dataSources.query = async (args) => {
      const response = await originalQuery(args);
      return hide ? { ...response, results: [] } : response;
    };
    expect((await rejection(service.createMemory(textInput))).code).toBe(
      "OUTCOME_UNKNOWN",
    );
    hide = false;
    const retry = await service.createMemory(textInput);
    expect(retry.replayed).toBe(true);
    expect(mock.counters.pagesCreate).toBe(1);
  });

  it("never returns an upload/page outcome with upstream ids, URLs or names", async () => {
    const { mock, service } = setup();
    const result = await service.createMemory(photoInput());
    const json = JSON.stringify(result);
    expect(json).not.toMatch(
      /notion\.test|sig=|f17e0000|memory\.jpg|Request|7c0ffee0/,
    );
    expect(mock.pageCreateCalls).toHaveLength(1);
  });
});

describe("service: conflicts and duplicates", () => {
  it.each([
    ["text", { text: "otra nota" }],
    ["date", { memoryDate: "2026-10-19" }],
    ["caption", { caption: "otro pie" }],
  ])(
    "rejects a reused ID with a different %s as REQUEST_CONFLICT",
    async (_label, change) => {
      const { mock, service } = setup();
      await service.createMemory(textInput);
      const error = await rejection(
        service.createMemory({ ...textInput, ...change } as CreateInput),
      );
      expect(error.code).toBe("REQUEST_CONFLICT");
      expect(error.status).toBe(409);
      expect(mock.pageCreateCalls).toHaveLength(1);
    },
  );

  it("rejects a reused ID with a different kind before any upload", async () => {
    const { mock, service } = setup();
    await service.createMemory(textInput);
    const error = await rejection(service.createMemory(photoInput()));
    expect(error.code).toBe("REQUEST_CONFLICT");
    expect(mock.fileUploadCalls).toHaveLength(0);
    expect(mock.pageCreateCalls).toHaveLength(1);
  });

  it("rejects a reused photo ID whose validated dimensions differ", async () => {
    const { mock, service } = setup();
    await service.createMemory(photoInput());
    const error = await rejection(
      service.createMemory(photoInput(photoMedia({ width: 641 }))),
    );
    expect(error.code).toBe("REQUEST_CONFLICT");
    expect(mock.fileUploadCalls).toHaveLength(1);
  });

  it("treats several matching records as ambiguous and writes nothing", async () => {
    const pages = [1, 2].map((n) =>
      buildPage({
        id: memoryId(n),
        kind: "text",
        text: textInput.text,
        caption: textInput.caption,
        date: textInput.memoryDate,
        requestId: REQUEST_ID,
      }),
    );
    const { mock, service } = setup({ pages });
    const error = await rejection(service.createMemory(textInput));
    expect(error.code).toBe("REQUEST_CONFLICT");
    expect(writeCount(mock)).toBe(0);
  });

  it("treats a malformed matching record as ambiguous, not as absent", async () => {
    const { mock, service } = setup({
      pages: [
        buildPage({
          id: memoryId(1),
          kind: "photo",
          files: [],
          requestId: REQUEST_ID,
        }),
      ],
    });
    const error = await rejection(service.createMemory(photoInput()));
    expect(error.code).toBe("REQUEST_CONFLICT");
    expect(writeCount(mock)).toBe(0);
  });

  it("coalesces concurrent same-ID creates in one instance into one write", async () => {
    const { mock, service } = setup();
    const [a, b] = await Promise.all([
      service.createMemory(photoInput()),
      service.createMemory(photoInput()),
    ]);
    expect(mock.pageCreateCalls).toHaveLength(1);
    expect(mock.fileUploadCalls).toHaveLength(1);
    expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
    expect(a.memory).toEqual(b.memory);
  });

  it("a concurrent same-ID create with a different payload is a conflict", async () => {
    const { mock, service } = setup();
    const [a, b] = await Promise.allSettled([
      service.createMemory(textInput),
      service.createMemory({ ...textInput, text: "distinto" }),
    ]);
    expect(a.status).toBe("fulfilled");
    expect(b.status).toBe("rejected");
    expect((b as PromiseRejectedResult).reason).toMatchObject({
      code: "REQUEST_CONFLICT",
    });
    expect(mock.pageCreateCalls).toHaveLength(1);
  });

  it("a waiter behind an unknown outcome reports unknown and never writes", async () => {
    const { mock, service } = setup();
    mock.failNext("pagesCreate", notionError({ status: 500 }));
    const [first, waiter] = await Promise.allSettled([
      service.createMemory(photoInput()),
      service.createMemory(photoInput()),
    ]);
    expect(first).toMatchObject({
      status: "rejected",
      reason: { code: "OUTCOME_UNKNOWN" },
    });
    expect(waiter).toMatchObject({
      status: "rejected",
      reason: { code: "OUTCOME_UNKNOWN", status: 202 },
    });
    // One create attempt in total (the scripted 500 fires before recording).
    expect(mock.counters.pagesCreate).toBe(1);
    expect(mock.fileUploadCalls).toHaveLength(1);
    expect(mock.fileSendCalls).toHaveLength(1);
  });

  it("a waiter behind a committed-but-unindexed create does not duplicate it", async () => {
    const { mock, service } = setup();
    mock.failAfterCommit("pagesCreate", () => notionError({ status: 500 }));
    const originalQuery = mock.client.dataSources.query;
    mock.client.dataSources.query = async (args) => ({
      ...(await originalQuery(args)),
      results: [], // Notion has not indexed the new page yet
    });
    const [first, waiter] = await Promise.allSettled([
      service.createMemory(photoInput()),
      service.createMemory(photoInput()),
    ]);
    expect(first).toMatchObject({ reason: { code: "OUTCOME_UNKNOWN" } });
    expect(waiter).toMatchObject({ reason: { code: "OUTCOME_UNKNOWN" } });
    expect(mock.pageCreateCalls).toHaveLength(1);
    expect(mock.fileUploadCalls).toHaveLength(1);
    expect(mock.pages.size).toBe(1);
  });

  it("a waiter behind an unexpected (non-ShoeboxError) failure reports unknown and never writes", async () => {
    const { mock, gateway } = setup();
    const originalQuery = mock.client.dataSources.query;
    mock.client.dataSources.query = async (args) => ({
      ...(await originalQuery(args)),
      results: [], // Notion has not indexed the new page yet
    });
    // The first attempt commits, then fails in an unclassified way.
    const service = createMemoryService(
      {
        ...gateway,
        createPage: async (...args: Parameters<typeof gateway.createPage>) => {
          await gateway.createPage(...args);
          throw new TypeError("unexpected");
        },
      },
      { databaseId: DATABASE_ID, clock: () => NOW },
    );
    const [first, waiter] = await Promise.allSettled([
      service.createMemory(photoInput()),
      service.createMemory(photoInput()),
    ]);
    expect(first).toMatchObject({ status: "rejected" });
    expect(waiter).toMatchObject({
      status: "rejected",
      reason: { code: "OUTCOME_UNKNOWN", status: 202 },
    });
    expect(mock.pageCreateCalls).toHaveLength(1);
    expect(mock.fileUploadCalls).toHaveLength(1);
    expect(mock.pages.size).toBe(1);
  });

  it("a waiter whose budget the wait consumed fails safely without writing", async () => {
    let now = NOW;
    const { mock, service } = setup({ clock: () => now });
    const original = mock.client.fileUploads.create;
    mock.client.fileUploads.create = async () => {
      now += 40_000; // the first attempt is slow, then fails before any page
      throw notionError({ status: 400, code: "validation_error" });
    };
    const [first, waiter] = await Promise.allSettled([
      service.createMemory(photoInput()),
      service.createMemory(photoInput()),
    ]);
    mock.client.fileUploads.create = original;
    expect(first).toMatchObject({ reason: { code: "UNAVAILABLE" } });
    expect(waiter).toMatchObject({
      status: "rejected",
      reason: { code: "UNAVAILABLE", status: 503, detail: "create_budget" },
    });
    expect(mock.pageCreateCalls).toHaveLength(0);
    expect(mock.counters.dataSourcesQuery).toBe(1);
  });

  it("a waiter behind a known no-write failure may create within its budget", async () => {
    const { mock, service } = setup();
    mock.failNext(
      "fileUploadsCreate",
      notionError({ status: 400, code: "validation_error" }),
    );
    const [first, waiter] = await Promise.allSettled([
      service.createMemory(photoInput()),
      service.createMemory(photoInput()),
    ]);
    expect(first).toMatchObject({ reason: { code: "UNAVAILABLE" } });
    expect(waiter).toMatchObject({
      status: "fulfilled",
      value: { replayed: false },
    });
    expect(mock.pageCreateCalls).toHaveLength(1);
  });

  it("different Request IDs create different memories", async () => {
    const { mock, service } = setup();
    await service.createMemory(textInput);
    await service.createMemory({ ...textInput, requestId: OTHER_ID });
    expect(mock.pageCreateCalls).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// HTTP handler: auth, origin, bounded multipart, validation, status codes.

type FilePart = { bytes: Uint8Array; name: string; type: string };

function createRequest(
  metadata: unknown,
  file?: FilePart,
  headers: Record<string, string> = {},
): Request {
  const form = new FormData();
  form.set("metadata", JSON.stringify(metadata));
  if (file) {
    form.set(
      "file",
      new File([file.bytes as BlobPart], file.name, { type: file.type }),
    );
  }
  return new Request(`${FAKE_APP_ORIGIN}/api/shoebox/memories`, {
    method: "POST",
    headers: {
      origin: FAKE_APP_ORIGIN,
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body: form,
  });
}

const config = () => ({
  notionApiKey: SAFE_ENV.NOTION_API_KEY,
  notionDbId: DATABASE_ID,
  passwordHash: SAFE_ENV.SHOEBOX_PASSWORD_HASH,
  sessionSecret: SAFE_ENV.SHOEBOX_SESSION_SECRET,
  appOrigin: FAKE_APP_ORIGIN,
});

function handlersFor(
  options: SetupOptions = {},
  validate: typeof validateMedia = validateMedia,
) {
  const built = setup(options);
  const factory = vi.fn(() => built.service);
  const requireSession = vi.fn(async () => ({
    id: "s",
    issuedAt: 1,
    expiresAt: 2,
  }));
  const validator = vi.fn(validate);
  const handlers = createMemoryHandlers({
    service: factory,
    requireSession,
    config,
    validateMedia: validator,
  });
  return { ...built, factory, requireSession, validator, handlers };
}

const textMetadata = {
  requestId: REQUEST_ID,
  kind: "text",
  text: "una nota sintética",
  caption: "",
  memoryDate: "2026-10-21",
};
const photoMetadata = {
  requestId: REQUEST_ID,
  kind: "photo",
  caption: "",
  memoryDate: "2026-10-21",
};
const photoPart: FilePart = {
  bytes: fixtureBytes("photo-exif-orientation-gps.jpg"),
  name: "secret-original-name.jpg",
  type: "image/jpeg",
};
const audioPart: FilePart = {
  bytes: fixtureBytes("audio-webm-opus-2s.webm"),
  name: "secret-original-voice.webm",
  type: "audio/webm",
};

function logEntries(): Record<string, unknown>[] {
  return errorLog.mock.calls.map((call: unknown[]) =>
    JSON.parse(String(call[0])),
  );
}

describe("handler: POST /api/shoebox/memories", () => {
  it("returns 201 for a new memory and 200 replayed for the same Request ID", async () => {
    const { handlers, mock } = handlersFor();
    const first = await handlers.create(createRequest(textMetadata));
    expect(first.status).toBe(201);
    expect(first.headers.get("cache-control")).toContain("no-store");
    const created = (await first.json()) as {
      memory: MemorySummary;
      replayed: boolean;
    };
    expect(created.replayed).toBe(false);
    const second = await handlers.create(createRequest(textMetadata));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({
      memory: created.memory,
      replayed: true,
    });
    expect(mock.pageCreateCalls).toHaveLength(1);
    expect(mock.fileUploadCalls).toHaveLength(0);
  });

  it("checks origin before the session, the body or any upstream call", async () => {
    const { handlers, requireSession, factory, mock, validator } =
      handlersFor();
    const variants: Record<string, string>[] = [
      { origin: "https://evil.test" },
      { origin: FAKE_APP_ORIGIN, "sec-fetch-site": "cross-site" },
    ];
    for (const headers of variants) {
      const response = await handlers.create(
        createRequest(photoMetadata, photoPart, headers),
      );
      expect(response.status).toBe(403);
    }
    expect(requireSession).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
    expect(validator).not.toHaveBeenCalled();
    expect(mock.total()).toBe(0);
  });

  it("requires a session before reading the body or validating media", async () => {
    const { handlers, requireSession, factory, mock, validator } =
      handlersFor();
    requireSession.mockRejectedValueOnce(new ShoeboxError("UNAUTHORIZED"));
    const response = await handlers.create(
      createRequest(photoMetadata, photoPart),
    );
    expect(response.status).toBe(401);
    expect(factory).not.toHaveBeenCalled();
    expect(validator).not.toHaveBeenCalled();
    expect(mock.total()).toBe(0);
  });

  it("validates a real photo fixture, stores memory.jpg and never the original name", async () => {
    const { handlers, mock, validator } = handlersFor();
    const response = await handlers.create(
      createRequest(photoMetadata, photoPart),
    );
    expect(response.status).toBe(201);
    expect(validator).toHaveBeenCalledTimes(1);
    const body = await response.text();
    expect(mock.fileUploadCalls[0]).toMatchObject({
      filename: "memory.jpg",
      content_type: "image/jpeg",
    });
    expect(mock.fileSendCalls[0].filename).toBe("memory.jpg");
    const everything = JSON.stringify([
      body,
      mock.pageCreateCalls,
      mock.fileUploadCalls,
      mock.fileSendCalls.map((call) => call.filename),
      errorLog.mock.calls,
    ]);
    expect(everything).not.toContain("secret-original");
    expect(everything).not.toContain(SAFE_ENV.NOTION_API_KEY);
    // Server-normalized JPEG, not the uploaded bytes (EXIF/GPS stripped).
    expect(mock.fileSendCalls[0].bytes.byteLength).not.toBe(
      photoPart.bytes.byteLength,
    );
  });

  it("validates real WebM audio and stores it as memory.weba", async () => {
    const { handlers, mock } = handlersFor();
    const response = await handlers.create(
      createRequest({ ...photoMetadata, kind: "audio" }, audioPart),
    );
    expect(response.status).toBe(201);
    const { memory } = (await response.json()) as { memory: MemorySummary };
    expect(memory).toMatchObject({ kind: "audio", mimeType: "audio/webm" });
    expect(mock.fileUploadCalls[0]).toMatchObject({
      filename: "memory.weba",
      content_type: "audio/webm",
    });
    expect([...mock.fileSendCalls[0].bytes]).toEqual([...audioPart.bytes]);
  });

  it("rejects an invalid file with 415 before any upstream call", async () => {
    const { handlers, mock, factory } = handlersFor();
    const png = fixtureFile("photo-transparent.png", "image/png");
    const response = await handlers.create(
      createRequest(photoMetadata, {
        bytes: new Uint8Array(await png.arrayBuffer()),
        name: "x.png",
        type: "image/png",
      }),
    );
    expect(response.status).toBe(415);
    expect(factory).not.toHaveBeenCalled();
    expect(mock.total()).toBe(0);
  });

  it("does not retry a busy/deadline validator and never turns it into OUTCOME_UNKNOWN", async () => {
    const busy = vi.fn(async () => {
      throw new ShoeboxError("UNAVAILABLE", { detail: "media_busy" });
    });
    const { handlers, mock, validator } = handlersFor({}, busy);
    const response = await handlers.create(
      createRequest(photoMetadata, photoPart),
    );
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAVAILABLE");
    expect(validator).toHaveBeenCalledTimes(1);
    expect(mock.total()).toBe(0);
  });

  it("rejects malformed metadata (400), semantic errors (422) and oversize bodies (413) with no write", async () => {
    const { handlers, mock } = handlersFor();
    const bad = await handlers.create(
      createRequest({ ...textMetadata, extra: 1 }),
    );
    expect(bad.status).toBe(400);
    const semantic = await handlers.create(
      createRequest({ ...textMetadata, memoryDate: "2026-02-30" }),
    );
    expect(semantic.status).toBe(422);
    // A byte body (not FormData): undici's FormData stream source rejects
    // unhandled when the bounded reader cancels it mid-stream.
    const big = await handlers.create(
      multipartRequest({
        metadata: photoMetadata,
        files: [new Uint8Array(4_200_001)],
        headers: { origin: FAKE_APP_ORIGIN, "sec-fetch-site": "same-origin" },
      }),
    );
    expect(big.status).toBe(413);
    expect(writeCount(mock)).toBe(0);
  });

  it("answers 409 for a conflicting reused ID", async () => {
    const { handlers } = handlersFor();
    await handlers.create(createRequest(textMetadata));
    const response = await handlers.create(
      createRequest({ ...textMetadata, text: "cambiado" }),
    );
    expect(response.status).toBe(409);
    expect(
      ((await response.json()) as { error: { code: string } }).error.code,
    ).toBe("REQUEST_CONFLICT");
  });

  it("answers 202 OUTCOME_UNKNOWN with only safe diagnostics", async () => {
    const { handlers, mock } = handlersFor();
    mock.failNext("pagesCreate", notionError({ status: 500 }));
    const response = await handlers.create(createRequest(textMetadata));
    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = (await response.json()) as {
      error: { code: string; diagnosticId: string; message: string };
    };
    expect(body.error.code).toBe("OUTCOME_UNKNOWN");
    expect(body.error.diagnosticId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(body)).not.toMatch(/SECRET-DETAIL|7c0ffee0|notion/i);
    const entries = logEntries();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(Object.keys(entry).sort()).toEqual(
        ["code", "detail", "diagnosticId", "shoebox"].filter(
          (key) => key !== "detail" || "detail" in entry,
        ),
      );
      expect(String(entry.detail ?? "")).toMatch(/^[a-z_]*(:[a-z0-9_]+)?$/);
      expect(entry.diagnosticId).toMatch(/^[0-9a-f-]{36}$/);
    }
    expect(JSON.stringify(entries)).not.toMatch(
      /SECRET-DETAIL|7c0ffee0|una nota/,
    );
  });
});

describe("route: /api/shoebox/memories POST wiring", () => {
  it("exports POST and advertises it in Allow", () => {
    expect(typeof listPost).toBe("function");
    for (const handler of [listPut, listOptions]) {
      const response = handler();
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD, POST");
    }
  });

  it("rejects an unauthenticated POST through the real route with 401 or 403 and no body echo", async () => {
    const response = await listPost(createRequest(textMetadata));
    expect([401, 403]).toContain(response.status);
    expect(await response.text()).not.toContain("una nota");
  });
});

describe("gateway fixture: offline transport", () => {
  it("a real SDK send to Notion's origin with the token is blocked and sanitized", async () => {
    const gateway = createNotionGateway({
      client: createSdkClient(SAFE_ENV.NOTION_API_KEY),
      deadlines: { readMs: 2_000, writeMs: 2_000 },
    });
    const error = await rejection(
      gateway.sendFileUpload({
        file_upload_id: "f17e0000-0000-4000-8000-000000000001",
        file: { filename: "memory.jpg", data: new Blob([new Uint8Array([1])]) },
      }),
    );
    expect(error.code).toBe("OUTCOME_UNKNOWN");
    expect(JSON.stringify({ ...error, message: error.message })).not.toContain(
      SAFE_ENV.NOTION_API_KEY,
    );
    await expect(
      fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: { authorization: `Bearer ${SAFE_ENV.NOTION_API_KEY}` },
      }),
    ).rejects.toThrow(/offline test guard/);
  });
});
