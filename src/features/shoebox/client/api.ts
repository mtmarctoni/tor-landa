import type {
  ApiErrorCode,
  MemoryFields,
  MemorySummary,
  RequestStatus,
} from "@/types/shoebox";

/**
 * Browser side of the shoebox HTTP contract. `shoeboxFetch` only talks to
 * fixed same-origin API paths, normalizes every failure (including Vercel's
 * own non-JSON 413/504 pages) into a `ShoeboxApiError`, and never retries.
 * `saveMemory` implements the Task 5 create/reconcile rules: one POST per
 * call, read-only status polling after an unknown outcome, and a resend only
 * when the caller explicitly asks for it with the same Request ID.
 */

export type ClientErrorCode =
  | ApiErrorCode
  | "NETWORK"
  | "TIMEOUT"
  | "BAD_RESPONSE"
  | "ABORTED";

const MESSAGES: Record<ClientErrorCode, string> = {
  UNAUTHORIZED: "La sesión caducó. Vuelve a abrir la caja.",
  FORBIDDEN: "La caja no reconoce esta página. Recárgala e inténtalo otra vez.",
  INVALID_INPUT:
    "Algo del recuerdo no encaja. Revisa el texto, el pie y la fecha.",
  TOO_LARGE:
    "Es demasiado grande para meterlo en la caja (máximo 4 MB). Prueba con un archivo más pequeño.",
  UNSUPPORTED_MEDIA:
    "Este archivo no se puede guardar aquí. Prueba con una foto, otro audio o un texto.",
  NOT_FOUND: "Ese recuerdo ya no está en la caja.",
  REQUEST_CONFLICT: "Este envío ya se usó con otro contenido.",
  OUTCOME_UNKNOWN: "No sabemos todavía si se guardó.",
  RATE_LIMITED:
    "Demasiados intentos seguidos. Espera un minuto e inténtalo otra vez.",
  UNAVAILABLE:
    "La caja está ocupada ahora mismo y no guardó nada. Puedes reintentarlo en un momento.",
  SETUP_REQUIRED: "La caja todavía no está preparada en el servidor.",
  NETWORK: "No pudimos hablar con la caja. Revisa la conexión.",
  TIMEOUT: "La caja tardó demasiado en contestar.",
  BAD_RESPONSE: "La caja contestó algo que no entendimos.",
  ABORTED: "Cancelamos la espera.",
};

const API_CODES = new Set<string>([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "TOO_LARGE",
  "UNSUPPORTED_MEDIA",
  "NOT_FOUND",
  "REQUEST_CONFLICT",
  "OUTCOME_UNKNOWN",
  "RATE_LIMITED",
  "UNAVAILABLE",
  "SETUP_REQUIRED",
]);

/** For responses without a usable JSON envelope (proxies, platform pages). */
const STATUS_CODES: Record<number, ClientErrorCode> = {
  400: "INVALID_INPUT",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "REQUEST_CONFLICT",
  413: "TOO_LARGE",
  415: "UNSUPPORTED_MEDIA",
  422: "INVALID_INPUT",
  429: "RATE_LIMITED",
  504: "TIMEOUT",
};

/** Failures after which a write may or may not have happened. */
const UNCERTAIN = new Set<ClientErrorCode>([
  "OUTCOME_UNKNOWN",
  "NETWORK",
  "TIMEOUT",
  "BAD_RESPONSE",
  "ABORTED",
]);

export class ShoeboxApiError extends Error {
  readonly code: ClientErrorCode;
  readonly status: number | null;
  readonly retryAfterSeconds?: number;
  readonly diagnosticId?: string;

  constructor(
    code: ClientErrorCode,
    status: number | null,
    extra: { retryAfterSeconds?: number; diagnosticId?: string } = {},
  ) {
    super(MESSAGES[code]);
    this.name = "ShoeboxApiError";
    this.code = code;
    this.status = status;
    if (extra.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = extra.retryAfterSeconds;
    }
    if (extra.diagnosticId !== undefined) {
      this.diagnosticId = extra.diagnosticId;
    }
  }
}

export function isOutcomeUncertain(error: unknown): boolean {
  return error instanceof ShoeboxApiError && UNCERTAIN.has(error.code);
}

const UUID =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const ALLOWED_PATH = new RegExp(
  `^/api/shoebox/(?:session|logout|memories(?:\\?cursor=[A-Za-z0-9._~%-]{1,1024})?|memories/${UUID}|requests/${UUID})$`,
);

function retryAfter(response: Response, body: unknown): number | undefined {
  const fromBody = (body as { error?: { retryAfterSeconds?: unknown } })?.error
    ?.retryAfterSeconds;
  if (typeof fromBody === "number" && Number.isFinite(fromBody))
    return fromBody;
  const header = Number(response.headers.get("retry-after"));
  return Number.isFinite(header) && header > 0 ? header : undefined;
}

function envelopeError(
  response: Response,
  body: unknown,
): ShoeboxApiError | null {
  const error = (body as { error?: unknown } | null)?.error;
  if (typeof error !== "object" || error === null) return null;
  const { code, diagnosticId } = error as {
    code?: unknown;
    diagnosticId?: unknown;
  };
  if (typeof code !== "string" || !API_CODES.has(code)) return null;
  return new ShoeboxApiError(code as ApiErrorCode, response.status, {
    retryAfterSeconds: retryAfter(response, body),
    diagnosticId: typeof diagnosticId === "string" ? diagnosticId : undefined,
  });
}

/**
 * Fetches a fixed same-origin shoebox API path. Resolves with the parsed JSON
 * body (undefined for 204) and rejects with `ShoeboxApiError` otherwise,
 * including a 202 OUTCOME_UNKNOWN envelope although `response.ok` is true.
 */
export async function shoeboxFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!ALLOWED_PATH.test(path)) {
    throw new Error("shoeboxFetch: ruta no permitida");
  }
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      mode: "same-origin",
      // WebKit/Firefox can send Origin: null when inheriting the page's
      // no-referrer policy. Preserve the origin for our strict CSRF check;
      // this policy still omits referrers on cross-origin requests.
      referrerPolicy: "same-origin",
    });
  } catch {
    throw new ShoeboxApiError(
      init.signal?.aborted ? "ABORTED" : "NETWORK",
      null,
    );
  }
  if (response.status === 204) return undefined as T;

  let text: string;
  try {
    text = await response.text();
  } catch {
    throw new ShoeboxApiError(
      init.signal?.aborted ? "ABORTED" : "NETWORK",
      response.status,
    );
  }
  let body: unknown;
  let parsed = false;
  if (
    /^application\/json\b/i.test(response.headers.get("content-type") ?? "")
  ) {
    try {
      body = JSON.parse(text);
      parsed = true;
    } catch {
      parsed = false;
    }
  }

  const fromEnvelope = parsed ? envelopeError(response, body) : null;
  if (fromEnvelope) throw fromEnvelope;
  if (response.ok && parsed && response.status !== 202) return body as T;
  if (response.ok) {
    // A success status we cannot read: the write may well have happened.
    throw new ShoeboxApiError("BAD_RESPONSE", response.status);
  }
  const code = STATUS_CODES[response.status];
  if (code) {
    throw new ShoeboxApiError(code, response.status, {
      retryAfterSeconds: retryAfter(response, null),
    });
  }
  // Other non-JSON 5xx (platform or proxy pages): treat as uncertain.
  throw new ShoeboxApiError(
    response.status >= 500 ? "BAD_RESPONSE" : "INVALID_INPUT",
    response.status,
  );
}

// --- create and reconcile --------------------------------------------------

export type SaveDraft = {
  requestId: string;
  fields: MemoryFields;
  file?: File;
};

export type SaveOutcome =
  | { kind: "saved"; memory: MemorySummary; replayed: boolean }
  | { kind: "uncertain"; cause: ShoeboxApiError }
  | { kind: "ambiguous" }
  | { kind: "conflict"; memory: MemorySummary | null }
  | { kind: "failed"; error: ShoeboxApiError };

export type SaveOptions = {
  signal?: AbortSignal;
  /** Injectable delay for the status polls. */
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Explicit retry: confirm the status before resending the same ID. */
  checkFirst?: boolean;
  /** Called when the outcome is unknown and read-only polling begins. */
  onReconcile?: () => void;
};

/** Read-only status polls after an unknown outcome (Task 5 contract). */
export const STATUS_POLL_DELAYS_MS: readonly number[] = [1_000, 2_000, 4_000];

function defaultWait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function asApiError(error: unknown): ShoeboxApiError {
  return error instanceof ShoeboxApiError
    ? error
    : new ShoeboxApiError("BAD_RESPONSE", null);
}

function statusPath(requestId: string): string {
  return `/api/shoebox/requests/${requestId}`;
}

async function readStatus(
  requestId: string,
  signal?: AbortSignal,
): Promise<RequestStatus> {
  const status = await shoeboxFetch<RequestStatus>(statusPath(requestId), {
    method: "GET",
    signal,
  });
  if (
    status?.state === "found" ||
    status?.state === "not_found" ||
    status?.state === "ambiguous"
  ) {
    return status;
  }
  throw new ShoeboxApiError("BAD_RESPONSE", 200);
}

/** One read-only status check: found -> saved, not_found -> still unknown. */
export async function checkRequest(
  requestId: string,
  signal?: AbortSignal,
): Promise<SaveOutcome> {
  try {
    const status = await readStatus(requestId, signal);
    if (status.state === "found") {
      return { kind: "saved", memory: status.memory, replayed: true };
    }
    if (status.state === "ambiguous") return { kind: "ambiguous" };
    return {
      kind: "uncertain",
      cause: new ShoeboxApiError("OUTCOME_UNKNOWN", null),
    };
  } catch (error) {
    return { kind: "uncertain", cause: asApiError(error) };
  }
}

async function poll(
  requestId: string,
  cause: ShoeboxApiError,
  options: SaveOptions,
): Promise<SaveOutcome> {
  const wait = options.wait ?? defaultWait;
  let last = cause;
  for (const delay of STATUS_POLL_DELAYS_MS) {
    await wait(delay, options.signal);
    if (options.signal?.aborted) {
      return { kind: "uncertain", cause: new ShoeboxApiError("ABORTED", null) };
    }
    const outcome = await checkRequest(requestId, options.signal);
    if (outcome.kind !== "uncertain") return outcome;
    if (outcome.cause.code === "UNAUTHORIZED") return outcome;
    if (outcome.cause.code !== "OUTCOME_UNKNOWN") last = outcome.cause;
  }
  return { kind: "uncertain", cause: last };
}

function createBody(draft: SaveDraft): FormData {
  const form = new FormData();
  form.append(
    "metadata",
    JSON.stringify({ requestId: draft.requestId, ...draft.fields }),
  );
  if (draft.file) form.append("file", draft.file);
  return form;
}

/**
 * Sends one create for `draft`. Never mints a Request ID and never resends on
 * its own; only `checkFirst` (an explicit user retry) may resend, after a
 * fresh status check says the earlier attempt is not there.
 */
export async function saveMemory(
  draft: SaveDraft,
  options: SaveOptions = {},
): Promise<SaveOutcome> {
  if (options.checkFirst) {
    const before = await checkRequest(draft.requestId, options.signal);
    if (before.kind !== "uncertain") return before;
    if (before.cause.code !== "OUTCOME_UNKNOWN") {
      // Could not confirm the earlier attempt is absent: do not resend.
      return before;
    }
  }

  try {
    const result = await shoeboxFetch<{
      memory: MemorySummary;
      replayed: boolean;
    }>("/api/shoebox/memories", {
      method: "POST",
      body: createBody(draft),
      signal: options.signal,
    });
    if (!result?.memory) throw new ShoeboxApiError("BAD_RESPONSE", 200);
    return {
      kind: "saved",
      memory: result.memory,
      replayed: result.replayed === true,
    };
  } catch (error) {
    const apiError = asApiError(error);
    if (apiError.code === "ABORTED") {
      // Cancelled here; the server may still finish. Do not poll or resend.
      return { kind: "uncertain", cause: apiError };
    }
    if (isOutcomeUncertain(apiError)) {
      options.onReconcile?.();
      return poll(draft.requestId, apiError, options);
    }
    if (apiError.code === "REQUEST_CONFLICT") {
      const status = await checkRequest(draft.requestId, options.signal);
      if (status.kind === "ambiguous") return status;
      if (status.kind === "saved")
        return { kind: "conflict", memory: status.memory };
      if (
        status.kind === "uncertain" &&
        status.cause.code === "OUTCOME_UNKNOWN"
      )
        return { kind: "conflict", memory: null };
      return status;
    }
    return { kind: "failed", error: apiError };
  }
}
