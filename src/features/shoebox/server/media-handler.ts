import "server-only";
import {
  MAX_FILE_BYTES,
  MEDIA_READ_MAX_QUEUED,
  MEDIA_REQUEST_BUDGET_MS,
  MEDIA_WORKER_MAX_CONCURRENCY,
} from "../limits";
import { parseByteRange } from "./byte-range";
import { ShoeboxError } from "./errors";
import {
  assertSameOriginRead,
  privateResponse,
  toErrorResponse,
  withoutBody,
} from "./http";
import { fetchTrustedMedia, MEDIA_LINK_EXPIRED } from "./media-source";
import { inspectStoredMedia, type MediaKind } from "./media-validation";
import type { TrustedMedia } from "./memory-service";
import { requireRequestSession } from "./session";
import { getMemoryService } from "./shared-service";

/** Every dependency is injectable; defaults are built lazily, after auth. */
export type MediaHandlerDeps = {
  requireSession?: (request: Request) => Promise<unknown>;
  resolve?: (id: string) => Promise<TrustedMedia>;
  fetchBytes?: (
    media: TrustedMedia,
    signal: AbortSignal,
  ) => Promise<Uint8Array>;
  inspect?: (
    bytes: Uint8Array,
    kind: MediaKind,
    signal?: AbortSignal,
  ) => Promise<{ mimeType: string }>;
  budgetMs?: number;
  maxConcurrent?: number;
  maxQueued?: number;
};

type MediaHandler = (request: Request, id: string) => Promise<Response>;

const unavailable = (detail: string) =>
  new ShoeboxError("UNAVAILABLE", { detail });

/**
 * A FIFO limit on media reads in flight, so one batch of photos queues for
 * the two inspection workers instead of failing, and buffered bytes stay
 * bounded. A full queue is a 503; an aborted waiter leaves the queue.
 */
function createSlots(max: number, maxQueued: number) {
  let active = 0;
  const waiting: (() => void)[] = [];

  function release(): void {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  }

  async function acquire(signal: AbortSignal): Promise<() => void> {
    if (signal.aborted) throw unavailable("media_aborted");
    if (active < max) {
      active += 1;
    } else {
      if (waiting.length >= maxQueued) {
        throw new ShoeboxError("UNAVAILABLE", {
          detail: "media_busy",
          retryAfterSeconds: 1,
        });
      }
      // The releasing request hands its slot straight to this waiter.
      await new Promise<void>((resolve, reject) => {
        const grant = () => {
          signal.removeEventListener("abort", onAbort);
          resolve();
        };
        const onAbort = () => {
          const index = waiting.indexOf(grant);
          if (index !== -1) waiting.splice(index, 1);
          reject(unavailable("media_aborted"));
        };
        waiting.push(grant);
        signal.addEventListener("abort", onAbort, { once: true });
      });
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      release();
    };
  }

  return { acquire };
}

const isExpiredLink = (error: unknown) =>
  error instanceof ShoeboxError && error.detail === MEDIA_LINK_EXPIRED;

/**
 * GET/HEAD `/api/shoebox/memories/:id/media`. Order: Fetch Metadata, session,
 * no query input, then (inside a bounded slot and budget) the trusted record,
 * the bounded upstream download, worker inspection without re-encoding, and
 * only then our own canonical headers and the requested single range.
 */
export function createMediaHandler(deps: MediaHandlerDeps = {}): MediaHandler {
  const requireSession =
    deps.requireSession ??
    ((request: Request) => requireRequestSession(request));
  const resolve =
    deps.resolve ?? ((id: string) => getMemoryService().resolveMemoryMedia(id));
  const fetchBytes =
    deps.fetchBytes ??
    ((media: TrustedMedia, signal: AbortSignal) =>
      fetchTrustedMedia(media, signal));
  const inspect = deps.inspect ?? inspectStoredMedia;
  const budgetMs = deps.budgetMs ?? MEDIA_REQUEST_BUDGET_MS;
  const slots = createSlots(
    // One read per inspection worker: downloads wait instead of buffering.
    deps.maxConcurrent ?? MEDIA_WORKER_MAX_CONCURRENCY,
    deps.maxQueued ?? MEDIA_READ_MAX_QUEUED,
  );

  /** Resolves, downloads and validates; refreshes an expired link once. */
  async function load(
    id: string,
    signal: AbortSignal,
  ): Promise<{ media: TrustedMedia; bytes: Uint8Array }> {
    let media = await resolve(id);
    let bytes: Uint8Array;
    try {
      bytes = await fetchBytes(media, signal);
    } catch (error) {
      if (!isExpiredLink(error) || signal.aborted) throw error;
      const fresh = await resolve(id);
      if (
        fresh.kind !== media.kind ||
        fresh.expectedMimeType !== media.expectedMimeType
      ) {
        throw unavailable("media_changed");
      }
      media = fresh;
      bytes = await fetchBytes(media, signal);
    }
    if (signal.aborted) throw unavailable("media_aborted");
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_FILE_BYTES) {
      throw unavailable("media_bytes");
    }

    let info: { mimeType: string };
    try {
      info = await inspect(bytes, media.kind, signal);
    } catch (error) {
      // A stored file that no longer validates is an upstream failure, not
      // the caller's 415/422; busy/deadline stay 503 with their own detail.
      if (error instanceof ShoeboxError && error.code === "UNAVAILABLE") {
        throw error;
      }
      throw unavailable("media_stored");
    }
    if (info.mimeType !== media.expectedMimeType) {
      throw unavailable("media_mismatch");
    }
    if (signal.aborted) throw unavailable("media_aborted");
    return { media, bytes };
  }

  async function serve(request: Request, id: string): Promise<Response> {
    assertSameOriginRead(request.headers);
    await requireSession(request);
    // The only input is the path id: no url=, width or any other query.
    if (request.url.includes("?")) {
      throw new ShoeboxError("INVALID_INPUT", {
        status: 400,
        detail: "media_query",
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), budgetMs);
    const onAbort = () => controller.abort();
    request.signal.addEventListener("abort", onAbort, { once: true });
    if (request.signal.aborted) controller.abort();

    let loaded: { media: TrustedMedia; bytes: Uint8Array };
    try {
      const release = await slots.acquire(controller.signal);
      try {
        loaded = await load(id, controller.signal);
      } finally {
        release();
      }
    } finally {
      clearTimeout(timer);
      request.signal.removeEventListener("abort", onAbort);
    }
    if (controller.signal.aborted) throw unavailable("media_aborted");

    const { media, bytes } = loaded;
    const total = bytes.byteLength;
    // No validator is ever issued, so an If-Range can never match: RFC 9110
    // says to send the whole representation. Other conditionals are ignored.
    const rangeHeader = request.headers.has("if-range")
      ? null
      : request.headers.get("range");
    let range: ReturnType<typeof parseByteRange>;
    try {
      range = parseByteRange(rangeHeader, total);
    } catch (error) {
      const response = toErrorResponse(error);
      response.headers.set("Content-Range", `bytes */${total}`);
      return response;
    }

    const headers: Record<string, string> = {
      "Content-Type": media.expectedMimeType,
      "Accept-Ranges": "bytes",
      "Content-Disposition": "inline",
    };
    if (range === null) {
      headers["Content-Length"] = String(total);
      // Freshly allocated by the bounded reader, so ArrayBuffer-backed.
      return privateResponse(bytes as Uint8Array<ArrayBuffer>, 200, headers);
    }
    const { start, end } = range;
    headers["Content-Length"] = String(end - start + 1);
    headers["Content-Range"] = `bytes ${start}-${end}/${total}`;
    return privateResponse(bytes.slice(start, end + 1), 206, headers);
  }

  return async (request, id) => {
    let response: Response;
    try {
      response = await serve(request, id);
    } catch (error) {
      response = toErrorResponse(error);
    }
    // HEAD runs the same path (auth, bounded fetch, validation); no body.
    return request.method === "HEAD" ? withoutBody(response) : response;
  };
}
