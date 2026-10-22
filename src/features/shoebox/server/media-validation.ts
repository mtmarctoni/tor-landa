import "server-only";
import path from "node:path";
import { Worker, type WorkerOptions } from "node:worker_threads";
import {
  MAX_FILE_BYTES,
  MAX_IMAGE_EDGE,
  MEDIA_WORKER_DEADLINE_MS,
  MEDIA_WORKER_HEAP_MB,
  MEDIA_WORKER_MAX_CONCURRENCY,
} from "@/features/shoebox/limits";
import {
  type AudioContainer,
  declaredTypeMatches,
  MEDIA_RULES,
} from "@/features/shoebox/media-inspection.mjs";
import { ShoeboxError } from "./errors";

/** Server-only: validated bytes ready for storage. */
export type ValidatedMedia = {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
};

export type MediaKind = "photo" | "audio";
type StoredMediaInfo = Omit<ValidatedMedia, "bytes" | "filename">;
type Mode = "validate" | "inspect";

export type MediaValidatorOptions = {
  /** Absolute path of the worker module. Tests substitute a hostile worker. */
  workerPath?: string;
  deadlineMs?: number;
  maxConcurrent?: number;
  maxOldGenerationSizeMb?: number;
};

export type MediaValidator = {
  validateMedia(
    file: File,
    kind: MediaKind,
    signal?: AbortSignal,
  ): Promise<ValidatedMedia>;
  inspectStoredMedia(
    bytes: Uint8Array,
    kind: MediaKind,
    signal?: AbortSignal,
  ): Promise<StoredMediaInfo>;
  /** Worker threads started and not yet exited (for tests/diagnostics). */
  activeWorkers(): number;
};

// Fixed project-relative path. next.config.ts traces this file and its
// dependencies into the shoebox API routes (outputFileTracingIncludes).
const WORKER_PATH = path.join(
  process.cwd(),
  "src/features/shoebox/server/media-worker.mjs",
);

const PHOTO_FILENAME = "memory.jpg";
const PHOTO_TYPES = new Set(["", "image/jpeg", "image/jpg", "image/pjpeg"]);
const REJECTION_CODES = new Set([
  "UNSUPPORTED_MEDIA",
  "INVALID_INPUT",
  "TOO_LARGE",
]);

type WorkerSuccess = {
  ok: true;
  kind: MediaKind;
  container?: unknown;
  durationSeconds?: unknown;
  width?: unknown;
  height?: unknown;
  bytes?: unknown;
};
type WorkerRejection = { ok: false; code?: unknown; reason?: unknown };
type WorkerReply = WorkerSuccess | WorkerRejection;

const isKind = (kind: unknown): kind is MediaKind =>
  kind === "photo" || kind === "audio";

const unsupported = (detail: string) =>
  new ShoeboxError("UNSUPPORTED_MEDIA", { detail });
const unavailable = (detail: string) =>
  new ShoeboxError("UNAVAILABLE", { detail });

const isDimension = (value: unknown): value is number =>
  Number.isInteger(value) &&
  (value as number) > 0 &&
  (value as number) <= MAX_IMAGE_EDGE;

const isJpeg = (b: Uint8Array) =>
  b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

function isAudioContainer(value: unknown): value is AudioContainer {
  return (
    typeof value === "string" &&
    Object.hasOwn(MEDIA_RULES.audioContainers, value)
  );
}

export function createMediaValidator(
  options: MediaValidatorOptions = {},
): MediaValidator {
  const workerPath = options.workerPath ?? WORKER_PATH;
  const deadlineMs = options.deadlineMs ?? MEDIA_WORKER_DEADLINE_MS;
  const maxConcurrent = options.maxConcurrent ?? MEDIA_WORKER_MAX_CONCURRENCY;
  const heapMb = options.maxOldGenerationSizeMb ?? MEDIA_WORKER_HEAP_MB;
  let active = 0;

  /** Runs one worker for one buffer; the buffer is transferred, not copied. */
  function runWorker(
    kind: MediaKind,
    mode: Mode,
    bytes: Uint8Array,
    signal?: AbortSignal,
  ): Promise<WorkerReply> {
    if (signal?.aborted) return Promise.reject(unavailable("media_aborted"));
    if (active >= maxConcurrent) {
      return Promise.reject(unavailable("media_busy"));
    }
    active += 1;

    return new Promise<WorkerReply>((resolve, reject) => {
      let settled = false;
      let outcome: { reply?: WorkerReply; error?: ShoeboxError } | null = null;
      let worker: Worker;
      try {
        // Reflect.construct, not `new Worker(path)`: Turbopack treats a
        // `new Worker()` with a non-literal path as a bundling entry and
        // globs the whole project (tests, docs, configs) into the route,
        // failing the build. `/* turbopackIgnore: true */` and
        // `webpackIgnore` were tried and not honoured for worker_threads in
        // Next 16.3.0-preview.6. The worker file ships through
        // outputFileTracingIncludes in next.config.ts instead.
        const workerOptions: WorkerOptions = {
          // Nothing from this process's environment (secrets) reaches the worker.
          env: {},
          argv: [],
          resourceLimits: {
            maxOldGenerationSizeMb: heapMb,
            maxYoungGenerationSizeMb: 16,
            stackSizeMb: 4,
          },
        };
        worker = Reflect.construct(Worker, [
          workerPath,
          workerOptions,
        ]) as Worker;
      } catch {
        active -= 1;
        reject(unavailable("media_worker"));
        return;
      }

      // The slot is released and the promise settled only after the thread
      // has exited, so callers never overlap more than `maxConcurrent` threads.
      const finish = (next: { reply?: WorkerReply; error?: ShoeboxError }) => {
        if (outcome) return;
        outcome = next;
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        void worker.terminate();
      };
      const timer = setTimeout(
        () => finish({ error: unavailable("media_deadline") }),
        deadlineMs,
      );
      const onAbort = () => finish({ error: unavailable("media_aborted") });
      signal?.addEventListener("abort", onAbort, { once: true });

      worker.once("message", (reply: WorkerReply) => finish({ reply }));
      worker.once("error", (error: Error & { code?: string }) => {
        finish({
          error: unavailable(
            error.code === "ERR_WORKER_OUT_OF_MEMORY"
              ? "media_resources"
              : "media_worker",
          ),
        });
      });
      worker.once("exit", () => {
        active -= 1;
        if (settled) return;
        settled = true;
        const final = outcome ?? { error: unavailable("media_worker") };
        if (final.reply) resolve(final.reply);
        else reject(final.error ?? unavailable("media_worker"));
      });

      worker.postMessage({ kind, mode, bytes }, [bytes.buffer as ArrayBuffer]);
    });
  }

  async function check(
    kind: MediaKind,
    mode: Mode,
    bytes: Uint8Array,
    signal?: AbortSignal,
  ) {
    const reply = await runWorker(kind, mode, bytes, signal);
    if (!reply.ok) {
      const code =
        typeof reply.code === "string" && REJECTION_CODES.has(reply.code)
          ? (reply.code as "UNSUPPORTED_MEDIA" | "INVALID_INPUT" | "TOO_LARGE")
          : "UNSUPPORTED_MEDIA";
      const reason =
        typeof reply.reason === "string" && /^[a-z_]{1,32}$/.test(reply.reason)
          ? reply.reason
          : "worker";
      throw new ShoeboxError(code, { detail: `media_${reason}` });
    }
    if (reply.kind !== kind) throw unavailable("media_reply");
    return reply;
  }

  function audioResult(reply: WorkerSuccess) {
    const { container, durationSeconds } = reply;
    if (
      !isAudioContainer(container) ||
      typeof durationSeconds !== "number" ||
      !Number.isFinite(durationSeconds) ||
      durationSeconds <= 0 ||
      durationSeconds > MEDIA_RULES.maxAudioSeconds + 1e-6
    ) {
      throw unavailable("media_reply");
    }
    return { rule: MEDIA_RULES.audioContainers[container], durationSeconds };
  }

  function photoSize(reply: WorkerSuccess) {
    if (!isDimension(reply.width) || !isDimension(reply.height)) {
      throw unavailable("media_reply");
    }
    return { width: reply.width, height: reply.height };
  }

  /** Copies the caller's bytes into a buffer the worker may own. */
  function ownedCopy(bytes: Uint8Array): Uint8Array {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy;
  }

  return {
    async validateMedia(file, kind, signal) {
      if (!isKind(kind)) throw unsupported("media_kind");
      if (file.size === 0) throw unsupported("media_empty");
      if (file.size > MAX_FILE_BYTES) {
        throw new ShoeboxError("TOO_LARGE", { detail: "media_bytes" });
      }
      if (kind === "photo" && !PHOTO_TYPES.has(file.type.toLowerCase())) {
        throw unsupported("media_declared_type");
      }
      const original = new Uint8Array(await file.arrayBuffer());
      if (original.byteLength === 0 || original.byteLength > MAX_FILE_BYTES) {
        throw unsupported("media_bytes");
      }

      if (kind === "photo") {
        const reply = await check("photo", "validate", original, signal);
        const bytes = reply.bytes;
        if (
          !(bytes instanceof Uint8Array) ||
          bytes.byteLength > MAX_FILE_BYTES ||
          !isJpeg(bytes)
        ) {
          throw unavailable("media_reply");
        }
        return {
          bytes,
          mimeType: "image/jpeg",
          filename: PHOTO_FILENAME,
          ...photoSize(reply),
        };
      }

      // Audio is stored exactly as uploaded; the worker gets its own copy.
      const reply = await check(
        "audio",
        "validate",
        ownedCopy(original),
        signal,
      );
      const { rule, durationSeconds } = audioResult(reply);
      const container = reply.container as AudioContainer;
      if (!declaredTypeMatches(file.type, container)) {
        throw unsupported("media_declared_type");
      }
      return {
        bytes: original,
        mimeType: rule.mimeType,
        filename: `memory.${rule.extension}`,
        durationSeconds,
      };
    },

    async inspectStoredMedia(bytes, kind, signal) {
      if (!isKind(kind)) throw unsupported("media_kind");
      if (bytes.byteLength === 0) throw unsupported("media_empty");
      if (bytes.byteLength > MAX_FILE_BYTES) {
        throw new ShoeboxError("TOO_LARGE", { detail: "media_bytes" });
      }
      const reply = await check(kind, "inspect", ownedCopy(bytes), signal);
      if (kind === "photo") {
        return { mimeType: "image/jpeg", ...photoSize(reply) };
      }
      const { rule, durationSeconds } = audioResult(reply);
      return { mimeType: rule.mimeType, durationSeconds };
    },

    activeWorkers: () => active,
  };
}

const shared = createMediaValidator();

/** Validates and normalizes one upload (photo re-encoded, audio inspected). */
export const validateMedia = shared.validateMedia;
/** Re-inspects stored media on download; never re-encodes or returns bytes. */
export const inspectStoredMedia = shared.inspectStoredMedia;
