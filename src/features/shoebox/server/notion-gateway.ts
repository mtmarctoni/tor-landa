import "server-only";
import {
  Client,
  type CompleteFileUploadParameters,
  type CompleteFileUploadResponse,
  type CreateFileUploadParameters,
  type CreateFileUploadResponse,
  type CreatePageParameters,
  type CreatePageResponse,
  type GetDatabaseParameters,
  type GetDatabaseResponse,
  type GetDataSourceParameters,
  type GetDataSourceResponse,
  type GetPageParameters,
  type GetPageResponse,
  isHTTPResponseError,
  type QueryDataSourceParameters,
  type QueryDataSourceResponse,
  type SendFileUploadParameters,
  type SendFileUploadResponse,
  type UpdatePageParameters,
  type UpdatePageResponse,
} from "@notionhq/client";
import type { ApiErrorCode } from "@/types/shoebox";
import { ShoeboxError } from "./errors";

/** Explicit API version for this adapter; the legacy service is untouched. */
export const SHOEBOX_NOTION_VERSION = "2026-03-11";

const READ_DEADLINE_MS = 15_000;
const WRITE_DEADLINE_MS = 45_000;
const MAX_ATTEMPTS = 3;
const MAX_CONCURRENT = 2;
const MAX_HINT_SECONDS = 60;
const JITTER_BASE_MS = 250;
const JITTER_CAP_MS = 2_000;
const BLOCKED = /public_api_request_blocked|block_creation/;
const RESOURCE_ID =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/**
 * Notion documents `additional_data.committed_resource_id` on a 503 for page
 * creation whose change was saved but whose response timed out
 * (developers.notion.com/reference/request-limits). Only a UUID is kept.
 */
function committedResourceId(raw: { additional_data?: unknown }) {
  const data = raw.additional_data;
  if (typeof data !== "object" || data === null) return undefined;
  const value = (data as Record<string, unknown>).committed_resource_id;
  return typeof value === "string" && RESOURCE_ID.test(value)
    ? value
    : undefined;
}

/** The slice of the SDK client the gateway uses; the real Client satisfies it. */
export type NotionClientLike = {
  databases: {
    retrieve(args: GetDatabaseParameters): Promise<GetDatabaseResponse>;
  };
  dataSources: {
    retrieve(args: GetDataSourceParameters): Promise<GetDataSourceResponse>;
    query(args: QueryDataSourceParameters): Promise<QueryDataSourceResponse>;
  };
  pages: {
    retrieve(args: GetPageParameters): Promise<GetPageResponse>;
    update(args: UpdatePageParameters): Promise<UpdatePageResponse>;
    create(args: CreatePageParameters): Promise<CreatePageResponse>;
  };
  fileUploads: {
    create(args: CreateFileUploadParameters): Promise<CreateFileUploadResponse>;
    send(args: SendFileUploadParameters): Promise<SendFileUploadResponse>;
    complete(
      args: CompleteFileUploadParameters,
    ): Promise<CompleteFileUploadResponse>;
  };
};

export type GatewayOptions = { signal?: AbortSignal };

export type NotionGateway = {
  retrieveDatabase(
    args: GetDatabaseParameters,
    options?: GatewayOptions,
  ): Promise<GetDatabaseResponse>;
  retrieveDataSource(
    args: GetDataSourceParameters,
    options?: GatewayOptions,
  ): Promise<GetDataSourceResponse>;
  queryDataSource(
    args: QueryDataSourceParameters,
    options?: GatewayOptions,
  ): Promise<QueryDataSourceResponse>;
  retrievePage(
    args: GetPageParameters,
    options?: GatewayOptions,
  ): Promise<GetPageResponse>;
  updatePage(
    args: UpdatePageParameters,
    options?: GatewayOptions,
  ): Promise<UpdatePageResponse>;
  createPage(
    args: CreatePageParameters,
    options?: GatewayOptions,
  ): Promise<CreatePageResponse>;
  createFileUpload(
    args: CreateFileUploadParameters,
    options?: GatewayOptions,
  ): Promise<CreateFileUploadResponse>;
  sendFileUpload(
    args: SendFileUploadParameters,
    options?: GatewayOptions,
  ): Promise<SendFileUploadResponse>;
  completeFileUpload(
    args: CompleteFileUploadParameters,
    options?: GatewayOptions,
  ): Promise<CompleteFileUploadResponse>;
};

export type GatewayDeps = {
  client: NotionClientLike;
  /** Milliseconds; defaults to Date.now. */
  clock?: () => number;
  /** Retry wait; must resolve early when the signal aborts. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** 0..1, for retry jitter. */
  random?: () => number;
  /** Overridable operation budgets (tests use tiny ones). */
  deadlines?: { readMs: number; writeMs: number };
};

/**
 * SDK client for the shoebox: pinned API version, SDK retries disabled (the
 * gateway owns the single retry loop) and the existing server key.
 */
export function createSdkClient(
  apiKey: string,
  fetchImpl?: typeof fetch,
): NotionClientLike {
  return new Client({
    auth: apiKey,
    notionVersion: SHOEBOX_NOTION_VERSION,
    retry: { maxRetries: 0 },
    timeoutMs: WRITE_DEADLINE_MS,
    // SDK warnings include raw upstream messages/URLs. Only the app's
    // sanitized operation-code + diagnostic-ID logger may emit diagnostics.
    logger: () => {},
    ...(fetchImpl ? { fetch: fetchImpl as never } : {}),
  });
}

type Kind = "read" | "write";

const DEADLINE = Symbol("deadline");
const ABORTED = Symbol("aborted");

type Failure = {
  error: ShoeboxError;
  retryable: boolean;
  retryAfterMs?: number;
  /** What to throw if the next wait cannot fit in the remaining budget. */
  exhausted: (delayMs: number) => ShoeboxError;
};

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal?.addEventListener("abort", finish, { once: true });
  });
}

function readHeader(headers: unknown, name: string): string | undefined {
  if (typeof headers !== "object" || headers === null) return undefined;
  const maybe = headers as { get?: unknown };
  if (typeof maybe.get === "function") {
    const value = (maybe.get as (key: string) => unknown).call(headers, name);
    return typeof value === "string" ? value : undefined;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name && typeof value === "string") return value;
  }
  return undefined;
}

function parseRetryAfterMs(headers: unknown): number | undefined {
  const raw = readHeader(headers, "retry-after")?.trim();
  if (!raw) return undefined;
  if (/^\d+$/.test(raw)) return Number(raw) * 1_000;
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

function hint(delayMs: number): number {
  return Math.min(MAX_HINT_SECONDS, Math.max(1, Math.ceil(delayMs / 1_000)));
}

function fail(
  code: ApiErrorCode,
  detail: string,
  retryAfterSeconds?: number,
): ShoeboxError {
  return new ShoeboxError(code, { detail, retryAfterSeconds });
}

/** Maps anything the SDK can throw to a sanitized, classified failure. */
function classify(raw: unknown, kind: Kind, op: string): Failure {
  const write = kind === "write";
  if (raw === DEADLINE || raw === ABORTED) {
    const tag = raw === DEADLINE ? "deadline" : "aborted";
    const error = write
      ? fail("OUTCOME_UNKNOWN", `${op}:${tag}`)
      : fail("UNAVAILABLE", `${op}:${tag}`);
    return { error, retryable: false, exhausted: () => error };
  }
  if (!isHTTPResponseError(raw)) {
    // Network or timeout failure: reads may retry, writes are ambiguous.
    const error = write
      ? fail("OUTCOME_UNKNOWN", `${op}:transport`)
      : fail("UNAVAILABLE", `${op}:transport`);
    return {
      error,
      retryable: !write,
      exhausted: (delay) =>
        write ? error : fail("UNAVAILABLE", `${op}:transport`, hint(delay)),
    };
  }
  const { status } = raw;
  const blocked = BLOCKED.test(`${raw.code} ${raw.body ?? ""}`);
  const tag = `${op}:${status}`;
  if (blocked || status === 401 || status === 403) {
    const error = fail("SETUP_REQUIRED", tag);
    return { error, retryable: false, exhausted: () => error };
  }
  if (status === 404) {
    const error = fail("NOT_FOUND", tag);
    return { error, retryable: false, exhausted: () => error };
  }
  const retryAfterMs = parseRetryAfterMs(raw.headers);
  if (status === 429) {
    const error = new ShoeboxError("RATE_LIMITED", {
      detail: tag,
      retryAfterSeconds:
        retryAfterMs === undefined ? undefined : hint(retryAfterMs),
    });
    return {
      error,
      retryable: true,
      retryAfterMs,
      exhausted: (delay) =>
        new ShoeboxError("RATE_LIMITED", {
          detail: tag,
          retryAfterSeconds: hint(delay),
        }),
    };
  }
  if (status === 529) {
    return {
      error: fail(
        "UNAVAILABLE",
        tag,
        retryAfterMs === undefined ? undefined : hint(retryAfterMs),
      ),
      retryable: true,
      retryAfterMs,
      exhausted: (delay) => fail("UNAVAILABLE", tag, hint(delay)),
    };
  }
  if (status >= 500) {
    if (write) {
      const error = new ShoeboxError("OUTCOME_UNKNOWN", {
        detail: tag,
        resourceId: committedResourceId(raw),
      });
      return { error, retryable: false, exhausted: () => error };
    }
    const transient = [500, 502, 503, 504].includes(status);
    return {
      error: fail("UNAVAILABLE", tag),
      retryable: transient,
      retryAfterMs,
      exhausted: (delay) => fail("UNAVAILABLE", tag, hint(delay)),
    };
  }
  const error = fail("UNAVAILABLE", tag);
  return { error, retryable: false, exhausted: () => error };
}

function withBounds<T>(
  run: () => Promise<T>,
  ms: number,
  signal: AbortSignal | undefined,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(ABORTED);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(DEADLINE);
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
    Promise.resolve()
      .then(run)
      .then(
        (value) => {
          cleanup();
          resolve(value);
        },
        (error) => {
          cleanup();
          reject(error);
        },
      );
  });
}

export function createNotionGateway(deps: GatewayDeps): NotionGateway {
  const { client } = deps;
  const clock = deps.clock ?? Date.now;
  const sleep = deps.sleep ?? defaultSleep;
  const random = deps.random ?? Math.random;
  const readMs = deps.deadlines?.readMs ?? READ_DEADLINE_MS;
  const writeMs = deps.deadlines?.writeMs ?? WRITE_DEADLINE_MS;

  // Per-instance courtesy limit, not a global rate-limit guarantee.
  let active = 0;
  const waiting: (() => void)[] = [];
  async function acquire(): Promise<() => void> {
    if (active >= MAX_CONCURRENT) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    } else {
      active += 1;
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = waiting.shift();
      if (next) next();
      else active -= 1;
    };
  }

  async function run<T>(
    kind: Kind,
    op: string,
    call: () => Promise<T>,
    options: GatewayOptions = {},
  ): Promise<T> {
    const { signal } = options;
    const budget = kind === "read" ? readMs : writeMs;
    const started = clock();
    const remaining = () => budget - (clock() - started);
    if (signal?.aborted) throw fail("UNAVAILABLE", `${op}:aborted`);

    const release = await acquire();
    try {
      for (let attempt = 1; ; attempt += 1) {
        if (signal?.aborted) throw fail("UNAVAILABLE", `${op}:aborted`);
        if (remaining() <= 0) {
          throw classify(DEADLINE, kind, op).error;
        }
        try {
          return await withBounds(call, remaining(), signal);
        } catch (raw) {
          const failure = classify(raw, kind, op);
          if (!failure.retryable || attempt >= MAX_ATTEMPTS) {
            throw failure.error;
          }
          const delay =
            failure.retryAfterMs ??
            Math.min(JITTER_BASE_MS * 2 ** (attempt - 1), JITTER_CAP_MS) *
              (0.5 + random());
          if (delay > remaining()) throw failure.exhausted(delay);
          await sleep(delay, signal);
        }
      }
    } finally {
      release();
    }
  }

  return {
    retrieveDatabase: (args, o) =>
      run(
        "read",
        "retrieve_database",
        () => client.databases.retrieve(args),
        o,
      ),
    retrieveDataSource: (args, o) =>
      run(
        "read",
        "retrieve_data_source",
        () => client.dataSources.retrieve(args),
        o,
      ),
    // POST, but a pure read: safe to repeat, unlike create-page.
    queryDataSource: (args, o) =>
      run("read", "query_data_source", () => client.dataSources.query(args), o),
    retrievePage: (args, o) =>
      run("read", "retrieve_page", () => client.pages.retrieve(args), o),
    updatePage: (args, o) =>
      run("write", "update_page", () => client.pages.update(args), o),
    createPage: (args, o) =>
      run("write", "create_page", () => client.pages.create(args), o),
    createFileUpload: (args, o) =>
      run(
        "write",
        "create_file_upload",
        () => client.fileUploads.create(args),
        o,
      ),
    sendFileUpload: (args, o) =>
      run("write", "send_file_upload", () => client.fileUploads.send(args), o),
    completeFileUpload: (args, o) =>
      run(
        "write",
        "complete_file_upload",
        () => client.fileUploads.complete(args),
        o,
      ),
  };
}
