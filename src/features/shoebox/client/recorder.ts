import { AudioPreviewError } from "@/features/shoebox/client/audio-preview";
import { MAX_AUDIO_SECONDS, MAX_FILE_BYTES } from "@/features/shoebox/limits";

/**
 * Voice-recording controller. It owns the microphone and the local clip only:
 * no network, no saving. Every async step carries a generation guard so a
 * late permission, a late recorder event or a late inspection can never
 * resurrect a discarded or disposed take, and every path releases the
 * microphone tracks, timers, listeners and object URLs it created.
 *
 * Timers here are requests to the browser, not guarantees: scheduling and
 * encoders can overshoot, so the final Blob is always measured (bytes and
 * packet-derived duration) and anything over the hard limits is rejected,
 * never truncated.
 */

/** Stop is requested here; 60 s stays the absolute validation cap. */
export const RECORDER_STOP_AT_MS = 59_500;
/** Conservative byte threshold below the 4,000,000-byte file cap. */
export const RECORDER_BYTE_PRECAP = 3_500_000;
export const RECORDER_TIMESLICE_MS = 250;
export const RECORDER_BITS_PER_SECOND = 64_000;
/** How long to wait for the recorder's final `stop` event before giving up. */
const STOP_GRACE_MS = 4_000;
const TICK_MS = 250;

/** In preference order: MP4/AAC, WebM/Opus, then Ogg/Opus. */
export const RECORDER_MIME_CANDIDATES = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
] as const;
const ALLOWED_ACTUAL = new Set(["audio/mp4", "audio/webm", "audio/ogg"]);

export type RecorderErrorReason =
  | "insecure"
  | "unsupported"
  | "unsupported_format"
  | "denied"
  | "not_found"
  | "not_readable"
  | "failed"
  | "empty"
  | "too_large"
  | "too_long"
  | "invalid";

const ALTERNATIVE = "Puedes subir un audio o escribir un texto.";
const MESSAGES: Record<RecorderErrorReason, string> = {
  insecure: `Para grabar hace falta una conexión segura (https). ${ALTERNATIVE}`,
  unsupported: `Este navegador no puede grabar audio aquí. ${ALTERNATIVE}`,
  unsupported_format: `Este navegador no graba en un formato que la caja acepte. ${ALTERNATIVE}`,
  denied: `No tenemos permiso para usar el micrófono. Puedes darlo en los ajustes del navegador. ${ALTERNATIVE}`,
  not_found: `No encontramos ningún micrófono. ${ALTERNATIVE}`,
  not_readable: `El micrófono está ocupado o no responde. Cierra otras apps que lo usen y prueba otra vez. ${ALTERNATIVE}`,
  failed: `La grabación falló. Prueba otra vez. ${ALTERNATIVE}`,
  empty: "La grabación está vacía. Prueba a grabar otra vez.",
  too_large:
    "La grabación pesa más de 4 MB, así que no cabe. Prueba con una algo más corta.",
  too_long:
    "La grabación pasó de 60 segundos (el navegador a veces añade un poquito al final). Prueba con una algo más corta.",
  invalid: `No pudimos comprobar esta grabación. Prueba otra vez. ${ALTERNATIVE}`,
};

export type RecorderError = { reason: RecorderErrorReason; message: string };
export type RecorderStopReason = "user" | "limit" | "interrupted";

export type RecorderSnapshot =
  | { state: "idle" }
  | { state: "requesting" }
  | { state: "recording"; elapsedMs: number }
  | { state: "stopping"; elapsedMs: number }
  | {
      state: "preview";
      elapsedMs: number;
      blob: Blob;
      url: string;
      actualMime: string;
      durationSeconds: number;
      interrupted: boolean;
      stopReason: RecorderStopReason;
    }
  | { state: "error"; error: RecorderError };

export interface RecorderTrack {
  stop(): void;
  addEventListener(type: "ended" | "mute", listener: () => void): void;
  removeEventListener(type: "ended" | "mute", listener: () => void): void;
}
export interface RecorderStream {
  getTracks(): RecorderTrack[];
}
type RecorderEventListener = (event: { data?: Blob }) => void;
export interface RecorderLike {
  readonly mimeType: string;
  readonly state: string;
  start(timeslice?: number): void;
  stop(): void;
  addEventListener(type: string, listener: RecorderEventListener): void;
  removeEventListener(type: string, listener: RecorderEventListener): void;
}

export type RecorderDependencies = {
  isSecureContext: () => boolean;
  getUserMedia?: (
    constraints: MediaStreamConstraints,
  ) => Promise<RecorderStream>;
  createRecorder?: (
    stream: RecorderStream,
    options: { mimeType?: string; audioBitsPerSecond?: number },
  ) => RecorderLike;
  isTypeSupported: (mime: string) => boolean;
  canPlayType: (mime: string) => string;
  /** Monotonic milliseconds (performance.now in browsers). */
  now: () => number;
  setTimer: (fn: () => void, ms: number) => number;
  clearTimer: (id: number) => void;
  /** Local packet inspection (Task 4); returns a finite duration. */
  inspect: (
    blob: Blob,
    signal: AbortSignal,
  ) => Promise<{ durationSeconds: number; mimeType: string }>;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  /** Tab hidden / pagehide; returns an unsubscribe function. */
  subscribeInterruptions: (listener: () => void) => () => void;
};

export interface VoiceRecorderController {
  start(): Promise<void>;
  stop(): Promise<void>;
  discard(): void;
  dispose(): void;
  getSnapshot(): RecorderSnapshot;
  subscribe(listener: () => void): () => void;
}

type Take = {
  generation: number;
  stream: RecorderStream;
  recorder: RecorderLike;
  mime: string;
  chunks: Blob[];
  bytes: number;
  startedAt: number;
  elapsedMs: number;
  stopping: boolean;
  finalized: boolean;
  stopReason: RecorderStopReason;
  timers: number[];
  cleanups: (() => void)[];
  detachRecorder: () => void;
  tracksStopped: boolean;
};

const IDLE: RecorderSnapshot = { state: "idle" };

function permissionReason(error: unknown): RecorderErrorReason {
  const name = (error as { name?: unknown })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "not_found";
  if (name === "NotReadableError" || name === "AbortError")
    return "not_readable";
  return "failed";
}

function stopTracks(stream: RecorderStream): void {
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // Already stopped.
    }
  }
}

export function createVoiceRecorder(
  deps: RecorderDependencies,
): VoiceRecorderController {
  let snapshot: RecorderSnapshot = IDLE;
  const listeners = new Set<() => void>();
  let generation = 0;
  let disposed = false;
  let take: Take | null = null;
  let previewUrl: string | null = null;
  let inspection: AbortController | null = null;
  let waiters: (() => void)[] = [];

  function publish(next: RecorderSnapshot): void {
    snapshot = next;
    for (const listener of [...listeners]) listener();
  }

  function settleWaiters(): void {
    const pending = waiters;
    waiters = [];
    for (const resolve of pending) resolve();
  }

  function fail(reason: RecorderErrorReason): void {
    publish({ state: "error", error: { reason, message: MESSAGES[reason] } });
  }

  function candidates(): string[] {
    return RECORDER_MIME_CANDIDATES.filter((mime) => {
      try {
        return deps.isTypeSupported(mime) && deps.canPlayType(mime) !== "";
      } catch {
        return false;
      }
    });
  }

  /** Releases capture resources; idempotent. Keeps the collected chunks. */
  function releaseCapture(current: Take): void {
    for (const id of current.timers) deps.clearTimer(id);
    current.timers = [];
    for (const cleanup of current.cleanups) cleanup();
    current.cleanups = [];
    if (!current.tracksStopped) {
      current.tracksStopped = true;
      stopTracks(current.stream);
    }
  }

  function elapsed(current: Take): number {
    return Math.max(0, deps.now() - current.startedAt);
  }

  function requestStop(current: Take, reason: RecorderStopReason): void {
    if (current.stopping || take !== current) return;
    current.stopping = true;
    current.stopReason = reason;
    current.elapsedMs = elapsed(current);
    releaseCapture(current);
    publish({ state: "stopping", elapsedMs: current.elapsedMs });
    let stopped = false;
    try {
      if (current.recorder.state !== "inactive") {
        current.recorder.stop();
        stopped = true;
      }
    } catch {
      stopped = false;
    }
    if (!stopped) {
      void finalize(current);
      return;
    }
    // The final dataavailable + stop events should follow; do not hang.
    current.timers.push(
      deps.setTimer(() => void finalize(current), STOP_GRACE_MS),
    );
  }

  function attachRecorder(current: Take): () => void {
    const { recorder } = current;
    const onData: RecorderEventListener = (event) => {
      if (take !== current || current.finalized) return;
      const data = event.data;
      if (!data || data.size === 0) return;
      current.chunks.push(data);
      current.bytes += data.size;
      if (current.bytes >= RECORDER_BYTE_PRECAP) requestStop(current, "limit");
    };
    const onStop: RecorderEventListener = () => {
      if (take !== current) return;
      void finalize(current);
    };
    const onError: RecorderEventListener = () => {
      if (take !== current) return;
      if (current.stopping) {
        void finalize(current);
      } else {
        requestStop(current, "interrupted");
      }
    };
    recorder.addEventListener("dataavailable", onData);
    recorder.addEventListener("stop", onStop);
    recorder.addEventListener("error", onError);
    return () => {
      recorder.removeEventListener("dataavailable", onData);
      recorder.removeEventListener("stop", onStop);
      recorder.removeEventListener("error", onError);
    };
  }

  async function finalize(current: Take): Promise<void> {
    if (current.finalized || take !== current) return;
    current.finalized = true;
    if (!current.stopping) {
      // The recorder stopped on its own (for example the track ended).
      current.stopping = true;
      current.stopReason = "interrupted";
      current.elapsedMs = elapsed(current);
    }
    releaseCapture(current);
    current.detachRecorder();
    take = null;

    const chunks = current.chunks;
    current.chunks = [];
    const declared = current.recorder.mimeType || current.mime;
    const blob = new Blob(chunks, { type: declared });
    const actualMime = blob.type || declared;
    const base = actualMime.split(";")[0]?.trim().toLowerCase() ?? "";
    const gen = current.generation;

    const done = (
      next: RecorderErrorReason | null,
      result?: RecorderSnapshot,
    ) => {
      if (gen !== generation) return;
      if (next) fail(next);
      else if (result) publish(result);
      settleWaiters();
    };

    if (!ALLOWED_ACTUAL.has(base)) return done("unsupported_format");
    if (blob.size === 0) return done("empty");
    if (blob.size > MAX_FILE_BYTES) return done("too_large");

    const abort = new AbortController();
    inspection = abort;
    let durationSeconds: number;
    try {
      ({ durationSeconds } = await deps.inspect(blob, abort.signal));
    } catch (error) {
      if (gen !== generation || abort.signal.aborted) return;
      inspection = null;
      if (error instanceof AudioPreviewError) {
        if (error.reason === "too_long") return done("too_long");
        if (error.reason === "too_large") return done("too_large");
        if (error.reason === "empty") return done("empty");
      }
      return done("invalid");
    }
    if (gen !== generation || abort.signal.aborted) return;
    inspection = null;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return done("invalid");
    }
    if (durationSeconds > MAX_AUDIO_SECONDS) return done("too_long");

    const url = deps.createObjectURL(blob);
    previewUrl = url;
    done(null, {
      state: "preview",
      elapsedMs: current.elapsedMs,
      blob,
      url,
      actualMime,
      durationSeconds,
      interrupted: current.stopReason === "interrupted",
      stopReason: current.stopReason,
    });
  }

  function tick(current: Take): void {
    if (take !== current || current.stopping) return;
    const ms = elapsed(current);
    if (ms >= RECORDER_STOP_AT_MS) {
      requestStop(current, "limit");
      return;
    }
    publish({ state: "recording", elapsedMs: ms });
    current.timers.push(
      deps.setTimer(
        () => tick(current),
        Math.min(TICK_MS, RECORDER_STOP_AT_MS - ms),
      ),
    );
  }

  async function start(): Promise<void> {
    if (disposed) return;
    if (snapshot.state !== "idle" && snapshot.state !== "error") return;
    const gen = ++generation;
    if (!deps.isSecureContext()) return fail("insecure");
    const { getUserMedia, createRecorder } = deps;
    if (!getUserMedia || !createRecorder) return fail("unsupported");
    const mimes = candidates();
    if (mimes.length === 0) return fail("unsupported_format");

    publish({ state: "requesting" });
    let stream: RecorderStream;
    try {
      // Audio only; channel count and echo cancellation are hints.
      stream = await getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          echoCancellation: { ideal: true },
        },
      });
    } catch (error) {
      if (gen === generation && !disposed) fail(permissionReason(error));
      return;
    }
    if (gen !== generation || disposed) {
      // Late permission after cancel/discard/unmount: release it at once.
      stopTracks(stream);
      return;
    }

    let current: Take | null = null;
    for (const mime of mimes) {
      let recorder: RecorderLike;
      try {
        recorder = createRecorder(stream, {
          mimeType: mime,
          audioBitsPerSecond: RECORDER_BITS_PER_SECOND,
        });
      } catch {
        continue;
      }
      const candidate: Take = {
        generation: gen,
        stream,
        recorder,
        mime,
        chunks: [],
        bytes: 0,
        startedAt: deps.now(),
        elapsedMs: 0,
        stopping: false,
        finalized: false,
        stopReason: "user",
        timers: [],
        cleanups: [],
        detachRecorder: () => {},
        tracksStopped: false,
      };
      take = candidate;
      candidate.detachRecorder = attachRecorder(candidate);
      try {
        recorder.start(RECORDER_TIMESLICE_MS);
        current = candidate;
        break;
      } catch {
        candidate.detachRecorder();
        take = null;
      }
    }
    if (!current) {
      take = null;
      stopTracks(stream);
      return fail("failed");
    }

    const active = current;
    active.startedAt = deps.now();
    const interrupt = () => requestStop(active, "interrupted");
    for (const track of stream.getTracks()) {
      track.addEventListener("ended", interrupt);
      track.addEventListener("mute", interrupt);
      active.cleanups.push(() => {
        track.removeEventListener("ended", interrupt);
        track.removeEventListener("mute", interrupt);
      });
    }
    active.cleanups.push(deps.subscribeInterruptions(interrupt));
    active.timers.push(
      deps.setTimer(() => requestStop(active, "limit"), RECORDER_STOP_AT_MS),
    );
    publish({ state: "recording", elapsedMs: 0 });
    active.timers.push(deps.setTimer(() => tick(active), TICK_MS));
  }

  function waitForSettle(): Promise<void> {
    return new Promise((resolve) => waiters.push(resolve));
  }

  async function stop(): Promise<void> {
    if (snapshot.state === "requesting") {
      // Cancel the pending permission; a late grant is released in start().
      generation += 1;
      publish(IDLE);
      return;
    }
    if (snapshot.state === "recording" && take) {
      const settled = waitForSettle();
      requestStop(take, "user");
      return settled;
    }
    if (snapshot.state === "stopping") return waitForSettle();
  }

  function discard(): void {
    generation += 1;
    inspection?.abort();
    inspection = null;
    const current = take;
    take = null;
    if (current) {
      releaseCapture(current);
      try {
        if (current.recorder.state !== "inactive") current.recorder.stop();
      } catch {
        // Already stopped.
      }
      current.detachRecorder();
      current.chunks = [];
    }
    if (previewUrl) {
      deps.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
    if (snapshot.state !== "idle") publish(IDLE);
    settleWaiters();
  }

  return {
    start,
    stop,
    discard,
    dispose() {
      discard();
      disposed = true;
      listeners.clear();
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Real browser wiring. Nothing here runs until the controller asks for it, so
 * creating the controller never touches the microphone.
 */
export function browserRecorderDependencies(): RecorderDependencies {
  const mediaDevices =
    typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
  const Recorder =
    typeof MediaRecorder === "undefined" ? undefined : MediaRecorder;
  return {
    isSecureContext: () => window.isSecureContext,
    getUserMedia:
      typeof mediaDevices?.getUserMedia === "function"
        ? (constraints) => mediaDevices.getUserMedia(constraints)
        : undefined,
    createRecorder: Recorder
      ? (stream, options) => new Recorder(stream as MediaStream, options)
      : undefined,
    isTypeSupported: (mime) =>
      typeof Recorder?.isTypeSupported === "function" &&
      Recorder.isTypeSupported(mime),
    canPlayType: (mime) => document.createElement("audio").canPlayType(mime),
    now: () => performance.now(),
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: (id) => window.clearTimeout(id),
    inspect: (blob, signal) =>
      import("@/features/shoebox/client/audio-preview").then((module) =>
        module.inspectAudioPreview(blob, signal),
      ),
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    subscribeInterruptions: (listener) => {
      const onVisibility = () => {
        if (document.visibilityState === "hidden") listener();
      };
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("pagehide", listener);
      return () => {
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("pagehide", listener);
      };
    },
  };
}
