import "server-only";
import {
  type CreatePageParameters,
  isFullDatabase,
  isFullDataSource,
  type PageObjectResponse,
  type UpdatePageParameters,
} from "@notionhq/client";
import type {
  MemoryCorrection,
  MemoryFields,
  MemoryPage,
  MemorySummary,
  RequestStatus,
} from "@/types/shoebox";
import {
  MAX_AUDIO_SECONDS,
  MAX_CAPTION_CHARACTERS,
  MAX_CURSOR_BYTES,
  MAX_IMAGE_EDGE,
  MAX_TEXT_CHARACTERS,
  MEMORY_BATCH_SIZE,
} from "../limits";
import {
  codePointLength,
  readMemoryDate,
  validateCorrection,
} from "../validation";
import { getConfig } from "./config";
import { ShoeboxError } from "./errors";
import type { ValidatedMedia } from "./media-validation";
import type { NotionGateway } from "./notion-gateway";
import { splitRichText } from "./rich-text";

export type CreateInput = MemoryFields & {
  requestId: string;
  media?: ValidatedMedia;
};

export type TrustedMedia = {
  kind: "photo" | "audio";
  url: URL;
  expectedMimeType: string;
};

export type MemoryService = {
  listMemories(input: { cursor?: string }): Promise<MemoryPage>;
  getMemory(id: string): Promise<MemorySummary>;
  resolveMemoryMedia(id: string): Promise<TrustedMedia>;
  createMemory(
    input: CreateInput,
  ): Promise<{ memory: MemorySummary; replayed: boolean }>;
  findRequest(requestId: string): Promise<RequestStatus>;
  correctMemory(id: string, patch: unknown): Promise<MemorySummary>;
  removeMemory(id: string): Promise<void>;
};

/** Required property names and types (design spec section 5). */
const REQUIRED_PROPERTIES: Record<string, string> = {
  Name: "title",
  Kind: "select",
  "Memory date": "date",
  Caption: "rich_text",
  Text: "rich_text",
  Media: "files",
  "Request ID": "rich_text",
  Width: "number",
  Height: "number",
  Duration: "number",
};

const SORTS = [
  { property: "Memory date", direction: "descending" },
  { timestamp: "created_time", direction: "descending" },
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR_SHAPE = /^[A-Za-z0-9_-]+$/;
const MAX_UPSTREAM_CURSOR = 512;

const AUDIO_TYPES: Record<string, string> = {
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  mp3: "audio/mpeg",
  webm: "audio/webm",
  weba: "audio/webm",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  wav: "audio/wav",
};

const normalizeId = (id: string): string => id.replace(/-/g, "").toLowerCase();

/** Exact-match reconciliation reads at most this many candidates. */
const REQUEST_QUERY_CAP = 3;
/** Notion expires an unattached upload one hour after creating it. */
const UPLOAD_LIFETIME_MS = 3_600_000;
/** Never attach in the last minute of that hour. */
const ATTACH_MARGIN_MS = 60_000;
/** Whole create budget inside the route's maxDuration of 60 s. */
const CREATE_BUDGET_MS = 45_000;
/** Reserved at the end of the budget to reconcile an ambiguous create. */
const RECONCILE_MS = 8_000;

function badCursor(): ShoeboxError {
  return new ShoeboxError("INVALID_INPUT", {
    status: 400,
    detail: "cursor",
  });
}

/** Opaque, bounded wrapper: callers never choose a raw Notion cursor. */
export function encodeCursor(upstream: string): string {
  return Buffer.from(JSON.stringify({ v: 1, c: upstream })).toString(
    "base64url",
  );
}

export function decodeCursor(cursor: string): string {
  if (
    cursor.length === 0 ||
    cursor.length > MAX_CURSOR_BYTES ||
    !CURSOR_SHAPE.test(cursor)
  ) {
    throw badCursor();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw badCursor();
  }
  if (typeof parsed !== "object" || parsed === null) throw badCursor();
  const { v, c } = parsed as { v?: unknown; c?: unknown };
  if (
    v !== 1 ||
    typeof c !== "string" ||
    c.length === 0 ||
    c.length > MAX_UPSTREAM_CURSOR
  ) {
    throw badCursor();
  }
  return c;
}

type Props = PageObjectResponse["properties"];
type Prop = Props[string] | undefined;

function plainText(prop: Prop): string | null {
  if (prop?.type !== "rich_text") return null;
  return prop.rich_text.map((item) => item.plain_text).join("");
}

function numberOf(prop: Prop): number | null {
  if (prop?.type !== "number") return null;
  return typeof prop.number === "number" && Number.isFinite(prop.number)
    ? prop.number
    : null;
}

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

type Context = { dataSourceId: string; databaseId: string };

type Record_ = { summary: MemorySummary; media: { url: string } | null };

/**
 * Maps one Notion page to the browser-safe summary, or null when the record
 * is not a valid member of the configured source. Never throws, never returns
 * raw upstream data, URLs or file names.
 */
function readRecord(page: unknown, context: Context): Record_ | null {
  if (typeof page !== "object" || page === null) return null;
  const candidate = page as Partial<PageObjectResponse>;
  if (
    candidate.object !== "page" ||
    !candidate.properties ||
    !candidate.parent ||
    typeof candidate.id !== "string"
  ) {
    return null;
  }
  if (candidate.in_trash !== false) return null;
  const parent = candidate.parent;
  if (
    parent.type !== "data_source_id" ||
    normalizeId(parent.data_source_id) !== normalizeId(context.dataSourceId) ||
    typeof parent.database_id !== "string" ||
    normalizeId(parent.database_id) !== normalizeId(context.databaseId)
  ) {
    return null;
  }
  if (!UUID.test(candidate.id)) return null;
  const created = candidate.created_time;
  if (typeof created !== "string" || !Number.isFinite(Date.parse(created))) {
    return null;
  }
  const props = candidate.properties;

  const kindProp = props.Kind;
  const kind =
    kindProp?.type === "select" ? (kindProp.select?.name ?? null) : null;
  if (kind !== "photo" && kind !== "audio" && kind !== "text") return null;

  const dateProp = props["Memory date"];
  if (dateProp?.type !== "date" || !dateProp.date) return null;
  const { start, end, time_zone: zone } = dateProp.date;
  if (end !== null || (zone !== null && zone !== undefined)) return null;
  let memoryDate: string;
  try {
    memoryDate = readMemoryDate(start);
  } catch {
    return null;
  }

  const caption = plainText(props.Caption);
  if (caption === null || codePointLength(caption) > MAX_CAPTION_CHARACTERS) {
    return null;
  }
  const filesProp = props.Media;
  if (filesProp?.type !== "files") return null;
  const files = filesProp.files;

  const id = candidate.id.toLowerCase();
  const base = { id, caption, memoryDate, createdAt: created };

  if (kind === "text") {
    const text = plainText(props.Text);
    if (text === null || files.length !== 0) return null;
    const length = codePointLength(text);
    if (length < 1 || length > MAX_TEXT_CHARACTERS) return null;
    return { summary: { ...base, kind, text }, media: null };
  }

  if (files.length !== 1) return null;
  const file = files[0];
  if (file.type !== "file" || typeof file.file.url !== "string") return null;
  const media = { url: file.file.url };
  const mediaPath = `/api/shoebox/memories/${id}/media`;
  const ext = extension(file.name);

  if (kind === "photo") {
    const width = numberOf(props.Width);
    const height = numberOf(props.Height);
    if (ext !== "jpg" && ext !== "jpeg") return null;
    if (
      width === null ||
      height === null ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > MAX_IMAGE_EDGE ||
      height > MAX_IMAGE_EDGE
    ) {
      return null;
    }
    return {
      summary: { ...base, kind, mediaPath, width, height },
      media,
    };
  }

  const durationSeconds = numberOf(props.Duration);
  const mimeType = AUDIO_TYPES[ext];
  if (
    mimeType === undefined ||
    durationSeconds === null ||
    durationSeconds <= 0 ||
    durationSeconds > MAX_AUDIO_SECONDS
  ) {
    return null;
  }
  return {
    summary: { ...base, kind, mediaPath, durationSeconds, mimeType },
    media,
  };
}

/** Parses an upstream bearer URL; only plain https without credentials. */
function trustedUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function notFound(): ShoeboxError {
  return new ShoeboxError("NOT_FOUND", { detail: "memory" });
}

/**
 * Internal, server-only. Handlers build it only after authenticating; it holds
 * the verified source id and nothing else (never records or responses).
 */
export function createMemoryService(
  gateway: NotionGateway,
  options: { databaseId?: string; clock?: () => number } = {},
): MemoryService {
  let verified: Promise<Context> | null = null;
  const clock = options.clock ?? Date.now;
  // Local courtesy only: coalesces repeats inside this instance. It is not
  // durable and gives no cross-instance exactly-once guarantee.
  const inFlight = new Map<string, Promise<CreateResult>>();

  async function verify(): Promise<Context> {
    const databaseId = options.databaseId ?? getConfig().notionDbId;
    const setup = (detail: string) =>
      new ShoeboxError("SETUP_REQUIRED", { detail });
    const upstream = async <T>(read: () => Promise<T>, detail: string) => {
      try {
        return await read();
      } catch (error) {
        if (
          error instanceof ShoeboxError &&
          (error.code === "NOT_FOUND" || error.code === "SETUP_REQUIRED")
        ) {
          throw setup(detail);
        }
        throw error;
      }
    };

    const database = await upstream(
      () => gateway.retrieveDatabase({ database_id: databaseId }),
      "database",
    );
    if (
      !isFullDatabase(database) ||
      database.in_trash ||
      normalizeId(database.id) !== normalizeId(databaseId) ||
      database.data_sources.length !== 1
    ) {
      throw setup("database");
    }
    const dataSourceId = database.data_sources[0].id;
    const source = await upstream(
      () => gateway.retrieveDataSource({ data_source_id: dataSourceId }),
      "data_source",
    );
    if (
      !isFullDataSource(source) ||
      source.in_trash ||
      normalizeId(source.id) !== normalizeId(dataSourceId)
    ) {
      throw setup("data_source");
    }
    if (
      source.parent.type !== "database_id" ||
      normalizeId(source.parent.database_id) !== normalizeId(database.id)
    ) {
      throw setup("data_source");
    }
    for (const [name, type] of Object.entries(REQUIRED_PROPERTIES)) {
      if (source.properties[name]?.type !== type) {
        throw setup(`schema:${name}`);
      }
    }
    return { dataSourceId, databaseId: database.id };
  }

  function context(): Promise<Context> {
    if (!verified) {
      const attempt = verify();
      verified = attempt;
      // A failure is never cached, so fixing the setup needs no restart.
      attempt.catch(() => {
        if (verified === attempt) verified = null;
      });
    }
    return verified;
  }

  async function load(id: string): Promise<Record_> {
    if (!UUID.test(id)) throw notFound();
    const { dataSourceId, databaseId } = await context();
    const page = await gateway.retrievePage({ page_id: id.toLowerCase() });
    const record = readRecord(page, { dataSourceId, databaseId });
    if (!record) throw notFound();
    return record;
  }

  return {
    async listMemories({ cursor }) {
      const start = cursor === undefined ? undefined : decodeCursor(cursor);
      const ctx = await context();
      let response: Awaited<ReturnType<NotionGateway["queryDataSource"]>>;
      try {
        response = await gateway.queryDataSource({
          data_source_id: ctx.dataSourceId,
          page_size: MEMORY_BATCH_SIZE,
          sorts: [...SORTS],
          ...(start === undefined ? {} : { start_cursor: start }),
        });
      } catch (error) {
        if (
          start !== undefined &&
          error instanceof ShoeboxError &&
          error.detail?.endsWith(":400")
        ) {
          throw badCursor();
        }
        throw error;
      }
      const items: MemorySummary[] = [];
      for (const result of response.results.slice(0, MEMORY_BATCH_SIZE)) {
        const record = readRecord(result, ctx);
        if (record) items.push(record.summary);
      }
      const next =
        response.has_more && response.next_cursor
          ? encodeCursor(response.next_cursor)
          : null;
      return { items, nextCursor: next };
    },

    async getMemory(id) {
      return (await load(id)).summary;
    },

    async resolveMemoryMedia(id) {
      const { summary, media } = await load(id);
      if (summary.kind === "text" || !media) throw notFound();
      const url = trustedUrl(media.url);
      if (!url) throw notFound();
      return {
        kind: summary.kind,
        url,
        expectedMimeType:
          summary.kind === "photo" ? "image/jpeg" : summary.mimeType,
      };
    },

    // No await before coalesced(): the in-flight entry is registered in the
    // same tick, so a concurrent same-ID call always sees it.
    async createMemory(input) {
      const requestId = readRequestId(input.requestId);
      if ((input.kind === "text") !== (input.media === undefined)) {
        throw new ShoeboxError("INVALID_INPUT", {
          status: 400,
          detail: "media",
        });
      }
      return coalesced(requestId, { ...input, requestId });
    },

    /**
     * Membership first (404 before any write), then strict validation against
     * the stored kind, then one property update. Only Caption, Memory date and
     * (text memories) Text are ever sent; Media, Kind and Request ID never.
     */
    async correctMemory(id, patch) {
      const { summary } = await load(id);
      const correction = validateCorrection(patch, summary.kind);
      const ctx = await context();
      const pageId = summary.id;
      const properties: UpdateProperties = {
        Caption: { rich_text: splitRichText(correction.caption) },
        "Memory date": { date: { start: correction.memoryDate } },
      };
      if (summary.kind === "text" && correction.text !== undefined) {
        properties.Text = { rich_text: splitRichText(correction.text) };
      }
      let page: unknown;
      try {
        page = await gateway.updatePage({ page_id: pageId, properties });
      } catch (error) {
        if (!(error instanceof ShoeboxError)) throw error;
        if (error.code === "OUTCOME_UNKNOWN") {
          const seen = await rereadMember(ctx, pageId);
          if (
            typeof seen === "object" &&
            seen !== null &&
            matchesCorrection(seen, summary.kind, correction)
          ) {
            return seen;
          }
          if (seen === "gone") throw notFound();
          throw new ShoeboxError("OUTCOME_UNKNOWN", { detail: error.detail });
        }
        // Notion rejects edits to a page trashed after the lookup with 400.
        if (error.code === "UNAVAILABLE" && error.detail?.endsWith(":400")) {
          const seen = await rereadMember(ctx, pageId);
          if (seen === "gone") throw notFound();
        }
        throw error;
      }
      const mapped = readRecord(page, ctx);
      if (
        mapped &&
        matchesCorrection(mapped.summary, summary.kind, correction)
      ) {
        return mapped.summary;
      }
      const seen = await rereadMember(ctx, pageId);
      if (
        typeof seen === "object" &&
        seen !== null &&
        matchesCorrection(seen, summary.kind, correction)
      ) {
        return seen;
      }
      throw new ShoeboxError("OUTCOME_UNKNOWN", { detail: "update:unmapped" });
    },

    /**
     * Moves a member to Notion's trash. Wrong source/missing/malformed is 404
     * before any write; a member already in the trash is a no-write success.
     */
    async removeMemory(id) {
      if (!UUID.test(id)) throw notFound();
      const ctx = await context();
      const pageId = id.toLowerCase();
      const current = await gateway.retrievePage({ page_id: pageId });
      if (isTrashedMember(current, ctx, pageId)) return;
      if (!readRecord(current, ctx)) throw notFound();
      try {
        const updated = await gateway.updatePage({
          page_id: pageId,
          in_trash: true,
        });
        if (isTrashedMember(updated, ctx, pageId)) return;
      } catch (error) {
        if (
          !(error instanceof ShoeboxError) ||
          error.code !== "OUTCOME_UNKNOWN"
        ) {
          throw error;
        }
        // Trashed or gone (404) means the removal holds; any other re-read
        // failure, or a still-live page, stays unknown.
        try {
          const after = await gateway.retrievePage(
            { page_id: pageId },
            { signal: timeout(RECONCILE_MS) },
          );
          if (isTrashedMember(after, ctx, pageId)) return;
        } catch (reread) {
          if (reread instanceof ShoeboxError && reread.code === "NOT_FOUND") {
            return;
          }
        }
        throw new ShoeboxError("OUTCOME_UNKNOWN", { detail: error.detail });
      }
      throw new ShoeboxError("OUTCOME_UNKNOWN", {
        detail: "trash:unconfirmed",
      });
    },

    async findRequest(rawId) {
      const requestId = readRequestId(rawId);
      const match = await matchRequest(await context(), requestId);
      if (match.state === "none") return { state: "not_found" };
      if (match.state === "ambiguous") return { state: "ambiguous" };
      return { state: "found", memory: match.record.summary };
    },
  };

  /**
   * One reconciliation read of the same page ID after an uncertain or
   * rejected update. A valid member -> its summary; not a live member of the
   * source (trashed, missing) -> "gone"; the read failing -> null.
   */
  async function rereadMember(
    ctx: Context,
    pageId: string,
  ): Promise<MemorySummary | "gone" | null> {
    try {
      const page = await gateway.retrievePage(
        { page_id: pageId },
        { signal: timeout(RECONCILE_MS) },
      );
      return readRecord(page, ctx)?.summary ?? "gone";
    } catch (error) {
      if (error instanceof ShoeboxError && error.code === "NOT_FOUND") {
        return "gone";
      }
      return null;
    }
  }

  /**
   * Runs at most one create per Request ID in this instance. A later caller
   * waits for the earlier attempt, then replays it or conflicts. If that
   * attempt's outcome is unknown or its failure unclassified, the waiter
   * reports unknown too and never writes. After a known no-write failure it may try itself, but only within
   * its own budget, counted from its entry (the wait included).
   */
  async function coalesced(
    requestId: string,
    input: CreateInput,
  ): Promise<CreateResult> {
    const deadline = clock() + CREATE_BUDGET_MS;
    for (;;) {
      const earlier = inFlight.get(requestId);
      if (!earlier) break;
      let outcome: CreateResult;
      try {
        outcome = await earlier;
      } catch (error) {
        // Only a classified no-write failure lets the waiter try; anything
        // else (unknown outcome, unexpected error) may have written.
        if (
          !(error instanceof ShoeboxError) ||
          error.code === "OUTCOME_UNKNOWN"
        ) {
          throw new ShoeboxError("OUTCOME_UNKNOWN", {
            detail: "in_flight_unknown",
          });
        }
        continue;
      }
      if (!sameRequest(outcome.memory, input)) throw conflict("in_flight");
      return { memory: outcome.memory, replayed: true };
    }
    const attempt = createOnce(requestId, input, deadline);
    inFlight.set(requestId, attempt);
    try {
      return await attempt;
    } finally {
      if (inFlight.get(requestId) === attempt) inFlight.delete(requestId);
    }
  }

  async function matchRequest(
    ctx: Context,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<Match> {
    const response = await gateway.queryDataSource(
      {
        data_source_id: ctx.dataSourceId,
        filter: { property: "Request ID", rich_text: { equals: requestId } },
        page_size: REQUEST_QUERY_CAP,
      },
      { signal },
    );
    // Notion's filter is not a uniqueness constraint; re-check exactly.
    const exact = response.results.filter(
      (page) => storedRequestId(page) === requestId,
    );
    if (response.has_more || exact.length > 1) return { state: "ambiguous" };
    if (exact.length === 0) return { state: "none" };
    const record = readRecord(exact[0], ctx);
    // A matching but invalid record is not proof of absence.
    return record ? { state: "one", record } : { state: "ambiguous" };
  }

  async function createOnce(
    requestId: string,
    input: CreateInput,
    deadline: number,
  ): Promise<CreateResult> {
    const writeBudget = () => deadline - RECONCILE_MS - clock();
    // A waiter whose budget the wait consumed must not start any request.
    if (writeBudget() <= 0) throw unavailable("create_budget");
    const ctx = await context();

    const existing = await matchRequest(ctx, requestId, timeout(writeBudget()));
    if (existing.state === "ambiguous") throw conflict("request_ambiguous");
    if (existing.state === "one") {
      if (!sameRequest(existing.record.summary, input)) {
        throw conflict("request_mismatch");
      }
      return { memory: existing.record.summary, replayed: true };
    }

    const upload = input.media
      ? await uploadMedia(input.media, timeout(writeBudget()))
      : undefined;
    if (upload && clock() >= upload.expiresAt - ATTACH_MARGIN_MS) {
      throw unavailable("upload_expired");
    }
    if (writeBudget() <= 0) throw unavailable("create_budget");

    let page: Awaited<ReturnType<NotionGateway["createPage"]>>;
    try {
      page = await gateway.createPage(
        {
          parent: { data_source_id: ctx.dataSourceId },
          properties: pageProperties(input, requestId, upload),
        },
        { signal: timeout(writeBudget()) },
      );
    } catch (error) {
      if (error instanceof ShoeboxError && error.code === "OUTCOME_UNKNOWN") {
        return reconcile(ctx, requestId, input, error);
      }
      // 429/529 after the retry budget, 4xx and setup errors: not created.
      throw error;
    }
    const record =
      readRecord(page, ctx) ??
      readRecord(
        await gateway
          .retrievePage({ page_id: page.id }, { signal: timeout(RECONCILE_MS) })
          .catch(() => null),
        ctx,
      );
    if (!record) {
      throw new ShoeboxError("OUTCOME_UNKNOWN", {
        detail: "create_page:unmapped",
      });
    }
    return { memory: record.summary, replayed: false };
  }

  /**
   * The create may or may not have been saved. Read Notion's committed id
   * when it gave one, then the Request ID; never repeat the create.
   */
  async function reconcile(
    ctx: Context,
    requestId: string,
    input: CreateInput,
    cause: ShoeboxError,
  ): Promise<CreateResult> {
    const signal = timeout(RECONCILE_MS);
    if (cause.resourceId) {
      const page = await gateway
        .retrievePage({ page_id: cause.resourceId }, { signal })
        .catch(() => null);
      const record = readRecord(page, ctx);
      if (
        record &&
        storedRequestId(page) === requestId &&
        sameRequest(record.summary, input)
      ) {
        return { memory: record.summary, replayed: false };
      }
    }
    const match = await matchRequest(ctx, requestId, signal).catch(() => null);
    if (match?.state === "one" && sameRequest(match.record.summary, input)) {
      return { memory: match.record.summary, replayed: false };
    }
    throw new ShoeboxError("OUTCOME_UNKNOWN", { detail: cause.detail });
  }

  /**
   * Single-part upload: create, then send the bytes. A failure here means no
   * page references the upload, so it is a plain retryable failure (never
   * OUTCOME_UNKNOWN); Notion archives an unattached upload after its expiry.
   */
  async function uploadMedia(
    media: ValidatedMedia,
    signal: AbortSignal,
  ): Promise<Upload> {
    const started = clock();
    try {
      const created = await gateway.createFileUpload(
        {
          mode: "single_part",
          filename: media.filename,
          content_type: media.mimeType,
        },
        { signal },
      );
      const sent = await gateway.sendFileUpload(
        {
          file_upload_id: created.id,
          file: {
            filename: media.filename,
            data: new Blob([media.bytes as Uint8Array<ArrayBuffer>], {
              type: media.mimeType,
            }),
          },
        },
        { signal },
      );
      if (sent.status !== "uploaded") throw unavailable("upload_status");
      const reported = sent.expiry_time ? Date.parse(sent.expiry_time) : NaN;
      const expiresAt = Math.min(
        started + UPLOAD_LIFETIME_MS,
        Number.isFinite(reported) ? reported : Number.POSITIVE_INFINITY,
      );
      return { id: created.id, expiresAt };
    } catch (error) {
      if (error instanceof ShoeboxError && error.code === "OUTCOME_UNKNOWN") {
        throw unavailable(error.detail ?? "upload");
      }
      throw error;
    }
  }
}

type UpdateProperties = NonNullable<UpdatePageParameters["properties"]>;

function matchesCorrection(
  memory: MemorySummary,
  kind: MemorySummary["kind"],
  correction: MemoryCorrection,
): boolean {
  if (
    memory.kind !== kind ||
    memory.caption !== correction.caption ||
    memory.memoryDate !== correction.memoryDate
  ) {
    return false;
  }
  return memory.kind !== "text" || memory.text === correction.text;
}

/** A page of this source whose only difference from a member is the trash. */
function isTrashedMember(page: unknown, ctx: Context, id: string): boolean {
  if (typeof page !== "object" || page === null) return false;
  const candidate = page as Partial<PageObjectResponse>;
  const parent = candidate.parent;
  return (
    candidate.object === "page" &&
    candidate.in_trash === true &&
    typeof candidate.id === "string" &&
    normalizeId(candidate.id) === normalizeId(id) &&
    parent?.type === "data_source_id" &&
    normalizeId(parent.data_source_id) === normalizeId(ctx.dataSourceId) &&
    typeof parent.database_id === "string" &&
    normalizeId(parent.database_id) === normalizeId(ctx.databaseId)
  );
}

type CreateResult = { memory: MemorySummary; replayed: boolean };
type Match =
  | { state: "none" }
  | { state: "ambiguous" }
  | { state: "one"; record: Record_ };
type Upload = { id: string; expiresAt: number };

function timeout(ms: number): AbortSignal {
  return AbortSignal.timeout(Math.max(1, Math.floor(ms)));
}

function conflict(detail: string): ShoeboxError {
  return new ShoeboxError("REQUEST_CONFLICT", { detail });
}

function unavailable(detail: string): ShoeboxError {
  return new ShoeboxError("UNAVAILABLE", { detail });
}

function readRequestId(raw: string): string {
  if (typeof raw !== "string" || !UUID.test(raw)) {
    throw new ShoeboxError("INVALID_INPUT", {
      status: 400,
      detail: "request_id",
    });
  }
  return raw.toLowerCase();
}

function storedRequestId(page: unknown): string | null {
  if (typeof page !== "object" || page === null) return null;
  const props = (page as Partial<PageObjectResponse>).properties;
  return props ? plainText(props["Request ID"]) : null;
}

/**
 * Compares every normalized field the record can still show. The original
 * media bytes cannot be proven after the fact (no fingerprint is stored),
 * so media identity is approximated by kind, dimensions, duration and type.
 */
function sameRequest(memory: MemorySummary, input: CreateInput): boolean {
  if (
    memory.kind !== input.kind ||
    memory.caption !== input.caption ||
    memory.memoryDate !== input.memoryDate
  ) {
    return false;
  }
  if (memory.kind === "text") return memory.text === input.text;
  const media = input.media;
  if (!media) return false;
  if (memory.kind === "photo") {
    return memory.width === media.width && memory.height === media.height;
  }
  return (
    memory.durationSeconds === media.durationSeconds &&
    memory.mimeType === media.mimeType
  );
}

type PageProperties = NonNullable<CreatePageParameters["properties"]>;

/** Exactly the section 5 schema; the Name never carries private text. */
function pageProperties(
  input: CreateInput,
  requestId: string,
  upload: Upload | undefined,
): PageProperties {
  const properties: PageProperties = {
    Name: {
      title: [{ type: "text", text: { content: `Recuerdo ${input.kind}` } }],
    },
    Kind: { select: { name: input.kind } },
    "Memory date": { date: { start: input.memoryDate } },
    Caption: { rich_text: splitRichText(input.caption) },
    Text: { rich_text: splitRichText(input.text ?? "") },
    Media: {
      files:
        upload && input.media
          ? [
              {
                type: "file_upload",
                file_upload: { id: upload.id },
                name: input.media.filename,
              },
            ]
          : [],
    },
    "Request ID": {
      rich_text: [{ type: "text", text: { content: requestId } }],
    },
  };
  const media = input.media;
  if (input.kind === "photo" && media) {
    if (!isDimension(media.width) || !isDimension(media.height)) {
      throw unavailable("media_shape");
    }
    properties.Width = { number: media.width };
    properties.Height = { number: media.height };
  }
  if (input.kind === "audio" && media) {
    const seconds = media.durationSeconds;
    if (
      typeof seconds !== "number" ||
      !Number.isFinite(seconds) ||
      seconds <= 0 ||
      seconds > MAX_AUDIO_SECONDS
    ) {
      throw unavailable("media_shape");
    }
    properties.Duration = { number: seconds };
  }
  return properties;
}

function isDimension(value: number | undefined): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_IMAGE_EDGE
  );
}
