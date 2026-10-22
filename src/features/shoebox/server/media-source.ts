import "server-only";
import { MAX_FILE_BYTES, MEDIA_ASSET_TIMEOUT_MS } from "../limits";
import { ShoeboxError } from "./errors";
import type { TrustedMedia } from "./memory-service";

/** Detail of the one upstream failure that may trigger a fresh resolve. */
export const MEDIA_LINK_EXPIRED = "media_link_expired";

export type FetchTrustedMediaOptions = {
  /** Injected in tests; production uses the global fetch. */
  fetch?: typeof fetch;
  timeoutMs?: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const segments = (pathname: string): string[] => pathname.split("/").slice(1);
const filled = (parts: string[]): boolean =>
  parts.every((part) => part.length > 0);

/**
 * Exact Notion attachment hosts and the path shapes Notion issues on each.
 * Literal hostnames only: no wildcard subdomains, regions or buckets. A new
 * Notion host needs an explicit review here, never a broader pattern.
 */
const HOST_PATHS: Record<string, (parts: string[]) => boolean> = {
  // /<workspace id>/<file id>/<filename>
  "prod-files-secure.s3.us-west-2.amazonaws.com": (parts) =>
    parts.length >= 3 && filled(parts),
  // Legacy path-style bucket: /secure.notion-static.com/<file id>/<filename>
  "s3.us-west-2.amazonaws.com": (parts) =>
    parts.length >= 3 &&
    parts[0] === "secure.notion-static.com" &&
    filled(parts),
  // Observed signed form: /f/f/<workspace id>/<file id>/<filename>
  "file.notion.so": (parts) =>
    parts.length >= 5 &&
    parts[0] === "f" &&
    parts[1] === "f" &&
    UUID.test(parts[2]) &&
    UUID.test(parts[3]) &&
    filled(parts),
};

/**
 * Plain https on the default port, no userinfo, an exact allowlisted host and
 * its path shape. IP literals and every other host are refused by omission.
 */
export function isTrustedMediaUrl(url: URL): boolean {
  if (url.protocol !== "https:" || url.port !== "") return false;
  if (url.username !== "" || url.password !== "") return false;
  if (!Object.hasOwn(HOST_PATHS, url.hostname)) return false;
  return HOST_PATHS[url.hostname](segments(url.pathname));
}

const unavailable = (detail: string) =>
  new ShoeboxError("UNAVAILABLE", { detail });

function discard(response: Response): void {
  response.body?.cancel().catch(() => undefined);
}

/**
 * Downloads one trusted attachment into memory, at most MAX_FILE_BYTES.
 * Redirects are refused, not followed; nothing from the browser request
 * (cookies, Range, Authorization) and no Notion API token is sent. Errors
 * carry only fixed detail tokens, never the URL, Location or upstream text.
 */
export async function fetchTrustedMedia(
  media: TrustedMedia,
  signal: AbortSignal,
  options: FetchTrustedMediaOptions = {},
): Promise<Uint8Array> {
  if (!isTrustedMediaUrl(media.url)) {
    throw new ShoeboxError("NOT_FOUND", { detail: "media_host" });
  }
  if (signal.aborted) throw unavailable("media_aborted");

  const fetchImpl = options.fetch ?? fetch;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? MEDIA_ASSET_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal.addEventListener("abort", onAbort, { once: true });
  const stopped = () =>
    unavailable(timedOut ? "media_deadline" : "media_aborted");

  try {
    let response: Response;
    try {
      response = await fetchImpl(media.url.href, {
        method: "GET",
        // An encoded body would be decompressed and fail the size check.
        headers: new Headers({ "Accept-Encoding": "identity" }),
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
    } catch {
      throw controller.signal.aborted
        ? stopped()
        : unavailable("media_transport");
    }
    return await readBounded(response, controller.signal, stopped);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

async function readBounded(
  response: Response,
  signal: AbortSignal,
  stopped: () => ShoeboxError,
): Promise<Uint8Array> {
  if (
    response.type === "opaqueredirect" ||
    (response.status >= 300 && response.status < 400)
  ) {
    discard(response);
    throw unavailable("media_redirect");
  }
  if (response.status === 403) {
    // Signed S3 links answer 403 once they expire.
    discard(response);
    throw unavailable(MEDIA_LINK_EXPIRED);
  }
  if (response.status !== 200 || !response.body) {
    discard(response);
    throw unavailable("media_upstream");
  }

  const declaredHeader = response.headers.get("content-length");
  let declared: number | undefined;
  if (declaredHeader !== null) {
    if (!/^\d{1,15}$/.test(declaredHeader)) {
      discard(response);
      throw unavailable("media_length");
    }
    declared = Number(declaredHeader);
    if (declared > MAX_FILE_BYTES) {
      discard(response);
      throw unavailable("media_too_large");
    }
  }

  // The declared length is only a hint: actual bytes are counted.
  const reader = response.body.getReader();
  const onAbort = () => {
    reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", onAbort, { once: true });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch {
        throw signal.aborted ? stopped() : unavailable("media_transport");
      }
      if (signal.aborted) throw stopped();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > MAX_FILE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw unavailable("media_too_large");
      }
      chunks.push(result.value);
    }
  } finally {
    signal.removeEventListener("abort", onAbort);
  }

  if (total === 0) throw unavailable("media_empty");
  if (declared !== undefined && declared !== total) {
    throw unavailable("media_length");
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
