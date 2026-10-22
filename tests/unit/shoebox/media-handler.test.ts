import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/shoebox/memories/[id]/media/route";
import { ShoeboxError } from "@/features/shoebox/server/errors";
import {
  createMediaHandler,
  type MediaHandlerDeps,
} from "@/features/shoebox/server/media-handler";
import {
  fetchTrustedMedia,
  MEDIA_LINK_EXPIRED,
} from "@/features/shoebox/server/media-source";
import type { TrustedMedia } from "@/features/shoebox/server/memory-service";
import { issueSession } from "@/features/shoebox/server/session";
import { FAKE_APP_ORIGIN } from "../../helpers/safe-env";

const ID = "0f0f0f0f-0000-4000-8000-0000000000aa";
const PATH = `/api/shoebox/memories/${ID}/media`;
const SIGNED =
  "https://prod-files-secure.s3.us-west-2.amazonaws.com/0f0f0f0f-0000-4000-8000-000000000001/1e1e1e1e-0000-4000-8000-000000000002/memory.weba?X-Amz-Signature=SECRETSIG";
const BYTES = Uint8Array.from([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
const WEEK = 604_800;

const PRIVATE = {
  "cache-control": "private, no-store, max-age=0",
  "cdn-cache-control": "no-store",
  "vercel-cdn-cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

function expectPrivate(response: Response): void {
  for (const [name, value] of Object.entries(PRIVATE)) {
    expect(response.headers.get(name), name).toBe(value);
  }
  for (const name of [
    "location",
    "set-cookie",
    "etag",
    "last-modified",
    "expires",
    "access-control-allow-origin",
  ]) {
    expect(response.headers.get(name), name).toBeNull();
  }
}

function trusted(url = SIGNED): TrustedMedia {
  return { kind: "audio", url: new URL(url), expectedMimeType: "audio/webm" };
}

let cookie: string;
beforeEach(async () => {
  const { token } = await issueSession();
  cookie = `__Host-shoebox=${token}`;
});

let logs: ReturnType<typeof vi.spyOn>[];
beforeEach(() => {
  logs = (["error", "warn", "log", "info", "debug"] as const).map((name) =>
    vi.spyOn(console, name).mockImplementation(() => undefined),
  );
});
afterEach(() => {
  const written = JSON.stringify(logs.map((spy) => spy.mock.calls));
  expect(written).not.toContain("SECRETSIG");
  expect(written).not.toContain("amazonaws");
  vi.restoreAllMocks();
});

function request(
  headers: Record<string, string> = {},
  {
    method = "GET",
    path = PATH,
    auth = true,
    signal,
  }: {
    method?: string;
    path?: string;
    auth?: boolean;
    signal?: AbortSignal;
  } = {},
): Request {
  return new Request(`${FAKE_APP_ORIGIN}${path}`, {
    method,
    headers: {
      "sec-fetch-site": "same-origin",
      ...(auth ? { cookie } : {}),
      ...headers,
    },
    signal,
  });
}

function harness(overrides: Partial<MediaHandlerDeps> = {}) {
  const resolve = vi.fn(async (_id: string) => trusted());
  const fetchBytes = vi.fn(async (_media: TrustedMedia, _signal: AbortSignal) =>
    Uint8Array.from(BYTES),
  );
  const inspect = vi.fn(
    async (_bytes: Uint8Array, _kind: "photo" | "audio", _s?: AbortSignal) => ({
      mimeType: "audio/webm",
      durationSeconds: 2,
    }),
  );
  const deps: MediaHandlerDeps = {
    resolve,
    fetchBytes,
    inspect,
    ...overrides,
  };
  return { handler: createMediaHandler(deps), resolve, fetchBytes, inspect };
}

async function bytesOf(response: Response): Promise<number[]> {
  return [...new Uint8Array(await response.arrayBuffer())];
}

describe("full and partial responses", () => {
  it("serves the whole validated body with canonical private headers", async () => {
    const { handler, inspect } = harness();
    const response = await handler(request(), ID);
    expect(response.status).toBe(200);
    expectPrivate(response);
    expect(response.headers.get("content-type")).toBe("audio/webm");
    expect(response.headers.get("content-length")).toBe("10");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-range")).toBeNull();
    expect(await bytesOf(response)).toEqual([...BYTES]);
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(inspect.mock.calls[0][1]).toBe("audio");
  });

  it.each([
    ["bytes=2-4", 2, 4],
    ["bytes=4-", 4, 9],
    ["bytes=-3", 7, 9],
    ["bytes=-30", 0, 9],
    ["bytes=0-", 0, 9],
    ["bytes=8-100", 8, 9],
  ])("answers %s with 206", async (range, start, end) => {
    const { handler } = harness();
    const response = await handler(request({ Range: range }), ID);
    expect(response.status).toBe(206);
    expectPrivate(response);
    expect(response.headers.get("content-range")).toBe(
      `bytes ${start}-${end}/10`,
    );
    expect(response.headers.get("content-length")).toBe(
      String(end - start + 1),
    );
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-type")).toBe("audio/webm");
    expect(await bytesOf(response)).toEqual([...BYTES.slice(start, end + 1)]);
  });

  it.each([
    "bytes=10-",
    "bytes=11-12",
    "bytes=5-4",
    "bytes=99999999999999999999-",
    "bytes=-0",
    "bytes=0-1,4-5",
    "bytes=abc",
    "items=0-1",
  ])("answers %s with a private 416", async (range) => {
    const { handler } = harness();
    const response = await handler(request({ Range: range }), ID);
    expect(response.status).toBe(416);
    expectPrivate(response);
    expect(response.headers.get("content-range")).toBe("bytes */10");
    expect(response.headers.get("content-type")).toBe("application/json");
    const text = await response.text();
    expect(text).not.toContain("SECRETSIG");
    expect(text).not.toContain("amazonaws");
    expect(JSON.parse(text).error.code).toBe("INVALID_INPUT");
  });

  it("serves the full body when If-Range is present (no validator to match)", async () => {
    const { handler } = harness();
    const response = await handler(
      request({ Range: "bytes=2-4", "If-Range": '"abc"' }),
      ID,
    );
    expect(response.status).toBe(200);
    expect(await bytesOf(response)).toEqual([...BYTES]);
  });

  it("ignores conditional requests: always a fresh authenticated 200, never 304", async () => {
    const { handler, fetchBytes } = harness();
    for (const headers of [
      { "If-None-Match": "*" },
      { "If-None-Match": '"x"' },
      { "If-Modified-Since": "Wed, 21 Oct 2015 07:28:00 GMT" },
      { "If-Match": '"x"' },
      { "If-Unmodified-Since": "Wed, 21 Oct 2015 07:28:00 GMT" },
    ] as Record<string, string>[]) {
      const response = await handler(request(headers), ID);
      expect(response.status, JSON.stringify(headers)).toBe(200);
      expectPrivate(response);
      expect(await bytesOf(response)).toEqual([...BYTES]);
    }
    expect(fetchBytes).toHaveBeenCalledTimes(5);
  });
});

describe("HEAD", () => {
  it("returns the GET status and headers with no body", async () => {
    const { handler, fetchBytes, inspect } = harness();
    const cases: [Record<string, string>, number, string | null][] = [
      [{}, 200, null],
      [{ Range: "bytes=2-4" }, 206, "bytes 2-4/10"],
      [{ Range: "bytes=10-" }, 416, "bytes */10"],
    ];
    for (const [headers, status, contentRange] of cases) {
      const response = await handler(request(headers, { method: "HEAD" }), ID);
      expect(response.status).toBe(status);
      expectPrivate(response);
      expect(response.headers.get("content-range")).toBe(contentRange);
      expect(response.body).toBeNull();
      expect((await response.arrayBuffer()).byteLength).toBe(0);
    }
    const head = await handler(request({}, { method: "HEAD" }), ID);
    expect(head.headers.get("content-length")).toBe("10");
    expect(head.headers.get("content-type")).toBe("audio/webm");
    // Size comes from the same bounded, validated fetch, never metadata.
    expect(fetchBytes).toHaveBeenCalledTimes(4);
    expect(inspect).toHaveBeenCalledTimes(4);
  });
});

describe("authentication comes before any record or upstream work", () => {
  const expired = async () =>
    `__Host-shoebox=${(await issueSession(Math.floor(Date.now() / 1000) - WEEK - 60)).token}`;

  it.each(["GET", "HEAD"])(
    "%s answers 401 for missing, forged and expired sessions",
    async (method) => {
      const { handler, resolve, fetchBytes, inspect } = harness();
      const cookies = [
        undefined,
        "__Host-shoebox=eyJhbGciOiJIUzI1NiJ9.eyJ2IjoxfQ.Zm9yZ2Vk",
        "shoebox-dev=anything",
        await expired(),
      ];
      for (const value of cookies) {
        for (const extra of [
          {},
          { Range: "bytes=0-1" },
          { "If-None-Match": "*" },
          { Range: "bytes=0-1,4-5" },
        ] as Record<string, string>[]) {
          const response = await handler(
            request(
              { ...(value ? { cookie: value } : {}), ...extra },
              { method, auth: false },
            ),
            ID,
          );
          expect(response.status).toBe(401);
          expectPrivate(response);
          expect(response.headers.get("content-range")).toBeNull();
          if (method === "HEAD") expect(response.body).toBeNull();
          else expect((await response.json()).error.code).toBe("UNAUTHORIZED");
        }
      }
      expect(resolve).not.toHaveBeenCalled();
      expect(fetchBytes).not.toHaveBeenCalled();
      expect(inspect).not.toHaveBeenCalled();
    },
  );

  it("refuses a cross-site embed before authentication", async () => {
    const { handler, resolve } = harness();
    const response = await handler(
      request({ "sec-fetch-site": "cross-site" }),
      ID,
    );
    expect(response.status).toBe(403);
    expectPrivate(response);
    expect(resolve).not.toHaveBeenCalled();
  });

  it("an authenticated query string (url=...) is refused, never proxied", async () => {
    const { handler, resolve, fetchBytes } = harness();
    for (const query of [
      "?url=https://attacker.test/x.jpg",
      "?url=%2Fimages%2Fdali1.webp",
      "?w=64",
      "?",
    ]) {
      const response = await handler(
        request({}, { path: `${PATH}${query}` }),
        ID,
      );
      expect(response.status, query).toBe(400);
      expectPrivate(response);
    }
    expect(resolve).not.toHaveBeenCalled();
    expect(fetchBytes).not.toHaveBeenCalled();
  });

  it("an unauthenticated query string is still 401", async () => {
    const { handler } = harness();
    const response = await handler(
      request({}, { path: `${PATH}?url=https://attacker.test`, auth: false }),
      ID,
    );
    expect(response.status).toBe(401);
  });
});

describe("records and upstream failures", () => {
  it("answers 404 for a missing, wrong-source or trashed record", async () => {
    const { handler, fetchBytes } = harness({
      resolve: vi.fn(async () => {
        throw new ShoeboxError("NOT_FOUND", { detail: "memory" });
      }),
    });
    for (const method of ["GET", "HEAD"]) {
      const response = await handler(request({}, { method }), ID);
      expect(response.status).toBe(404);
      expectPrivate(response);
    }
    expect(fetchBytes).not.toHaveBeenCalled();
  });

  it("never becomes an SSRF proxy for a record with an arbitrary URL", async () => {
    const network = vi.fn(async () => new Response("internal secrets"));
    const urls = [
      "https://169.254.169.254/latest/meta-data",
      "https://attacker.test/x.jpg",
      "https://127.0.0.1/admin",
      "https://prod-files-secure.s3.us-west-2.amazonaws.com.evil.test/a",
    ];
    for (const url of urls) {
      const { handler } = harness({
        resolve: vi.fn(async () => trusted(url)),
        fetchBytes: (media, signal) =>
          fetchTrustedMedia(media, signal, { fetch: network }),
      });
      const response = await handler(request(), ID);
      expect(response.status, url).toBe(404);
      expectPrivate(response);
      expect(await response.text()).not.toContain("internal secrets");
    }
    expect(network).not.toHaveBeenCalled();
  });

  it("re-resolves an expired link once, then retries once", async () => {
    const fetchBytes = vi
      .fn<MediaHandlerDeps["fetchBytes"] & {}>()
      .mockRejectedValueOnce(
        new ShoeboxError("UNAVAILABLE", { detail: MEDIA_LINK_EXPIRED }),
      )
      .mockResolvedValueOnce(Uint8Array.from(BYTES));
    const { handler, resolve } = harness({ fetchBytes });
    const response = await handler(request(), ID);
    expect(response.status).toBe(200);
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(fetchBytes).toHaveBeenCalledTimes(2);
  });

  it("stops after one refresh when the fresh link is also expired", async () => {
    const fetchBytes = vi.fn(async () => {
      throw new ShoeboxError("UNAVAILABLE", { detail: MEDIA_LINK_EXPIRED });
    });
    const { handler, resolve } = harness({ fetchBytes });
    const response = await handler(request(), ID);
    expect(response.status).toBe(503);
    expectPrivate(response);
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(fetchBytes).toHaveBeenCalledTimes(2);
  });

  it("does not retry other upstream failures", async () => {
    const fetchBytes = vi.fn(async () => {
      throw new ShoeboxError("UNAVAILABLE", { detail: "media_upstream" });
    });
    const { handler, resolve } = harness({ fetchBytes });
    const response = await handler(request(), ID);
    expect(response.status).toBe(503);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(fetchBytes).toHaveBeenCalledTimes(1);
  });

  it("a record that vanishes on refresh is 404", async () => {
    const resolve = vi
      .fn<MediaHandlerDeps["resolve"] & {}>()
      .mockResolvedValueOnce(trusted())
      .mockRejectedValueOnce(new ShoeboxError("NOT_FOUND"));
    const fetchBytes = vi.fn(async () => {
      throw new ShoeboxError("UNAVAILABLE", { detail: MEDIA_LINK_EXPIRED });
    });
    const { handler } = harness({ resolve, fetchBytes });
    expect((await handler(request(), ID)).status).toBe(404);
  });

  it("rejects a refreshed record of a different kind", async () => {
    const resolve = vi
      .fn<MediaHandlerDeps["resolve"] & {}>()
      .mockResolvedValueOnce(trusted())
      .mockResolvedValueOnce({
        kind: "photo",
        url: new URL(SIGNED),
        expectedMimeType: "image/jpeg",
      });
    const fetchBytes = vi
      .fn<MediaHandlerDeps["fetchBytes"] & {}>()
      .mockRejectedValueOnce(
        new ShoeboxError("UNAVAILABLE", { detail: MEDIA_LINK_EXPIRED }),
      )
      .mockResolvedValue(Uint8Array.from(BYTES));
    const { handler } = harness({ resolve, fetchBytes });
    const response = await handler(request(), ID);
    expect(response.status).toBe(503);
    expect(fetchBytes).toHaveBeenCalledTimes(1);
  });

  it("rejects content that inspects as a different type before any media header", async () => {
    const { handler } = harness({
      inspect: vi.fn(async () => ({
        mimeType: "audio/ogg",
        durationSeconds: 1,
      })),
    });
    const response = await handler(request(), ID);
    expect(response.status).toBe(503);
    expectPrivate(response);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("accept-ranges")).toBeNull();
  });

  it.each([
    ["unsupported", new ShoeboxError("UNSUPPORTED_MEDIA")],
    [
      "over-long",
      new ShoeboxError("INVALID_INPUT", { detail: "media_duration" }),
    ],
    ["too large", new ShoeboxError("TOO_LARGE")],
    ["busy", new ShoeboxError("UNAVAILABLE", { detail: "media_busy" })],
    ["deadline", new ShoeboxError("UNAVAILABLE", { detail: "media_deadline" })],
  ])("maps a %s stored file to 503", async (_label, error) => {
    const { handler } = harness({
      inspect: vi.fn(async () => {
        throw error;
      }),
    });
    const response = await handler(request(), ID);
    expect(response.status).toBe(503);
    expectPrivate(response);
    expect(response.headers.get("content-range")).toBeNull();
  });

  it("never serves an empty or oversized buffer", async () => {
    for (const size of [0, 4_000_001]) {
      const { handler, inspect } = harness({
        fetchBytes: vi.fn(async () => new Uint8Array(size)),
      });
      const response = await handler(request(), ID);
      expect(response.status).toBe(503);
      expect(inspect).not.toHaveBeenCalled();
    }
  });

  it("finishes no media response after the client disconnects", async () => {
    const controller = new AbortController();
    const { handler } = harness({
      inspect: vi.fn(async () => {
        controller.abort();
        return { mimeType: "audio/webm", durationSeconds: 2 };
      }),
    });
    const response = await handler(
      request({}, { signal: controller.signal }),
      ID,
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  it("passes the request's abort to the upstream fetch", async () => {
    const controller = new AbortController();
    let seen: AbortSignal | undefined;
    const fetchBytes = vi.fn(
      (_media: TrustedMedia, signal: AbortSignal) =>
        new Promise<Uint8Array>((_resolve, reject) => {
          seen = signal;
          signal.addEventListener("abort", () =>
            reject(
              new ShoeboxError("UNAVAILABLE", { detail: "media_aborted" }),
            ),
          );
        }),
    );
    const { handler } = harness({ fetchBytes });
    const pending = handler(request({}, { signal: controller.signal }), ID);
    await new Promise((resolve) => setTimeout(resolve, 5));
    controller.abort();
    expect((await pending).status).toBe(503);
    expect(seen?.aborted).toBe(true);
  });

  it("bounds the whole media request with its own budget", async () => {
    const fetchBytes = vi.fn(
      (_media: TrustedMedia, signal: AbortSignal) =>
        new Promise<Uint8Array>((_resolve, reject) => {
          signal.addEventListener("abort", () =>
            reject(
              new ShoeboxError("UNAVAILABLE", { detail: "media_aborted" }),
            ),
          );
        }),
    );
    const { handler } = harness({ fetchBytes, budgetMs: 30 });
    const started = Date.now();
    const response = await handler(request(), ID);
    expect(response.status).toBe(503);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("never leaks the signed URL into any error body", async () => {
    const failures: Partial<MediaHandlerDeps>[] = [
      {
        fetchBytes: vi.fn(async () => {
          throw new TypeError(`fetch failed ${SIGNED}`);
        }),
      },
      {
        inspect: vi.fn(async () => {
          throw new Error(`worker died reading ${SIGNED}`);
        }),
      },
      {
        resolve: vi.fn(async () => {
          throw new Error(SIGNED);
        }),
      },
    ];
    for (const deps of failures) {
      const { handler } = harness(deps);
      const response = await handler(request(), ID);
      expect(response.status).toBe(503);
      const text = await response.text();
      expect(text).not.toContain("SECRETSIG");
      expect(text).not.toContain("amazonaws");
      expect(JSON.stringify([...response.headers.entries()])).not.toContain(
        "amazonaws",
      );
    }
  });
});

describe("media concurrency", () => {
  // Real JWT checks finish in any order; these tests pin arrival order.
  const immediate = async () => ({});

  it("queues beyond the slot limit instead of failing", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let running = 0;
    let peak = 0;
    const fetchBytes = vi.fn(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await gate;
      running -= 1;
      return Uint8Array.from(BYTES);
    });
    const { handler } = harness({
      fetchBytes,
      requireSession: immediate,
      maxConcurrent: 2,
      maxQueued: 8,
    });
    const pending = Array.from({ length: 5 }, () => handler(request(), ID));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(fetchBytes).toHaveBeenCalledTimes(2);
    release();
    const responses = await Promise.all(pending);
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(peak).toBe(2);
  });

  it("answers 503 when the queue is full", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchBytes = vi.fn(async () => {
      await gate;
      return Uint8Array.from(BYTES);
    });
    const { handler } = harness({
      fetchBytes,
      requireSession: immediate,
      maxConcurrent: 1,
      maxQueued: 1,
    });
    const pending = Array.from({ length: 3 }, () => handler(request(), ID));
    const third = await pending[2];
    expect(third.status).toBe(503);
    expectPrivate(third);
    release();
    expect((await pending[0]).status).toBe(200);
    expect((await pending[1]).status).toBe(200);
  });

  it("a queued request that aborts leaves the queue", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchBytes = vi.fn(async () => {
      await gate;
      return Uint8Array.from(BYTES);
    });
    const { handler } = harness({
      fetchBytes,
      requireSession: immediate,
      maxConcurrent: 1,
      maxQueued: 1,
    });
    const first = handler(request(), ID);
    const controller = new AbortController();
    const queued = handler(request({}, { signal: controller.signal }), ID);
    await new Promise((resolve) => setTimeout(resolve, 5));
    controller.abort();
    expect((await queued).status).toBe(503);
    const next = handler(request(), ID);
    release();
    expect((await first).status).toBe(200);
    expect((await next).status).toBe(200);
    expect(fetchBytes).toHaveBeenCalledTimes(2);
  });
});

describe("route module", () => {
  const context = { params: Promise.resolve({ id: ID }) };

  it("GET and HEAD authenticate before any network or record access", async () => {
    const network = vi.spyOn(globalThis, "fetch");
    for (const headers of [
      {},
      { cookie: "__Host-shoebox=forged" },
      { Range: "bytes=0-1" },
      { "If-None-Match": "*" },
    ] as Record<string, string>[]) {
      const get = await route.GET(request(headers, { auth: false }), context);
      expect(get.status).toBe(401);
      expectPrivate(get);
      const head = await route.HEAD(
        request(headers, { method: "HEAD", auth: false }),
        context,
      );
      expect(head.status).toBe(401);
      expect(head.body).toBeNull();
      expectPrivate(head);
    }
    expect(network).not.toHaveBeenCalled();
  });

  it("an authenticated bad id is 404 before any network", async () => {
    const network = vi.spyOn(globalThis, "fetch");
    const response = await route.GET(request(), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(response.status).toBe(404);
    expect(network).not.toHaveBeenCalled();
  });

  it("answers other methods and OPTIONS with a private 405", async () => {
    const others = {
      POST: route.POST,
      PUT: route.PUT,
      PATCH: route.PATCH,
      DELETE: route.DELETE,
      OPTIONS: route.OPTIONS,
    };
    for (const [name, handler] of Object.entries(others)) {
      const response = await handler();
      expect(response.status, name).toBe(405);
      expect(response.headers.get("allow")).toBe("GET, HEAD");
      expectPrivate(response);
    }
  });

  it("keeps the shoebox route settings", () => {
    expect(route.runtime).toBe("nodejs");
    expect(route.dynamic).toBe("force-dynamic");
    expect(route.maxDuration).toBe(60);
  });
});
