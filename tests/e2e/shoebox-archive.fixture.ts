import { readFileSync } from "node:fs";
import { expect, type Page, type Route } from "@playwright/test";
import { loginThroughUi } from "./shoebox.fixture";

// A synthetic, in-memory stand-in for the Memories API, routed per page. Login
// and the session stay real. Every record below is synthetic test data.

export type SyntheticMemory = {
  id: string;
  kind: "text" | "photo" | "audio";
  text?: string;
  caption: string;
  memoryDate: string;
  createdAt: string;
  mediaPath?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  mimeType?: string;
};

export const memoryId = (n: number) =>
  `0f0f0f0f-0000-4000-8000-${String(n).padStart(12, "0")}`;

const pad = (value: number) => String(value).padStart(2, "0");

/** A date that decreases with n, so record n is newer than record n + 1. */
function dateFor(n: number): string {
  const day = new Date(Date.UTC(2026, 9, 20) - n * 86_400_000);
  return `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;
}

export function syntheticMemory(
  n: number,
  kind: SyntheticMemory["kind"] = "text",
  extra: Partial<SyntheticMemory> = {},
): SyntheticMemory {
  const id = memoryId(n);
  const base = {
    id,
    caption: extra.caption ?? `pie sintético ${n}`,
    memoryDate: extra.memoryDate ?? dateFor(n),
    createdAt: extra.createdAt ?? `2026-10-21T10:${pad(n % 60)}:00.000Z`,
  };
  if (kind === "photo") {
    return {
      ...base,
      kind,
      mediaPath: `/api/shoebox/memories/${id}/media`,
      width: 1200,
      height: 800,
      ...extra,
    };
  }
  if (kind === "audio") {
    return {
      ...base,
      kind,
      mediaPath: `/api/shoebox/memories/${id}/media`,
      durationSeconds: 2,
      mimeType: "audio/webm",
      ...extra,
    };
  }
  return { ...base, kind, text: `nota sintética número ${n}`, ...extra };
}

/** Mixed kinds: every third is a photo, every fifth an audio, else text. */
export function syntheticSet(count: number, start = 1): SyntheticMemory[] {
  return Array.from({ length: count }, (_, i) => {
    const n = start + i;
    return syntheticMemory(
      n,
      n % 3 === 0 ? "photo" : n % 5 === 0 ? "audio" : "text",
    );
  });
}

const AUDIO = readFileSync("tests/fixtures/shoebox/audio-webm-opus-2s.webm");

/** Abstract synthetic painting; no real photograph. */
const PHOTO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800"><defs><linearGradient id="s" x2="0" y2="1"><stop offset="0" stop-color="#89d9dc"/><stop offset=".6" stop-color="#ffc9ad"/><stop offset="1" stop-color="#efa080"/></linearGradient></defs><rect width="1200" height="800" fill="url(#s)"/><circle cx="880" cy="230" r="120" fill="#ffe582"/><path d="M0 560Q300 430 600 560T1200 520V800H0Z" fill="#4a8f88"/><path d="M0 660Q320 560 640 660T1200 640V800H0Z" fill="#e7bf6b"/></svg>`;

type Reply = { status: number; json?: unknown } | "hold" | "abort";

export type ArchiveApi = {
  records: SyntheticMemory[];
  listCalls: string[];
  detailCalls: string[];
  patches: { id: string; body: unknown }[];
  deletes: string[];
  mediaCalls: string[];
  held: Route[];
  /** Override the next list replies (consumed in order). */
  listReplies: Reply[];
  detailReply?: (id: string) => Reply | undefined;
  patchReply?: (id: string, body: unknown) => Reply | undefined;
  deleteReply?: (id: string) => Reply | undefined;
  mediaReply?: (id: string, attempt: number) => Reply | undefined;
};

const PAGE_SIZE = 12;

function sorted(records: SyntheticMemory[]): SyntheticMemory[] {
  return [...records].sort(
    (a, b) =>
      b.memoryDate.localeCompare(a.memoryDate) ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

export function listPage(records: SyntheticMemory[], cursor: string | null) {
  const offset = cursor ? Number(cursor.slice(1)) : 0;
  const all = sorted(records);
  const items = all.slice(offset, offset + PAGE_SIZE);
  return {
    items,
    nextCursor:
      offset + PAGE_SIZE < all.length ? `o${offset + PAGE_SIZE}` : null,
  };
}

async function fulfill(route: Route, reply: Exclude<Reply, "hold" | "abort">) {
  await route.fulfill({
    status: reply.status,
    contentType: "application/json",
    headers: { "cache-control": "private, no-store, max-age=0" },
    body: reply.status === 204 ? "" : JSON.stringify(reply.json ?? {}),
  });
}

export const apiError = (status: number, code: string) => ({
  status,
  json: { error: { code, message: "x", diagnosticId: "d-1" } },
});

/** Routes list, detail, PATCH, DELETE and media for this page. */
export async function mockArchive(
  page: Page,
  records: SyntheticMemory[],
  { shared = false }: { shared?: boolean } = {},
): Promise<ArchiveApi> {
  const api: ArchiveApi = {
    // `shared`: two clients read and write the very same synthetic store.
    records: shared ? records : [...records],
    listCalls: [],
    detailCalls: [],
    patches: [],
    deletes: [],
    mediaCalls: [],
    held: [],
    listReplies: [],
  };
  const mediaAttempts = new Map<string, number>();

  await page.route(/\/api\/shoebox\/memories(\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() !== "GET") return route.fallback();
    const url = new URL(request.url());
    api.listCalls.push(url.search);
    const reply = api.listReplies.shift();
    if (reply === "hold") {
      api.held.push(route);
      return;
    }
    if (reply === "abort") return route.abort();
    if (reply) return fulfill(route, reply);
    return fulfill(route, {
      status: 200,
      json: listPage(api.records, url.searchParams.get("cursor")),
    });
  });

  await page.route(
    /\/api\/shoebox\/memories\/[0-9a-f-]{36}$/,
    async (route) => {
      const request = route.request();
      const id = new URL(request.url()).pathname.split("/").pop() ?? "";
      const method = request.method();
      const index = api.records.findIndex((record) => record.id === id);
      if (method === "GET") {
        api.detailCalls.push(id);
        const custom = api.detailReply?.(id);
        if (custom === "hold") return void api.held.push(route);
        if (custom && custom !== "abort") return fulfill(route, custom);
        if (index < 0) return fulfill(route, apiError(404, "NOT_FOUND"));
        return fulfill(route, {
          status: 200,
          json: { memory: api.records[index] },
        });
      }
      if (method === "PATCH") {
        const body = request.postDataJSON();
        api.patches.push({ id, body });
        const custom = api.patchReply?.(id, body);
        if (custom === "hold") return void api.held.push(route);
        if (custom && custom !== "abort") return fulfill(route, custom);
        if (index < 0) return fulfill(route, apiError(404, "NOT_FOUND"));
        const updated = { ...api.records[index], ...body } as SyntheticMemory;
        api.records[index] = updated;
        return fulfill(route, { status: 200, json: { memory: updated } });
      }
      if (method === "DELETE") {
        api.deletes.push(id);
        const custom = api.deleteReply?.(id);
        if (custom === "hold") return void api.held.push(route);
        if (custom && custom !== "abort") return fulfill(route, custom);
        if (index >= 0) api.records.splice(index, 1);
        return fulfill(route, { status: 204 });
      }
      return route.fallback();
    },
  );

  await page.route(
    /\/api\/shoebox\/memories\/[0-9a-f-]{36}\/media$/,
    async (route) => {
      const id = new URL(route.request().url()).pathname.split("/")[4] ?? "";
      api.mediaCalls.push(id);
      const attempt = (mediaAttempts.get(id) ?? 0) + 1;
      mediaAttempts.set(id, attempt);
      const custom = api.mediaReply?.(id, attempt);
      if (custom === "abort") return route.abort();
      if (custom === "hold") return void api.held.push(route);
      if (custom) return fulfill(route, custom);
      const record = api.records.find((item) => item.id === id);
      if (!record) return fulfill(route, apiError(404, "NOT_FOUND"));
      if (record.kind === "audio") {
        return route.fulfill({
          status: 200,
          contentType: "audio/webm",
          headers: { "accept-ranges": "bytes" },
          body: AUDIO,
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: PHOTO_SVG,
      });
    },
  );
  return api;
}

export const batchHeading = (page: Page) =>
  page.getByRole("heading", { name: "Los recuerdos de esta caja" });

export const scraps = (page: Page) => page.locator("[data-memory-id]");

/** Real login, then the archive with the routed synthetic records. */
export async function openArchive(
  page: Page,
  records: SyntheticMemory[],
  options: { shared?: boolean } = {},
): Promise<ArchiveApi> {
  const api = await mockArchive(page, records, options);
  await loginThroughUi(page);
  await expect(page).toHaveURL("/shoebox");
  return api;
}

export async function visibleIds(page: Page): Promise<string[]> {
  return scraps(page).evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-memory-id") ?? ""),
  );
}
