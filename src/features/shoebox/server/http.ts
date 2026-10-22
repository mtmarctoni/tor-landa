import "server-only";
import type { ApiError } from "@/types/shoebox";
import { ValidationError } from "../validation";
import { ERROR_MESSAGES, ShoeboxError } from "./errors";

const PRIVATE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export function privateJson(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...PRIVATE_HEADERS, "Content-Type": "application/json" },
  });
}

/** Private response for a body the caller has already bounded (media). */
export function privateResponse(
  body: BodyInit | null,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, {
    status,
    headers: { ...PRIVATE_HEADERS, ...headers },
  });
}

/** Body-less private response (204, 405, HEAD). */
export function privateEmpty(
  status: number,
  headers: Record<string, string> = {},
): Response {
  return privateResponse(null, status, headers);
}

/** Explicit 405 so unexpected methods (including OPTIONS) stay private. */
export function methodNotAllowed(allow: readonly string[]): Response {
  return privateEmpty(405, { Allow: allow.join(", ") });
}

/** HEAD runs the full GET path (auth included) and drops only the body. */
export function withoutBody(response: Response): Response {
  response.body?.cancel().catch(() => undefined);
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}

/** Maps any thrown value to a sanitized response; never serializes `error`. */
export function toErrorResponse(error: unknown): Response {
  let code: ApiError["error"]["code"] = "UNAVAILABLE";
  let status = 503;
  let retryAfterSeconds: number | undefined;
  let detail: string | undefined;

  if (error instanceof ShoeboxError) {
    code = error.code;
    detail = error.detail;
    status = error.status;
    retryAfterSeconds = error.retryAfterSeconds;
  } else if (error instanceof ValidationError) {
    code = "INVALID_INPUT";
    status = error.type === "shape" ? 400 : 422;
    detail = error.type;
  }

  const diagnosticId = crypto.randomUUID();
  // Only code, id and a safe token: never the message, stack, URLs or bodies.
  console.error(
    JSON.stringify({ shoebox: "error", code, diagnosticId, detail }),
  );

  const body: ApiError = {
    error: {
      code,
      message: ERROR_MESSAGES[code],
      diagnosticId,
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    },
  };
  const response = privateJson(body, status);
  if (retryAfterSeconds !== undefined) {
    response.headers.set("Retry-After", String(retryAfterSeconds));
  }
  return response;
}

/**
 * Mutations need the exact configured Origin (never Host) and, when the browser
 * sends Fetch Metadata, a same-origin request.
 */
export function assertMutationOrigin(headers: Headers, origin: string): void {
  let expected: string;
  try {
    expected = new URL(origin).origin;
  } catch {
    throw new ShoeboxError("SETUP_REQUIRED");
  }
  const actual = headers.get("origin");
  if (!actual || actual === "null" || actual !== expected) {
    throw new ShoeboxError("FORBIDDEN");
  }
  const site = headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") {
    throw new ShoeboxError("FORBIDDEN");
  }
}

/** Same-origin reads often omit Origin; only reject hostile Fetch Metadata. */
export function assertSameOriginRead(headers: Headers): void {
  const site = headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") {
    throw new ShoeboxError("FORBIDDEN");
  }
}
