import { ShoeboxApiError } from "@/features/shoebox/client/api";
import {
  MAX_AUDIO_SECONDS,
  MAX_CAPTION_CHARACTERS,
  MAX_CURSOR_BYTES,
  MAX_IMAGE_EDGE,
  MAX_TEXT_CHARACTERS,
  MEMORY_BATCH_SIZE,
} from "@/features/shoebox/limits";
import { codePointLength, readMemoryDate } from "@/features/shoebox/validation";
import type { MemoryPage, MemorySummary } from "@/types/shoebox";

/**
 * The browser's single-batch archive. Framework-free so its rules are unit
 * tested; `useMemoryArchive` is the thin React adapter.
 *
 * - Responses are read strictly: unknown fields are dropped, anything that
 *   does not match the contract (including a foreign media path) is refused.
 * - One batch of at most 12 is held. Older/Previous replace it; a bounded
 *   trail of previous cursors (100, oldest dropped) lives only in memory.
 * - Every load has a generation; a newer load aborts and outranks it, and
 *   `clear()` outranks everything, so a late answer cannot resurrect content.
 */

export const MAX_PREVIOUS_CURSORS = 100;

const UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const CURSOR = /^[A-Za-z0-9_-]+$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const AUDIO_MIME = /^audio\/[a-z0-9.+-]{1,40}(?:;[ -~]{0,80})?$/i;

const bad = () => new ShoeboxApiError("BAD_RESPONSE", 200);

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw bad();
  }
  return value as Record<string, unknown>;
}

function boundedText(value: unknown, min: number, max: number): string {
  if (typeof value !== "string") throw bad();
  const length = codePointLength(value);
  if (length < min || length > max) throw bad();
  return value;
}

function dimension(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_IMAGE_EDGE
  ) {
    throw bad();
  }
  return value;
}

export function isMemoryId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function mediaPathFor(id: string): string {
  return `/api/shoebox/memories/${id}/media`;
}

/** One summary, rebuilt from known fields only. */
export function readMemorySummary(value: unknown): MemorySummary {
  const raw = record(value);
  if (!isMemoryId(raw.id)) throw bad();
  const id = raw.id;
  let memoryDate: string;
  try {
    memoryDate = readMemoryDate(raw.memoryDate);
  } catch {
    throw bad();
  }
  if (typeof raw.createdAt !== "string" || !ISO_INSTANT.test(raw.createdAt)) {
    throw bad();
  }
  const base = {
    id,
    caption: boundedText(raw.caption, 0, MAX_CAPTION_CHARACTERS),
    memoryDate,
    createdAt: raw.createdAt,
  };
  switch (raw.kind) {
    case "text":
      return {
        ...base,
        kind: "text",
        text: boundedText(raw.text, 1, MAX_TEXT_CHARACTERS),
      };
    case "photo":
      if (raw.mediaPath !== mediaPathFor(id)) throw bad();
      return {
        ...base,
        kind: "photo",
        mediaPath: mediaPathFor(id),
        width: dimension(raw.width),
        height: dimension(raw.height),
      };
    case "audio": {
      if (raw.mediaPath !== mediaPathFor(id)) throw bad();
      const duration = raw.durationSeconds;
      if (
        typeof duration !== "number" ||
        !Number.isFinite(duration) ||
        duration <= 0 ||
        duration > MAX_AUDIO_SECONDS
      ) {
        throw bad();
      }
      if (typeof raw.mimeType !== "string" || !AUDIO_MIME.test(raw.mimeType)) {
        throw bad();
      }
      return {
        ...base,
        kind: "audio",
        mediaPath: mediaPathFor(id),
        durationSeconds: duration,
        mimeType: raw.mimeType,
      };
    }
    default:
      throw bad();
  }
}

/** A list response: at most 12 items, IDs deduplicated (first wins). */
export function readMemoryPage(value: unknown): MemoryPage {
  const raw = record(value);
  if (!Array.isArray(raw.items) || raw.items.length > MEMORY_BATCH_SIZE) {
    throw bad();
  }
  const nextCursor = raw.nextCursor;
  if (
    nextCursor !== null &&
    (typeof nextCursor !== "string" ||
      nextCursor.length > MAX_CURSOR_BYTES ||
      !CURSOR.test(nextCursor))
  ) {
    throw bad();
  }
  const seen = new Set<string>();
  const items: MemorySummary[] = [];
  for (const item of raw.items) {
    const memory = readMemorySummary(item);
    if (seen.has(memory.id)) continue;
    seen.add(memory.id);
    items.push(memory);
  }
  return { items, nextCursor };
}

/** A `{ memory }` response from detail, correction or create. */
export function readMemoryResult(value: unknown): MemorySummary {
  return readMemorySummary(record(value).memory);
}

/** Batch order: memory date, then creation time, both newest first. */
export function compareMemories(a: MemorySummary, b: MemorySummary): number {
  return (
    b.memoryDate.localeCompare(a.memoryDate) ||
    b.createdAt.localeCompare(a.createdAt)
  );
}

function inOrder(items: MemorySummary[]): boolean {
  for (let i = 1; i < items.length; i += 1) {
    const before = items[i - 1];
    const after = items[i];
    if (before && after && compareMemories(before, after) > 0) return false;
  }
  return true;
}

// --- controller --------------------------------------------------------------

export type ArchiveDeps = {
  /** GET a fixed same-origin path; rejects with ShoeboxApiError. */
  fetchJson(path: string, signal?: AbortSignal): Promise<unknown>;
  /** A 401 anywhere means the session ended; the host decides what follows. */
  onUnauthorized(): void;
};

export type ArchiveSnapshot = {
  state: "idle" | "loading" | "ready" | "error";
  page: MemoryPage | null;
  error: string | null;
  /** Whether the failure happened on the first load or while paging. */
  errorDuring: "load" | "navigate" | null;
  atNewest: boolean;
  hasPrevious: boolean;
  previousCount: number;
  /** Older cursors fell off the trail; "Volver al principio" still works. */
  truncated: boolean;
  /** Increments whenever the user moved to another batch and it arrived. */
  navigation: number;
  /** The last saved memory, and whether the current batch shows it. */
  saved: MemorySummary | null;
  savedInBatch: boolean;
};

export type MemoryArchive = {
  getSnapshot(): ArchiveSnapshot;
  subscribe(listener: () => void): () => void;
  /** Loads the newest batch only if nothing is loaded or loading yet. */
  start(): void;
  older(): void;
  previous(): void;
  refresh(): void;
  getOne(id: string): Promise<MemorySummary | null>;
  onSaved(memory: MemorySummary): void;
  onCorrected(memory: MemorySummary): void;
  onRemoved(id: string): void;
  clear(): void;
};

type Trail = { previous: (string | null)[]; current: string | null };

const IDLE: ArchiveSnapshot = {
  state: "idle",
  page: null,
  error: null,
  errorDuring: null,
  atNewest: true,
  hasPrevious: false,
  previousCount: 0,
  truncated: false,
  navigation: 0,
  saved: null,
  savedInBatch: false,
};

const LOAD_FAILED = "No pudimos abrir la caja.";
const OLDER_FAILED =
  "No pudimos traer esos recuerdos. Siguen aquí los anteriores.";

function listPath(cursor: string | null): string {
  return cursor === null
    ? "/api/shoebox/memories"
    : `/api/shoebox/memories?cursor=${cursor}`;
}

function failureText(error: unknown, base: string): string {
  if (error instanceof ShoeboxApiError) {
    if (error.code === "RATE_LIMITED" || error.code === "UNAVAILABLE") {
      return `${base} La caja está ocupada; prueba en un momento.`;
    }
    if (error.code === "NETWORK" || error.code === "TIMEOUT") {
      return `${base} Revisa la conexión.`;
    }
  }
  return base;
}

export function createMemoryArchive(deps: ArchiveDeps): MemoryArchive {
  let snapshot = IDLE;
  let trail: Trail = { previous: [], current: null };
  let truncated = false;
  let generation = 0;
  /** Bumped only by clear(): nothing started before it may land after. */
  let epoch = 0;
  let abort: AbortController | null = null;
  const listeners = new Set<() => void>();

  function emit(next: Partial<ArchiveSnapshot>) {
    const page = next.page === undefined ? snapshot.page : next.page;
    const saved = next.saved === undefined ? snapshot.saved : next.saved;
    snapshot = {
      ...snapshot,
      ...next,
      atNewest: trail.current === null,
      hasPrevious: trail.previous.length > 0,
      previousCount: trail.previous.length,
      truncated,
      savedInBatch:
        saved !== null &&
        (page?.items.some((item) => item.id === saved.id) ?? false),
    };
    for (const listener of listeners) listener();
  }

  /** Loads `target`; on success the trail becomes `nextTrail`. */
  function load(
    target: string | null,
    nextTrail: Trail,
    options: { navigated: boolean; dropped?: boolean },
  ) {
    abort?.abort();
    const controller = new AbortController();
    abort = controller;
    generation += 1;
    const mine = generation;
    emit({ state: "loading", error: null, errorDuring: null });
    deps.fetchJson(listPath(target), controller.signal).then(
      (value) => {
        if (mine !== generation) return;
        let page: MemoryPage;
        try {
          page = readMemoryPage(value);
        } catch (error) {
          fail(error);
          return;
        }
        abort = null;
        trail = nextTrail;
        if (options.dropped !== undefined) truncated = options.dropped;
        emit({
          state: "ready",
          page,
          error: null,
          errorDuring: null,
          navigation: options.navigated
            ? snapshot.navigation + 1
            : snapshot.navigation,
        });
      },
      (error: unknown) => {
        if (mine !== generation) return;
        fail(error);
      },
    );

    function fail(error: unknown) {
      abort = null;
      if (error instanceof ShoeboxApiError && error.code === "UNAUTHORIZED") {
        emit({ state: snapshot.page ? "ready" : "idle" });
        deps.onUnauthorized();
        return;
      }
      if (snapshot.page) {
        // Paging failed: keep the batch, the trail and focus where they are.
        emit({
          state: "ready",
          error: failureText(error, OLDER_FAILED),
          errorDuring: "navigate",
        });
      } else {
        emit({
          state: "error",
          error: failureText(error, LOAD_FAILED),
          errorDuring: "load",
        });
      }
    }
  }

  function reloadCurrent() {
    load(trail.current, trail, { navigated: false });
  }

  // A confirmed mutation supersedes reads started before its confirmation.
  // Keep the current batch/trail usable rather than stranding it in loading.
  function supersedeRead() {
    abort?.abort();
    abort = null;
    generation += 1;
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (snapshot.state !== "idle") return;
      load(
        null,
        { previous: [], current: null },
        { navigated: false, dropped: false },
      );
    },
    older() {
      const next = snapshot.page?.nextCursor;
      if (!next) return;
      const previous = [...trail.previous, trail.current];
      const dropped = previous.length > MAX_PREVIOUS_CURSORS;
      if (dropped) previous.splice(0, previous.length - MAX_PREVIOUS_CURSORS);
      load(
        next,
        { previous, current: next },
        { navigated: true, dropped: dropped || truncated },
      );
    },
    previous() {
      if (trail.previous.length === 0) return;
      const previous = trail.previous.slice(0, -1);
      const target = trail.previous.at(-1) ?? null;
      load(target, { previous, current: target }, { navigated: true });
    },
    refresh() {
      load(
        null,
        { previous: [], current: null },
        { navigated: snapshot.page !== null, dropped: false },
      );
    },
    async getOne(id) {
      if (!isMemoryId(id)) return null;
      const started = epoch;
      try {
        const value = await deps.fetchJson(`/api/shoebox/memories/${id}`);
        if (started !== epoch) return null;
        return readMemoryResult(value);
      } catch (error) {
        if (started !== epoch) return null;
        if (error instanceof ShoeboxApiError) {
          if (error.code === "NOT_FOUND") return null;
          if (error.code === "UNAUTHORIZED") deps.onUnauthorized();
        }
        throw error;
      }
    },
    onSaved(memory) {
      emit({ saved: memory });
      load(
        null,
        { previous: [], current: null },
        { navigated: false, dropped: false },
      );
    },
    onCorrected(memory) {
      const page = snapshot.page;
      if (!page) return;
      const index = page.items.findIndex((item) => item.id === memory.id);
      if (index < 0) return;
      supersedeRead();
      const items = [...page.items];
      items[index] = memory;
      const saved = snapshot.saved?.id === memory.id ? memory : snapshot.saved;
      emit({
        state: "ready",
        error: null,
        errorDuring: null,
        page: { ...page, items },
        saved,
      });
      // A date can cross an unseen batch boundary even if this batch still
      // looks sorted (notably a singleton). Re-read its cursor in that case.
      if (
        page.items[index]?.memoryDate !== memory.memoryDate ||
        !inOrder(items)
      ) {
        reloadCurrent();
      }
    },
    onRemoved(id) {
      const page = snapshot.page;
      const saved = snapshot.saved?.id === id ? null : snapshot.saved;
      if (!page) {
        // No batch to amend: leave a pending first load alone.
        emit({ saved });
        return;
      }
      supersedeRead();
      emit({
        state: "ready",
        error: null,
        errorDuring: null,
        page: { ...page, items: page.items.filter((item) => item.id !== id) },
        saved,
      });
    },
    clear() {
      abort?.abort();
      abort = null;
      generation += 1;
      epoch += 1;
      trail = { previous: [], current: null };
      truncated = false;
      emit({ ...IDLE, navigation: snapshot.navigation });
    },
  };
}
