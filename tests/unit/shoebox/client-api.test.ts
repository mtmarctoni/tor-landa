import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkRequest,
  isOutcomeUncertain,
  type SaveDraft,
  ShoeboxApiError,
  STATUS_POLL_DELAYS_MS,
  saveMemory,
  shoeboxFetch,
} from "@/features/shoebox/client/api";
import type { MemorySummary } from "@/types/shoebox";

/**
 * Client fetch normalization and the Task 5 create/reconcile contract, with a
 * fake global fetch. Nothing here reaches a network.
 */

const REQUEST_ID = "2b9c1d3e-4f50-4a61-8b72-9c83d4e5f601";
const MEMORY: MemorySummary = {
  id: "0f0f0f0f-0000-4000-8000-0000000000aa",
  kind: "text",
  text: "un pez sintético",
  caption: "",
  memoryDate: "2026-10-21",
  createdAt: "2026-10-21T10:00:00.000Z",
};

type Call = { url: string; init: RequestInit };
type Reply = Response | Error | ((call: Call) => Response | Promise<Response>);

let calls: Call[];
let replies: Reply[];

function json(status: number, body: unknown, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}
function apiError(status: number, code: string, extra: object = {}) {
  return json(status, {
    error: { code, message: "x", diagnosticId: "d-1", ...extra },
  });
}

beforeEach(() => {
  calls = [];
  replies = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const call = { url, init };
      calls.push(call);
      if (init.signal?.aborted) {
        throw new DOMException("aborted", "AbortError");
      }
      const reply = replies.shift();
      if (!reply) throw new Error(`unexpected fetch ${url}`);
      if (reply instanceof Error) throw reply;
      return typeof reply === "function" ? reply(call) : reply;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("keeps a 409 uncertain when its status cannot be checked", async () => {
  replies.push(apiError(409, "REQUEST_CONFLICT"), apiError(503, "UNAVAILABLE"));
  const result = await saveMemory({
    requestId: REQUEST_ID,
    fields: {
      kind: "text",
      text: "synthetic",
      caption: "",
      memoryDate: "2026-10-21",
    },
  });
  expect(result.kind).toBe("uncertain");
});

async function rejection(promise: Promise<unknown>): Promise<ShoeboxApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ShoeboxApiError);
    return error as ShoeboxApiError;
  }
  throw new Error("expected a rejection");
}

describe("shoeboxFetch", () => {
  it("only accepts fixed same-origin shoebox API paths", async () => {
    for (const path of [
      "https://evil.test/api/shoebox/session",
      "//evil.test/api/shoebox/session",
      "/api/other",
      "/api/shoebox/../../secret",
      "/api/shoebox/memories/not-a-uuid/media",
      "/api/shoebox/memories/0f0f0f0f-0000-4000-8000-0000000000aa/media",
      "/shoebox",
      "api/shoebox/session",
    ]) {
      await expect(shoeboxFetch(path), path).rejects.toThrow(
        /no permitida|not allowed/i,
      );
    }
    expect(calls).toHaveLength(0);
  });

  it("forces same-origin credentials and referrer policy, no-store and no redirects", async () => {
    replies.push(json(200, { expiresAt: 1 }));
    await shoeboxFetch("/api/shoebox/session", {
      credentials: "include",
      cache: "force-cache",
      redirect: "follow",
      mode: "cors",
      referrerPolicy: "no-referrer",
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/api/shoebox/session");
    expect(calls[0]?.init).toMatchObject({
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      mode: "same-origin",
      referrerPolicy: "same-origin",
    });
  });

  it("returns parsed JSON on success and undefined on 204", async () => {
    replies.push(
      json(200, { expiresAt: 42 }),
      new Response(null, { status: 204 }),
    );
    await expect(shoeboxFetch("/api/shoebox/session")).resolves.toEqual({
      expiresAt: 42,
    });
    await expect(
      shoeboxFetch("/api/shoebox/logout", { method: "POST" }),
    ).resolves.toBeUndefined();
  });

  it("normalizes the API error envelope with code, status and retry hint", async () => {
    replies.push(apiError(429, "RATE_LIMITED", { retryAfterSeconds: 30 }));
    const error = await rejection(shoeboxFetch("/api/shoebox/session"));
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.status).toBe(429);
    expect(error.retryAfterSeconds).toBe(30);
    expect(error.diagnosticId).toBe("d-1");
    expect(error.message).toMatch(/[áéíóúñ]|minuto|intentos/i);
  });

  it("treats a 202 OUTCOME_UNKNOWN envelope as an uncertain error, never success", async () => {
    replies.push(apiError(202, "OUTCOME_UNKNOWN"));
    const error = await rejection(
      shoeboxFetch("/api/shoebox/memories", { method: "POST" }),
    );
    expect(error.code).toBe("OUTCOME_UNKNOWN");
    expect(error.status).toBe(202);
    expect(isOutcomeUncertain(error)).toBe(true);
  });

  it("maps a Vercel non-JSON 413 to a clear Spanish size error", async () => {
    replies.push(
      new Response("Request Entity Too Large", {
        status: 413,
        headers: { "content-type": "text/plain" },
      }),
    );
    const error = await rejection(
      shoeboxFetch("/api/shoebox/memories", { method: "POST" }),
    );
    expect(error.code).toBe("TOO_LARGE");
    expect(error.message).toContain("demasiado grande");
    expect(isOutcomeUncertain(error)).toBe(false);
  });

  it("maps a non-JSON 504 to an uncertain timeout", async () => {
    replies.push(
      new Response("<html>FUNCTION_INVOCATION_TIMEOUT</html>", {
        status: 504,
        headers: { "content-type": "text/html" },
      }),
    );
    const error = await rejection(
      shoeboxFetch("/api/shoebox/memories", { method: "POST" }),
    );
    expect(error.code).toBe("TIMEOUT");
    expect(error.message).toMatch(/tardó|tiempo/);
    expect(isOutcomeUncertain(error)).toBe(true);
  });

  it("treats corrupted JSON on a success status as an uncertain bad response", async () => {
    replies.push(
      new Response('{"memory": {', {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    const error = await rejection(
      shoeboxFetch("/api/shoebox/memories", { method: "POST" }),
    );
    expect(error.code).toBe("BAD_RESPONSE");
    expect(isOutcomeUncertain(error)).toBe(true);
  });

  it("maps network failure and abort to distinct uncertain codes", async () => {
    replies.push(new TypeError("Failed to fetch"));
    const network = await rejection(shoeboxFetch("/api/shoebox/session"));
    expect(network.code).toBe("NETWORK");
    expect(isOutcomeUncertain(network)).toBe(true);

    const controller = new AbortController();
    controller.abort();
    const aborted = await rejection(
      shoeboxFetch("/api/shoebox/session", { signal: controller.signal }),
    );
    expect(aborted.code).toBe("ABORTED");
  });

  it("does not retry a failed write by itself", async () => {
    replies.push(apiError(503, "UNAVAILABLE"));
    const error = await rejection(
      shoeboxFetch("/api/shoebox/memories", { method: "POST" }),
    );
    expect(error.code).toBe("UNAVAILABLE");
    expect(isOutcomeUncertain(error)).toBe(false);
    expect(calls).toHaveLength(1);
  });
});

describe("saveMemory: Task 5 create contract", () => {
  const draft: SaveDraft = {
    requestId: REQUEST_ID,
    fields: {
      kind: "text",
      text: "un pez sintético",
      caption: "",
      memoryDate: "2026-10-21",
    },
  };
  let waits: number[];
  const wait = async (ms: number) => {
    waits.push(ms);
  };

  beforeEach(() => {
    waits = [];
  });

  const posts = () => calls.filter((call) => call.init.method === "POST");
  const statusChecks = () =>
    calls.filter((call) => call.url === `/api/shoebox/requests/${REQUEST_ID}`);

  it("posts multipart metadata with the draft's Request ID and no file for text", async () => {
    replies.push(json(201, { memory: MEMORY, replayed: false }));
    const outcome = await saveMemory(draft, { wait });
    expect(outcome).toEqual({ kind: "saved", memory: MEMORY, replayed: false });
    expect(posts()).toHaveLength(1);
    const body = posts()[0]?.init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect([...body.keys()]).toEqual(["metadata"]);
    expect(JSON.parse(String(body.get("metadata")))).toEqual({
      requestId: REQUEST_ID,
      kind: "text",
      text: "un pez sintético",
      caption: "",
      memoryDate: "2026-10-21",
    });
  });

  it("attaches exactly one file for media drafts", async () => {
    replies.push(json(201, { memory: MEMORY, replayed: false }));
    const file = new File([new Uint8Array(8)], "grabacion.weba", {
      type: "audio/webm;codecs=opus",
    });
    await saveMemory(
      {
        requestId: REQUEST_ID,
        fields: { kind: "audio", caption: "", memoryDate: "2026-10-21" },
        file,
      },
      { wait },
    );
    const body = posts()[0]?.init.body as FormData;
    expect(body.getAll("file")).toHaveLength(1);
    expect((body.get("file") as File).type).toBe("audio/webm;codecs=opus");
    expect(JSON.parse(String(body.get("metadata")))).not.toHaveProperty("text");
  });

  it("treats 200 replayed as success", async () => {
    replies.push(json(200, { memory: MEMORY, replayed: true }));
    await expect(saveMemory(draft, { wait })).resolves.toEqual({
      kind: "saved",
      memory: MEMORY,
      replayed: true,
    });
  });

  it("after 202 polls status at 1 s, 2 s and 4 s and stops when found", async () => {
    replies.push(
      apiError(202, "OUTCOME_UNKNOWN"),
      json(200, { state: "not_found" }),
      json(200, { state: "found", memory: MEMORY }),
    );
    const outcome = await saveMemory(draft, { wait });
    expect(outcome).toEqual({ kind: "saved", memory: MEMORY, replayed: true });
    expect(waits).toEqual([1_000, 2_000]);
    expect(posts()).toHaveLength(1);
    expect(statusChecks()).toHaveLength(2);
    expect(
      statusChecks().every((call) => (call.init.method ?? "GET") === "GET"),
    ).toBe(true);
  });

  it("stays uncertain after three not_found polls and never posts again", async () => {
    replies.push(
      apiError(202, "OUTCOME_UNKNOWN"),
      json(200, { state: "not_found" }),
      json(200, { state: "not_found" }),
      json(200, { state: "not_found" }),
    );
    const outcome = await saveMemory(draft, { wait });
    expect(outcome.kind).toBe("uncertain");
    expect(STATUS_POLL_DELAYS_MS).toEqual([1_000, 2_000, 4_000]);
    expect(waits).toEqual([1_000, 2_000, 4_000]);
    expect(posts()).toHaveLength(1);
    expect(statusChecks()).toHaveLength(3);
  });

  it("polls after a dropped connection, a non-JSON 504 or corrupted JSON", async () => {
    for (const failure of [
      new TypeError("Failed to fetch"),
      new Response("timeout", { status: 504 }),
      new Response("{", {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    ]) {
      calls = [];
      replies.push(failure, json(200, { state: "found", memory: MEMORY }));
      const outcome = await saveMemory(draft, { wait });
      expect(outcome.kind).toBe("saved");
      expect(posts()).toHaveLength(1);
    }
  });

  it("reports ambiguous status as recovery and keeps polling read-only", async () => {
    replies.push(
      apiError(202, "OUTCOME_UNKNOWN"),
      json(200, { state: "ambiguous" }),
    );
    await expect(saveMemory(draft, { wait })).resolves.toEqual({
      kind: "ambiguous",
    });
    expect(posts()).toHaveLength(1);
  });

  it("on 409 asks the status endpoint to tell ambiguity from an edited draft", async () => {
    replies.push(
      apiError(409, "REQUEST_CONFLICT"),
      json(200, { state: "ambiguous" }),
    );
    await expect(saveMemory(draft, { wait })).resolves.toEqual({
      kind: "ambiguous",
    });

    replies.push(
      apiError(409, "REQUEST_CONFLICT"),
      json(200, { state: "found", memory: MEMORY }),
    );
    await expect(saveMemory(draft, { wait })).resolves.toEqual({
      kind: "conflict",
      memory: MEMORY,
    });

    replies.push(
      apiError(409, "REQUEST_CONFLICT"),
      json(200, { state: "not_found" }),
    );
    await expect(saveMemory(draft, { wait })).resolves.toEqual({
      kind: "conflict",
      memory: null,
    });
    expect(posts()).toHaveLength(3);
    expect(waits).toEqual([]);
  });

  it("returns known no-write failures without polling or retrying", async () => {
    for (const [status, code] of [
      [503, "UNAVAILABLE"],
      [429, "RATE_LIMITED"],
      [413, "TOO_LARGE"],
      [415, "UNSUPPORTED_MEDIA"],
      [422, "INVALID_INPUT"],
      [401, "UNAUTHORIZED"],
    ] as const) {
      calls = [];
      replies.push(apiError(status, code));
      const outcome = await saveMemory(draft, { wait });
      expect(outcome.kind, code).toBe("failed");
      if (outcome.kind === "failed") expect(outcome.error.code).toBe(code);
      expect(calls, code).toHaveLength(1);
    }
    expect(waits).toEqual([]);
  });

  it("a cancelled upload is uncertain, is not polled and is not resent", async () => {
    const controller = new AbortController();
    replies.push(() => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });
    const outcome = await saveMemory(draft, {
      wait,
      signal: controller.signal,
    });
    expect(outcome.kind).toBe("uncertain");
    if (outcome.kind === "uncertain")
      expect(outcome.cause.code).toBe("ABORTED");
    expect(calls).toHaveLength(1);
    expect(waits).toEqual([]);
  });

  it("stops polling when the session has expired", async () => {
    replies.push(
      apiError(202, "OUTCOME_UNKNOWN"),
      apiError(401, "UNAUTHORIZED"),
    );
    const outcome = await saveMemory(draft, { wait });
    expect(outcome.kind).toBe("uncertain");
    if (outcome.kind === "uncertain")
      expect(outcome.cause.code).toBe("UNAUTHORIZED");
    expect(statusChecks()).toHaveLength(1);
  });

  it("an explicit retry re-checks status first and resends the same ID only if not found", async () => {
    replies.push(json(200, { state: "found", memory: MEMORY }));
    await expect(
      saveMemory(draft, { wait, checkFirst: true }),
    ).resolves.toEqual({
      kind: "saved",
      memory: MEMORY,
      replayed: true,
    });
    expect(posts()).toHaveLength(0);

    calls = [];
    replies.push(
      json(200, { state: "not_found" }),
      json(200, { memory: MEMORY, replayed: true }),
    );
    await saveMemory(draft, { wait, checkFirst: true });
    expect(calls.map((call) => call.url)).toEqual([
      `/api/shoebox/requests/${REQUEST_ID}`,
      "/api/shoebox/memories",
    ]);
    const metadata = JSON.parse(
      String((posts()[0]?.init.body as FormData | undefined)?.get("metadata")),
    );
    expect(metadata.requestId).toBe(REQUEST_ID);

    calls = [];
    replies.push(new TypeError("Failed to fetch"));
    const unchecked = await saveMemory(draft, { wait, checkFirst: true });
    expect(unchecked.kind).toBe("uncertain");
    expect(posts()).toHaveLength(0);
  });

  it("checkRequest performs one read-only status check", async () => {
    replies.push(json(200, { state: "not_found" }));
    expect((await checkRequest(REQUEST_ID)).kind).toBe("uncertain");
    replies.push(json(200, { state: "found", memory: MEMORY }));
    expect(await checkRequest(REQUEST_ID)).toEqual({
      kind: "saved",
      memory: MEMORY,
      replayed: true,
    });
    expect(calls.every((call) => (call.init.method ?? "GET") === "GET")).toBe(
      true,
    );
    expect(calls).toHaveLength(2);
  });
});
