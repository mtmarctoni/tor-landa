import "server-only";
import { MAX_CURSOR_BYTES, MAX_MUTATION_JSON_BYTES } from "../limits";
import { readBodyLimited, readJsonLimited, readMultipart } from "./body";
import { getConfig, type ShoeboxConfig } from "./config";
import { ShoeboxError } from "./errors";
import {
  assertMutationOrigin,
  assertSameOriginRead,
  privateEmpty,
  privateJson,
  toErrorResponse,
} from "./http";
import { validateMedia } from "./media-validation";
import type { MemoryService } from "./memory-service";
import { requireRequestSession } from "./session";
import { getMemoryService } from "./shared-service";

/**
 * `service` is a factory so nothing (SDK client included) is constructed
 * before the request is authenticated.
 */
export type MemoryHandlerDeps = {
  service?: () => MemoryService;
  requireSession?: (request: Request) => Promise<unknown>;
  config?: () => ShoeboxConfig;
  now?: () => number;
  validateMedia?: typeof validateMedia;
};

type Handler = (request: Request) => Promise<Response>;

const REQUEST_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type DetailHandler = (request: Request, id: string) => Promise<Response>;

function parseListQuery(url: string): string | undefined {
  const params = new URL(url).searchParams;
  for (const key of params.keys()) {
    if (key !== "cursor") {
      throw new ShoeboxError("INVALID_INPUT", { status: 400 });
    }
  }
  const values = params.getAll("cursor");
  if (values.length === 0) return undefined;
  if (
    values.length > 1 ||
    values[0].length === 0 ||
    values[0].length > MAX_CURSOR_BYTES
  ) {
    throw new ShoeboxError("INVALID_INPUT", { status: 400 });
  }
  return values[0];
}

function guarded<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export function createMemoryHandlers(deps: MemoryHandlerDeps = {}): {
  list: Handler;
  get: DetailHandler;
  create: Handler;
  status: DetailHandler;
  correct: DetailHandler;
  remove: DetailHandler;
} {
  const config = deps.config ?? getConfig;
  const now = deps.now ?? (() => Math.floor(Date.now() / 1000));
  const requireSession =
    deps.requireSession ??
    ((request: Request) => requireRequestSession(request, now(), config()));

  // One process-wide instance (limiter and schema cache), built on first use
  // after authentication.
  const service = deps.service ?? (() => getMemoryService(config()));
  const validate = deps.validateMedia ?? validateMedia;

  return {
    list: guarded(async (request) => {
      assertSameOriginRead(request.headers);
      await requireSession(request);
      const cursor = parseListQuery(request.url);
      const page = await service().listMemories(
        cursor === undefined ? {} : { cursor },
      );
      return privateJson(page);
    }),

    get: guarded(async (request, id) => {
      assertSameOriginRead(request.headers);
      await requireSession(request);
      return privateJson({ memory: await service().getMemory(id) });
    }),

    /**
     * Origin, then session, then the bounded multipart read and media
     * validation; only then the service (Request ID check before any write).
     * 201 new, 200 replayed, 202 OUTCOME_UNKNOWN, 409 conflict.
     */
    create: guarded(async (request) => {
      assertMutationOrigin(request.headers, config().appOrigin);
      await requireSession(request);
      const { fields, requestId, file } = await readMultipart(request);
      // Busy/deadline/OOM here is a 503 before any write; never retried.
      const media =
        file && fields.kind !== "text"
          ? await validate(file, fields.kind, request.signal)
          : undefined;
      const result = await service().createMemory({
        ...fields,
        requestId,
        ...(media ? { media } : {}),
      });
      return privateJson(result, result.replayed ? 200 : 201);
    }),

    /**
     * Origin, session, bounded JSON (400 invalid/unknown, 413 over 16 KiB),
     * then the service: membership, kind-aware validation (422 semantic), one
     * property update. 202 OUTCOME_UNKNOWN when the write cannot be confirmed.
     */
    correct: guarded(async (request, id) => {
      assertMutationOrigin(request.headers, config().appOrigin);
      await requireSession(request);
      const body = await readJsonLimited(request, MAX_MUTATION_JSON_BYTES);
      return privateJson({ memory: await service().correctMemory(id, body) });
    }),

    /** Same guards; the body must be empty (any byte -> 413). 204 on success. */
    remove: guarded(async (request, id) => {
      assertMutationOrigin(request.headers, config().appOrigin);
      await requireSession(request);
      await readBodyLimited(request, 0);
      await service().removeMemory(id);
      return privateEmpty(204);
    }),

    /** Read-only reconciliation: never uploads, creates or retries a write. */
    status: guarded(async (request, requestId) => {
      assertSameOriginRead(request.headers);
      await requireSession(request);
      if (!REQUEST_ID.test(requestId)) {
        throw new ShoeboxError("INVALID_INPUT", {
          status: 400,
          detail: "request_id",
        });
      }
      return privateJson(await service().findRequest(requestId));
    }),
  };
}
