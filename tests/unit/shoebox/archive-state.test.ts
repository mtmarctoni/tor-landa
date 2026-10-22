import { describe, expect, it, vi } from "vitest";
import { ShoeboxApiError } from "@/features/shoebox/client/api";
import {
  type ArchiveDeps,
  createMemoryArchive,
  MAX_PREVIOUS_CURSORS,
  readMemoryPage,
  readMemoryResult,
} from "@/features/shoebox/client/archive-state";
import type { MemoryPage, MemorySummary } from "@/types/shoebox";

/**
 * Single-batch archive controller: strict response reading, a bounded cursor
 * trail, latest-request-wins generations and in-place corrections/removals.
 * Synthetic records only; the fetch is a fake.
 */

const id = (n: number) =>
  `0f0f0f0f-0000-4000-8000-${String(n).padStart(12, "0")}`;

function text(
  n: number,
  date = "2026-10-01",
): Extract<MemorySummary, { kind: "text" }> {
  return {
    id: id(n),
    kind: "text",
    text: `nota sintética ${n}`,
    caption: "",
    memoryDate: date,
    createdAt: `${date}T10:00:${String(n % 60).padStart(2, "0")}.000Z`,
  };
}

/** Pages of 12 over `total` synthetic records, newest first. */
function pages(total: number): Map<string | null, MemoryPage> {
  const all = Array.from({ length: total }, (_, i) =>
    text(
      total - i,
      `2026-${String(1 + ((total - i) % 12)).padStart(2, "0")}-10`,
    ),
  );
  const result = new Map<string | null, MemoryPage>();
  for (let start = 0, index = 0; start < total; start += 12, index += 1) {
    const cursor = index === 0 ? null : `c${index}`;
    const nextCursor = start + 12 < total ? `c${index + 1}` : null;
    result.set(cursor, { items: all.slice(start, start + 12), nextCursor });
  }
  return result;
}

type Pending = {
  path: string;
  resolve(value: unknown): void;
  reject(error: unknown): void;
  signal?: AbortSignal;
};

function deferredDeps() {
  const pending: Pending[] = [];
  const onUnauthorized = vi.fn();
  const deps: ArchiveDeps = {
    fetchJson: (path, signal) =>
      new Promise((resolve, reject) => {
        pending.push({ path, resolve, reject, signal });
      }),
    onUnauthorized,
  };
  return { deps, pending, onUnauthorized };
}

function autoDeps(book: Map<string | null, MemoryPage>) {
  const calls: string[] = [];
  const onUnauthorized = vi.fn();
  const deps: ArchiveDeps = {
    fetchJson: async (path) => {
      calls.push(path);
      const cursor = new URL(path, "http://x").searchParams.get("cursor");
      const page = book.get(cursor);
      if (!page) throw new ShoeboxApiError("INVALID_INPUT", 400);
      return structuredClone(page);
    },
    onUnauthorized,
  };
  return { deps, calls, onUnauthorized };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

it.each(["correct", "remove"])(
  "confirmed %s outranks a deferred old refresh",
  async (mutation) => {
    const { deps, pending } = deferredDeps();
    const archive = createMemoryArchive(deps);
    const original = text(1);
    archive.start();
    pending[0].resolve({ items: [original], nextCursor: null });
    await flush();
    archive.refresh();
    if (mutation === "correct")
      archive.onCorrected({ ...original, text: "confirmed" });
    else archive.onRemoved(original.id);
    pending[1].resolve({ items: [original], nextCursor: null });
    await flush();
    expect(archive.getSnapshot().state).toBe("ready");
    expect(archive.getSnapshot().page?.items).toEqual(
      mutation === "correct" ? [{ ...original, text: "confirmed" }] : [],
    );
  },
);

it("a confirmed removal during the first load keeps that load alive", async () => {
  const { deps, pending } = deferredDeps();
  const archive = createMemoryArchive(deps);
  archive.start();
  archive.onRemoved(id(9));
  expect(pending[0]?.signal?.aborted).toBe(false);
  pending[0]?.resolve({ items: [text(1)], nextCursor: null });
  await flush();
  const snapshot = archive.getSnapshot();
  expect(snapshot.state).toBe("ready");
  expect(snapshot.page?.items).toHaveLength(1);
});

it("reloads a date-corrected singleton at a cursor boundary", async () => {
  const { deps, pending } = deferredDeps();
  const archive = createMemoryArchive(deps);
  archive.start();
  pending[0]?.resolve({ items: [text(1)], nextCursor: "c1" });
  await flush();
  archive.older();
  pending[1]?.resolve({ items: [text(2, "2026-09-01")], nextCursor: null });
  await flush();
  archive.onCorrected({ ...text(2), memoryDate: "2026-12-24" });
  expect(pending).toHaveLength(3);
  expect(pending[2]?.path).toBe("/api/shoebox/memories?cursor=c1");
});

describe("readMemoryPage", () => {
  it("keeps only known fields and refuses foreign media paths", () => {
    const leaky = {
      items: [{ ...text(1), url: "https://files.example/secret", raw: {} }],
      nextCursor: null,
    };
    const page = readMemoryPage(leaky);
    expect(Object.keys(page.items[0] ?? {}).sort()).toEqual(
      ["caption", "createdAt", "id", "kind", "memoryDate", "text"].sort(),
    );
    expect(JSON.stringify(page)).not.toContain("files.example");

    const photo = {
      id: id(2),
      kind: "photo",
      caption: "",
      memoryDate: "2026-10-02",
      createdAt: "2026-10-02T10:00:00.000Z",
      mediaPath: "https://elsewhere.example/a.jpg",
      width: 10,
      height: 10,
    };
    expect(() => readMemoryPage({ items: [photo], nextCursor: null })).toThrow(
      ShoeboxApiError,
    );
    expect(
      readMemoryPage({
        items: [
          { ...photo, mediaPath: `/api/shoebox/memories/${id(2)}/media` },
        ],
        nextCursor: null,
      }).items,
    ).toHaveLength(1);
  });

  it("rejects more than 12 items, bad cursors, bad dates and bad kinds", () => {
    const thirteen = Array.from({ length: 13 }, (_, i) => text(i + 1));
    expect(() => readMemoryPage({ items: thirteen, nextCursor: null })).toThrow(
      ShoeboxApiError,
    );
    expect(() =>
      readMemoryPage({ items: [], nextCursor: "not a cursor!" }),
    ).toThrow(ShoeboxApiError);
    expect(() =>
      readMemoryPage({
        items: [{ ...text(1), memoryDate: "2026-02-30" }],
        nextCursor: null,
      }),
    ).toThrow(ShoeboxApiError);
    expect(() =>
      readMemoryPage({
        items: [{ ...text(1), kind: "video" }],
        nextCursor: null,
      }),
    ).toThrow(ShoeboxApiError);
    expect(() => readMemoryPage(null)).toThrow(ShoeboxApiError);
  });

  it("deduplicates repeated IDs, keeping the first", () => {
    const page = readMemoryPage({
      items: [text(1), text(2), { ...text(1), text: "duplicado" }],
      nextCursor: "c1",
    });
    expect(page.items.map((item) => item.id)).toEqual([id(1), id(2)]);
    expect(page.items[0]).toMatchObject({ text: "nota sintética 1" });
  });

  it("reads a single {memory} result strictly", () => {
    expect(readMemoryResult({ memory: text(3) }).id).toBe(id(3));
    expect(() => readMemoryResult({ memory: { id: "x" } })).toThrow(
      ShoeboxApiError,
    );
  });
});

describe("createMemoryArchive", () => {
  it("loads the newest batch only when asked, then pages by replacing it", async () => {
    const book = pages(30);
    const { deps, calls } = autoDeps(book);
    const archive = createMemoryArchive(deps);
    expect(archive.getSnapshot().state).toBe("idle");
    expect(calls).toHaveLength(0);

    archive.refresh();
    expect(archive.getSnapshot().state).toBe("loading");
    await flush();
    let snap = archive.getSnapshot();
    expect(snap.state).toBe("ready");
    expect(snap.page?.items).toHaveLength(12);
    expect(snap.atNewest).toBe(true);
    expect(snap.hasPrevious).toBe(false);

    archive.older();
    await flush();
    snap = archive.getSnapshot();
    expect(snap.page?.items).toHaveLength(12);
    expect(snap.page?.items[0]?.id).toBe(book.get("c1")?.items[0]?.id);
    expect(snap.hasPrevious).toBe(true);
    expect(snap.atNewest).toBe(false);
    expect(calls.at(-1)).toBe("/api/shoebox/memories?cursor=c1");

    archive.older();
    await flush();
    expect(archive.getSnapshot().page?.items).toHaveLength(6);
    expect(archive.getSnapshot().page?.nextCursor).toBeNull();

    archive.previous();
    await flush();
    expect(archive.getSnapshot().page?.items[0]?.id).toBe(
      book.get("c1")?.items[0]?.id,
    );
    archive.previous();
    await flush();
    expect(archive.getSnapshot().atNewest).toBe(true);
    expect(calls.at(-1)).toBe("/api/shoebox/memories");
    // Older with no next cursor and previous at the newest are no-ops.
    const before = calls.length;
    archive.previous();
    await flush();
    expect(calls).toHaveLength(before);
  });

  it("start() loads once: a second start while loading or loaded is a no-op", async () => {
    const { deps, calls } = autoDeps(pages(5));
    const archive = createMemoryArchive(deps);
    archive.start();
    archive.start();
    await flush();
    archive.start();
    expect(calls).toEqual(["/api/shoebox/memories"]);
    expect(archive.getSnapshot().state).toBe("ready");
  });

  it("bounds the trail to 100 previous cursors, dropping the oldest", async () => {
    const book = pages(12 * 110);
    const { deps } = autoDeps(book);
    const archive = createMemoryArchive(deps);
    archive.refresh();
    await flush();
    for (let i = 0; i < 105; i += 1) {
      archive.older();
      await flush();
    }
    let snap = archive.getSnapshot();
    expect(MAX_PREVIOUS_CURSORS).toBe(100);
    expect(snap.previousCount).toBe(100);
    expect(snap.truncated).toBe(true);
    for (let i = 0; i < 100; i += 1) {
      archive.previous();
      await flush();
    }
    snap = archive.getSnapshot();
    // The newest batch fell off the trail: no previous, but not at newest.
    expect(snap.hasPrevious).toBe(false);
    expect(snap.atNewest).toBe(false);
    archive.refresh();
    await flush();
    expect(archive.getSnapshot().atNewest).toBe(true);
    expect(archive.getSnapshot().truncated).toBe(false);
  });

  it("a failed older load keeps the current batch and its trail", async () => {
    const { deps, pending } = deferredDeps();
    const archive = createMemoryArchive(deps);
    archive.refresh();
    pending[0]?.resolve(pages(30).get(null));
    await flush();
    const first = archive.getSnapshot().page;
    archive.older();
    pending[1]?.reject(new ShoeboxApiError("UNAVAILABLE", 503));
    await flush();
    const snap = archive.getSnapshot();
    expect(snap.state).toBe("ready");
    expect(snap.page).toBe(first);
    expect(snap.atNewest).toBe(true);
    expect(snap.error).toMatch(/anteriores|ocupada/i);
    expect(snap.errorDuring).toBe("navigate");
  });

  it("a failed first load is a retryable error with no page", async () => {
    const { deps, pending } = deferredDeps();
    const archive = createMemoryArchive(deps);
    archive.refresh();
    pending[0]?.reject(new ShoeboxApiError("NETWORK", null));
    await flush();
    expect(archive.getSnapshot()).toMatchObject({
      state: "error",
      page: null,
      errorDuring: "load",
    });
    archive.refresh();
    pending[1]?.resolve({ items: [], nextCursor: null });
    await flush();
    expect(archive.getSnapshot()).toMatchObject({
      state: "ready",
      error: null,
    });
  });

  it("latest request wins: earlier responses are aborted and ignored", async () => {
    const { deps, pending } = deferredDeps();
    const archive = createMemoryArchive(deps);
    archive.refresh();
    pending[0]?.resolve(pages(30).get(null));
    await flush();
    archive.older(); // [1]
    archive.refresh(); // [2]
    archive.older(); // [3] still from the newest page's cursor
    expect(pending[1]?.signal?.aborted).toBe(true);
    expect(pending[2]?.signal?.aborted).toBe(true);
    pending[3]?.resolve(pages(30).get("c1"));
    await flush();
    pending[1]?.resolve({ items: [text(999)], nextCursor: null });
    pending[2]?.resolve({ items: [text(998)], nextCursor: null });
    await flush();
    const snap = archive.getSnapshot();
    expect(snap.page?.items[0]?.id).toBe(pages(30).get("c1")?.items[0]?.id);
    expect(snap.hasPrevious).toBe(true);
  });

  it("clear() drops the batch and any late response cannot resurrect it", async () => {
    const { deps, pending } = deferredDeps();
    const archive = createMemoryArchive(deps);
    archive.refresh();
    archive.clear();
    pending[0]?.resolve(pages(12).get(null));
    await flush();
    expect(archive.getSnapshot()).toMatchObject({ state: "idle", page: null });
    expect(pending[0]?.signal?.aborted).toBe(true);
  });

  it("late corrections, removals and saves after clear() reveal nothing", async () => {
    const { deps, calls } = autoDeps(pages(12));
    const archive = createMemoryArchive(deps);
    archive.refresh();
    await flush();
    archive.clear();
    const before = calls.length;
    archive.onCorrected({ ...text(1), memoryDate: "2027-01-01" });
    archive.onRemoved(id(2));
    await flush();
    expect(archive.getSnapshot()).toMatchObject({ state: "idle", page: null });
    expect(calls).toHaveLength(before);
  });

  it("401 reports to the session instead of showing an error", async () => {
    const { deps, pending, onUnauthorized } = deferredDeps();
    const archive = createMemoryArchive(deps);
    archive.refresh();
    pending[0]?.reject(new ShoeboxApiError("UNAUTHORIZED", 401));
    await flush();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(archive.getSnapshot().page).toBeNull();
  });

  it("a removal of the last item keeps controls and does not auto-load", async () => {
    const book = pages(13);
    const { deps, calls } = autoDeps(book);
    const archive = createMemoryArchive(deps);
    archive.refresh();
    await flush();
    archive.older();
    await flush();
    const only = archive.getSnapshot().page?.items[0];
    expect(only).toBeDefined();
    const before = calls.length;
    archive.onRemoved(only?.id ?? "");
    await flush();
    const snap = archive.getSnapshot();
    expect(snap.page?.items).toEqual([]);
    expect(snap.hasPrevious).toBe(true);
    expect(snap.state).toBe("ready");
    expect(calls).toHaveLength(before);
  });

  it("a correction in date order replaces in place; out of order reloads the batch", async () => {
    const book = new Map<string | null, MemoryPage>([
      [
        null,
        {
          items: [
            text(3, "2026-10-03"),
            text(2, "2026-10-02"),
            text(1, "2026-10-01"),
          ],
          nextCursor: null,
        },
      ],
    ]);
    const { deps, calls } = autoDeps(book);
    const archive = createMemoryArchive(deps);
    archive.refresh();
    await flush();
    const before = calls.length;
    archive.onCorrected({ ...text(2, "2026-10-02"), text: "corregida" });
    expect(archive.getSnapshot().page?.items[1]).toMatchObject({
      text: "corregida",
    });
    expect(calls).toHaveLength(before);

    archive.onCorrected({ ...text(1, "2026-12-01") });
    await flush();
    expect(calls).toHaveLength(before + 1);
  });

  it("a saved memory returns to newest and is flagged when not in that batch", async () => {
    const book = pages(30);
    const { deps } = autoDeps(book);
    const archive = createMemoryArchive(deps);
    archive.refresh();
    await flush();
    archive.older();
    await flush();
    const backdated = text(500, "2001-01-01");
    archive.onSaved(backdated);
    await flush();
    let snap = archive.getSnapshot();
    expect(snap.atNewest).toBe(true);
    expect(snap.saved?.id).toBe(backdated.id);
    expect(snap.savedInBatch).toBe(false);

    const newest = book.get(null)?.items[0] as MemorySummary;
    archive.onSaved(newest);
    await flush();
    snap = archive.getSnapshot();
    expect(snap.savedInBatch).toBe(true);
  });

  it("getOne reads a single memory; 404 is null", async () => {
    const onUnauthorized = vi.fn();
    const archive = createMemoryArchive({
      fetchJson: async (path) => {
        if (path.endsWith(id(1))) return { memory: text(1) };
        throw new ShoeboxApiError("NOT_FOUND", 404);
      },
      onUnauthorized,
    });
    expect((await archive.getOne(id(1)))?.id).toBe(id(1));
    expect(await archive.getOne(id(2))).toBeNull();
    expect(await archive.getOne("not-a-uuid")).toBeNull();
  });
});
