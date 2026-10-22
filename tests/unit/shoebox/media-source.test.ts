import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_FILE_BYTES } from "@/features/shoebox/limits";
import { ShoeboxError } from "@/features/shoebox/server/errors";
import {
  fetchTrustedMedia,
  isTrustedMediaUrl,
  MEDIA_LINK_EXPIRED,
} from "@/features/shoebox/server/media-source";
import type { TrustedMedia } from "@/features/shoebox/server/memory-service";

const SIGNED =
  "https://prod-files-secure.s3.us-west-2.amazonaws.com/0f0f0f0f-0000-4000-8000-000000000001/1e1e1e1e-0000-4000-8000-000000000002/memory.weba?X-Amz-Signature=SECRETSIG&X-Amz-Credential=AKIASECRET";

function media(url: string = SIGNED): TrustedMedia {
  return { kind: "audio", url: new URL(url), expectedMimeType: "audio/webm" };
}

type Streamed = {
  response: Response;
  cancelled: () => boolean;
  pulls: () => number;
};

/** A body that yields `chunks` one pull at a time and records cancellation. */
function streamed(
  chunks: Uint8Array[],
  init: ResponseInit = {},
  { endless = false }: { endless?: boolean } = {},
): Streamed {
  let cancelled = false;
  let pulls = 0;
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      if (index < chunks.length) {
        controller.enqueue(chunks[index]);
        index += 1;
        return;
      }
      if (endless) return new Promise<void>(() => undefined);
      controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  return {
    response: new Response(body, { status: 200, ...init }),
    cancelled: () => cancelled,
    pulls: () => pulls,
  };
}

function chunked(total: number, size = 500_000): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let left = total; left > 0; left -= size) {
    out.push(new Uint8Array(Math.min(size, left)).fill(7));
  }
  return out;
}

function fakeFetch(response: Response | (() => Promise<Response>)) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    typeof response === "function" ? response() : response,
  );
}

function signal(): AbortSignal {
  return new AbortController().signal;
}

async function failure(promise: Promise<unknown>): Promise<ShoeboxError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ShoeboxError);
    return error as ShoeboxError;
  }
  throw new Error("expected a rejection");
}

let logs: ReturnType<typeof vi.spyOn>[];
beforeEach(() => {
  logs = (["error", "warn", "log", "info", "debug"] as const).map((name) =>
    vi.spyOn(console, name).mockImplementation(() => undefined),
  );
});
afterEach(() => {
  const written = JSON.stringify(logs.map((spy) => spy.mock.calls));
  expect(written).not.toContain("SECRETSIG");
  expect(written).not.toContain("AKIASECRET");
  expect(written).not.toContain("amazonaws");
  vi.restoreAllMocks();
});

describe("trusted media URL policy", () => {
  it.each([
    SIGNED,
    "https://prod-files-secure.s3.us-west-2.amazonaws.com/a/b/c.jpg?X-Amz-Signature=1",
    "https://s3.us-west-2.amazonaws.com/secure.notion-static.com/0f0f0f0f-0000-4000-8000-000000000001/memory.jpg?X-Amz-Signature=1",
    "https://file.notion.so/f/f/0f0f0f0f-0000-4000-8000-000000000001/1e1e1e1e-0000-4000-8000-000000000002/memory.jpg?table=block&id=x&signature=y",
    "https://PROD-FILES-SECURE.S3.US-WEST-2.AMAZONAWS.COM/a/b/c.jpg",
    "https://prod-files-secure.s3.us-west-2.amazonaws.com:443/a/b/c.jpg",
  ])("allows %s", (url) => {
    expect(isTrustedMediaUrl(new URL(url))).toBe(true);
  });

  it.each([
    [
      "plain http",
      "http://prod-files-secure.s3.us-west-2.amazonaws.com/w/f/a.jpg",
    ],
    [
      "userinfo",
      "https://user:pw@prod-files-secure.s3.us-west-2.amazonaws.com/w/f/a.jpg",
    ],
    [
      "username only",
      "https://u@prod-files-secure.s3.us-west-2.amazonaws.com/w/f/a.jpg",
    ],
    [
      "custom port",
      "https://prod-files-secure.s3.us-west-2.amazonaws.com:8443/w/f/a.jpg",
    ],
    [
      "suffix confusion",
      "https://prod-files-secure.s3.us-west-2.amazonaws.com.evil.test/w/f/a.jpg",
    ],
    [
      "prefix confusion",
      "https://evilprod-files-secure.s3.us-west-2.amazonaws.com/w/f/a.jpg",
    ],
    [
      "subdomain",
      "https://x.prod-files-secure.s3.us-west-2.amazonaws.com/w/f/a.jpg",
    ],
    [
      "trailing dot",
      "https://prod-files-secure.s3.us-west-2.amazonaws.com./w/f/a.jpg",
    ],
    [
      "other region",
      "https://prod-files-secure.s3.eu-west-1.amazonaws.com/w/f/a.jpg",
    ],
    [
      "other bucket host",
      "https://attacker.s3.us-west-2.amazonaws.com/w/f/a.jpg",
    ],
    [
      "path-style other bucket",
      "https://s3.us-west-2.amazonaws.com/attacker/a",
    ],
    [
      "path-style bucket prefix",
      "https://s3.us-west-2.amazonaws.com/secure.notion-static.com.evil/a",
    ],
    [
      "path-style bare bucket",
      "https://s3.us-west-2.amazonaws.com/secure.notion-static.com/",
    ],
    [
      "path-style traversal",
      "https://s3.us-west-2.amazonaws.com/secure.notion-static.com/../attacker/a",
    ],
    [
      "encoded traversal",
      "https://s3.us-west-2.amazonaws.com/secure.notion-static.com/%2e%2e/attacker/a",
    ],
    [
      "path-style other bucket, deep",
      "https://s3.us-west-2.amazonaws.com/attacker/0f0f0f0f-0000-4000-8000-000000000001/a.jpg",
    ],
    [
      "path-style lookalike bucket, deep",
      "https://s3.us-west-2.amazonaws.com/secure.notion-static.com.evil/x/a.jpg",
    ],
    ["notion root", "https://prod-files-secure.s3.us-west-2.amazonaws.com/"],
    ["file.notion.so other path", "https://file.notion.so/secret"],
    ["file.notion.so short path", "https://file.notion.so/f/f/abc"],
    [
      "notion.so",
      "https://www.notion.so/f/f/0f0f0f0f-0000-4000-8000-000000000001/1e1e1e1e-0000-4000-8000-000000000002/a.jpg",
    ],
    ["api host", "https://api.notion.com/v1/pages"],
    ["loopback", "https://127.0.0.1/a"],
    ["metadata ip", "https://169.254.169.254/latest/meta-data"],
    ["private ip", "https://10.0.0.1/a"],
    ["ipv6 loopback", "https://[::1]/a"],
    ["decimal ip", "https://2130706433/a"],
    ["localhost", "https://localhost/a"],
    ["data", "data:image/jpeg;base64,AAAA"],
    ["file", "file:///etc/passwd"],
  ])("denies %s", (_label, url) => {
    expect(isTrustedMediaUrl(new URL(url))).toBe(false);
  });
});

describe("fetchTrustedMedia", () => {
  it("fetches without credentials, cookies, Authorization or redirects", async () => {
    const fetch = fakeFetch(streamed([new Uint8Array([1, 2, 3])]).response);
    const bytes = await fetchTrustedMedia(media(), signal(), { fetch });
    expect([...bytes]).toEqual([1, 2, 3]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [input, init] = fetch.mock.calls[0];
    expect(String(input)).toBe(new URL(SIGNED).href);
    expect(init).toMatchObject({
      method: "GET",
      redirect: "manual",
      credentials: "omit",
      cache: "no-store",
    });
    const headers = new Headers(init?.headers);
    expect(headers.has("authorization")).toBe(false);
    expect(headers.has("cookie")).toBe(false);
    expect(headers.has("range")).toBe(false);
    const sent = JSON.stringify([...headers.entries()]);
    expect(sent).not.toContain(process.env.NOTION_API_KEY ?? "test-notion-key");
    expect(sent).not.toContain("Bearer");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("asks the host for an unencoded body so declared and actual sizes match", async () => {
    const fetch = fakeFetch(streamed([new Uint8Array([1, 2, 3])]).response);
    await fetchTrustedMedia(media(), signal(), { fetch });
    const headers = new Headers(fetch.mock.calls[0][1]?.headers);
    expect(headers.get("accept-encoding")).toBe("identity");
  });

  it("never calls fetch for an untrusted URL", async () => {
    const fetch = fakeFetch(streamed([new Uint8Array([1])]).response);
    for (const url of [
      "https://169.254.169.254/latest/meta-data",
      "https://attacker.test/x.jpg",
      "https://prod-files-secure.s3.us-west-2.amazonaws.com.evil.test/w/f/a.jpg",
    ]) {
      const error = await failure(
        fetchTrustedMedia(media(url), signal(), { fetch }),
      );
      expect(error.code).toBe("NOT_FOUND");
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("accepts exactly 4,000,000 bytes without a Content-Length", async () => {
    const fetch = fakeFetch(streamed(chunked(MAX_FILE_BYTES)).response);
    const bytes = await fetchTrustedMedia(media(), signal(), { fetch });
    expect(bytes.byteLength).toBe(MAX_FILE_BYTES);
  });

  it("accepts exactly 4,000,000 bytes with a matching Content-Length", async () => {
    const fetch = fakeFetch(
      streamed(chunked(MAX_FILE_BYTES), {
        headers: { "Content-Length": String(MAX_FILE_BYTES) },
      }).response,
    );
    const bytes = await fetchTrustedMedia(media(), signal(), { fetch });
    expect(bytes.byteLength).toBe(MAX_FILE_BYTES);
  });

  it("cancels at 4,000,001 bytes without a Content-Length", async () => {
    const body = streamed(chunked(MAX_FILE_BYTES + 1), {}, { endless: true });
    const error = await failure(
      fetchTrustedMedia(media(), signal(), { fetch: fakeFetch(body.response) }),
    );
    expect(error.code).toBe("UNAVAILABLE");
    expect(body.cancelled()).toBe(true);
  });

  it("cancels at 4,000,001 bytes despite a smaller Content-Length", async () => {
    const body = streamed(
      chunked(MAX_FILE_BYTES + 1),
      { headers: { "Content-Length": "10" } },
      { endless: true },
    );
    const error = await failure(
      fetchTrustedMedia(media(), signal(), { fetch: fakeFetch(body.response) }),
    );
    expect(error.code).toBe("UNAVAILABLE");
    expect(body.cancelled()).toBe(true);
  });

  it("refuses an oversized Content-Length before reading the body", async () => {
    const body = streamed(chunked(10), {
      headers: { "Content-Length": String(MAX_FILE_BYTES + 1) },
    });
    const error = await failure(
      fetchTrustedMedia(media(), signal(), { fetch: fakeFetch(body.response) }),
    );
    expect(error.code).toBe("UNAVAILABLE");
    expect(body.cancelled()).toBe(true);
    expect(body.pulls()).toBeLessThanOrEqual(1);
  });

  it("refuses a body that differs from its Content-Length", async () => {
    const body = streamed([new Uint8Array(5)], {
      headers: { "Content-Length": "9" },
    });
    const error = await failure(
      fetchTrustedMedia(media(), signal(), { fetch: fakeFetch(body.response) }),
    );
    expect(error.code).toBe("UNAVAILABLE");
  });

  it("refuses an empty body", async () => {
    const error = await failure(
      fetchTrustedMedia(media(), signal(), {
        fetch: fakeFetch(streamed([]).response),
      }),
    );
    expect(error.code).toBe("UNAVAILABLE");
  });

  it.each([301, 302, 303, 307, 308])(
    "refuses a %i redirect without following or exposing Location",
    async (status) => {
      const body = streamed([], {
        status,
        headers: { Location: "https://169.254.169.254/latest?sig=LEAKED" },
      });
      const fetch = fakeFetch(body.response);
      const error = await failure(
        fetchTrustedMedia(media(), signal(), { fetch }),
      );
      expect(error.code).toBe("UNAVAILABLE");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(
        JSON.stringify({ ...error, message: error.message }),
      ).not.toContain("LEAKED");
    },
  );

  it("refuses an opaque redirect", async () => {
    const opaque = {
      type: "opaqueredirect",
      status: 0,
      ok: false,
      headers: new Headers(),
      body: null,
    } as unknown as Response;
    const error = await failure(
      fetchTrustedMedia(media(), signal(), { fetch: fakeFetch(opaque) }),
    );
    expect(error.code).toBe("UNAVAILABLE");
  });

  it("marks a 403 as an expired link so the caller can re-resolve once", async () => {
    const error = await failure(
      fetchTrustedMedia(media(), signal(), {
        fetch: fakeFetch(streamed([], { status: 403 }).response),
      }),
    );
    expect(error.code).toBe("UNAVAILABLE");
    expect(error.detail).toBe(MEDIA_LINK_EXPIRED);
  });

  it.each([400, 404, 500, 503])(
    "maps upstream %i to a bounded failure",
    async (status) => {
      const error = await failure(
        fetchTrustedMedia(media(), signal(), {
          fetch: fakeFetch(streamed([], { status }).response),
        }),
      );
      expect(error.code).toBe("UNAVAILABLE");
      expect(error.detail).not.toBe(MEDIA_LINK_EXPIRED);
    },
  );

  it("sanitizes transport errors that carry the signed URL", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError(`fetch failed for ${SIGNED}`);
    });
    const error = await failure(
      fetchTrustedMedia(media(), signal(), { fetch }),
    );
    expect(error.code).toBe("UNAVAILABLE");
    expect(error.message).not.toContain("SECRETSIG");
    expect(String(error.detail)).not.toContain("SECRETSIG");
  });

  it("cancels the body when the caller aborts mid-stream", async () => {
    const controller = new AbortController();
    const body = streamed([new Uint8Array(10)], {}, { endless: true });
    const pending = fetchTrustedMedia(media(), controller.signal, {
      fetch: fakeFetch(body.response),
    });
    pending.catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();
    const error = await failure(pending);
    expect(error.code).toBe("UNAVAILABLE");
    expect(body.cancelled()).toBe(true);
  });

  it("rejects at once when the caller already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetch = fakeFetch(streamed([new Uint8Array(1)]).response);
    const error = await failure(
      fetchTrustedMedia(media(), controller.signal, { fetch }),
    );
    expect(error.code).toBe("UNAVAILABLE");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stops a stalled body at the asset deadline", async () => {
    const body = streamed([new Uint8Array(10)], {}, { endless: true });
    const started = Date.now();
    const error = await failure(
      fetchTrustedMedia(media(), signal(), {
        fetch: fakeFetch(body.response),
        timeoutMs: 30,
      }),
    );
    expect(error.code).toBe("UNAVAILABLE");
    expect(body.cancelled()).toBe(true);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("stops a stalled connection at the asset deadline", async () => {
    const fetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const error = await failure(
      fetchTrustedMedia(media(), signal(), { fetch, timeoutMs: 30 }),
    );
    expect(error.code).toBe("UNAVAILABLE");
  });

  it("uses a 10 second asset deadline by default", async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      );
      const pending = fetchTrustedMedia(media(), signal(), { fetch });
      let settled = false;
      pending
        .catch(() => undefined)
        .finally(() => {
          settled = true;
        });
      await vi.advanceTimersByTimeAsync(9_900);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(200);
      expect(settled).toBe(true);
      await expect(pending).rejects.toMatchObject({ code: "UNAVAILABLE" });
    } finally {
      vi.useRealTimers();
    }
  });
});
