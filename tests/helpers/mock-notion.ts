import {
  type APIErrorCode,
  APIResponseError,
  type CreateFileUploadParameters,
  type CreatePageParameters,
  type DatabaseObjectResponse,
  type DataSourceObjectResponse,
  type FileUploadObjectResponse,
  type PageObjectResponse,
  type QueryDataSourceParameters,
  type UpdatePageParameters,
} from "@notionhq/client";
import type { NotionClientLike } from "@/features/shoebox/server/notion-gateway";

/**
 * Offline fake of the Notion SDK client plus fixture builders. Everything is
 * synthetic; nothing here opens a socket. Later tasks extend `counters` and
 * `MockMethod` with write operations (they already exist as counted no-ops).
 */

export const DATABASE_ID = "d4a1c0de-0000-4000-8000-00000000d001";
export const DATA_SOURCE_ID = "d4a1c0de-0000-4000-8000-0000000d5001";
export const OTHER_DATABASE_ID = "d4a1c0de-0000-4000-8000-00000000d002";
export const OTHER_DATA_SOURCE_ID = "d4a1c0de-0000-4000-8000-0000000d5002";

export const SCHEMA_TYPES: Record<string, string> = {
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

/** Deterministic UUID for record number `n`. */
export function memoryId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const ANNOTATIONS = {
  bold: false,
  italic: false,
  strikethrough: false,
  underline: false,
  code: false,
  color: "default",
};

export function richText(...chunks: string[]) {
  return chunks.map((content) => ({
    type: "text",
    text: { content, link: null },
    plain_text: content,
    href: null,
    annotations: ANNOTATIONS,
  }));
}

export type FileSpec = {
  name: string;
  url?: string;
  type?: "file" | "external";
};

export type PageSpec = {
  id: string;
  kind?: string | null;
  /** `undefined` -> default date, `null` -> empty date property. */
  date?: string | null;
  dateExtra?: Record<string, unknown>;
  createdTime?: string;
  caption?: string | string[];
  text?: string | string[];
  files?: FileSpec[];
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  parent?: unknown;
  inTrash?: boolean;
  /** Stored Request ID text; omitted -> empty rich text. */
  requestId?: string;
};

function defaultFiles(kind: string | null | undefined, id: string): FileSpec[] {
  if (kind === "photo") return [{ name: "private-original-name.jpg" }];
  if (kind === "audio") return [{ name: "private-original-name.webm" }];
  void id;
  return [];
}

function fileValue(file: FileSpec, id: string) {
  const url = file.url ?? `https://prod-files.notion.test/secret/${id}?sig=zzz`;
  if (file.type === "external") {
    return { name: file.name, type: "external", external: { url } };
  }
  return {
    name: file.name,
    type: "file",
    file: { url, expiry_time: "2099-01-01T00:00:00.000Z" },
  };
}

export function buildPage(spec: PageSpec): PageObjectResponse {
  const kind = spec.kind === undefined ? "text" : spec.kind;
  const date = spec.date === undefined ? "2026-10-21" : spec.date;
  const asArray = (value: string | string[] | undefined) =>
    value === undefined ? [] : Array.isArray(value) ? value : [value];
  const text = spec.text === undefined && kind === "text" ? "hola" : spec.text;
  const files = spec.files ?? defaultFiles(kind, spec.id);
  const isPhoto = kind === "photo";
  const isAudio = kind === "audio";
  const width = spec.width === undefined ? (isPhoto ? 640 : null) : spec.width;
  const height =
    spec.height === undefined ? (isPhoto ? 480 : null) : spec.height;
  const duration =
    spec.duration === undefined ? (isAudio ? 12.5 : null) : spec.duration;
  const page = {
    object: "page",
    id: spec.id,
    created_time: spec.createdTime ?? "2026-10-21T10:00:00.000Z",
    last_edited_time: "2026-10-21T10:00:00.000Z",
    in_trash: spec.inTrash ?? false,
    archived: spec.inTrash ?? false,
    is_archived: spec.inTrash ?? false,
    is_locked: false,
    url: `https://notion.test/${spec.id}`,
    public_url: null,
    parent: spec.parent ?? {
      type: "data_source_id",
      data_source_id: DATA_SOURCE_ID,
      database_id: DATABASE_ID,
    },
    icon: null,
    cover: null,
    created_by: { object: "user", id: "u" },
    last_edited_by: { object: "user", id: "u" },
    properties: {
      Name: { id: "p1", type: "title", title: richText("memoria") },
      Kind: {
        id: "p2",
        type: "select",
        select: kind === null ? null : { id: "s", name: kind, color: "gray" },
      },
      "Memory date": {
        id: "p3",
        type: "date",
        date:
          date === null
            ? null
            : { start: date, end: null, time_zone: null, ...spec.dateExtra },
      },
      Caption: {
        id: "p4",
        type: "rich_text",
        rich_text: richText(...asArray(spec.caption)),
      },
      Text: {
        id: "p5",
        type: "rich_text",
        rich_text: richText(...asArray(text)),
      },
      Media: {
        id: "p6",
        type: "files",
        files: files.map((file) => fileValue(file, spec.id)),
      },
      "Request ID": {
        id: "p7",
        type: "rich_text",
        rich_text: spec.requestId === undefined ? [] : richText(spec.requestId),
      },
      Width: { id: "p8", type: "number", number: width },
      Height: { id: "p9", type: "number", number: height },
      Duration: { id: "p10", type: "number", number: duration },
    },
  };
  return page as unknown as PageObjectResponse;
}

export function buildDatabase(
  options: { dataSourceIds?: string[]; inTrash?: boolean; id?: string } = {},
): DatabaseObjectResponse {
  const ids = options.dataSourceIds ?? [DATA_SOURCE_ID];
  return {
    object: "database",
    id: options.id ?? DATABASE_ID,
    title: [],
    description: [],
    parent: { type: "workspace", workspace: true },
    is_inline: false,
    in_trash: options.inTrash ?? false,
    archived: options.inTrash ?? false,
    is_locked: false,
    created_time: "2026-10-21T10:00:00.000Z",
    last_edited_time: "2026-10-21T10:00:00.000Z",
    data_sources: ids.map((id) => ({ id, name: "Memories" })),
    icon: null,
    cover: null,
    url: "https://notion.test/db",
    public_url: null,
  } as unknown as DatabaseObjectResponse;
}

export function buildDataSource(
  options: {
    id?: string;
    /** `null` removes the property, a string changes its type. */
    overrides?: Record<string, string | null>;
    inTrash?: boolean;
    databaseId?: string;
  } = {},
): DataSourceObjectResponse {
  const types = { ...SCHEMA_TYPES };
  for (const [name, type] of Object.entries(options.overrides ?? {})) {
    if (type === null) delete types[name];
    else types[name] = type;
  }
  const properties: Record<string, unknown> = {};
  let index = 0;
  for (const [name, type] of Object.entries(types)) {
    index += 1;
    properties[name] = {
      id: `prop${index}`,
      name,
      description: null,
      type,
      [type]: type === "select" ? { options: [] } : {},
    };
  }
  return {
    object: "data_source",
    id: options.id ?? DATA_SOURCE_ID,
    title: [],
    description: [],
    parent: { type: "database_id", database_id: DATABASE_ID },
    database_parent: { type: "workspace", workspace: true },
    is_inline: false,
    in_trash: options.inTrash ?? false,
    archived: options.inTrash ?? false,
    created_time: "2026-10-21T10:00:00.000Z",
    last_edited_time: "2026-10-21T10:00:00.000Z",
    properties,
    icon: null,
    cover: null,
    url: "https://notion.test/ds",
    public_url: null,
  } as unknown as DataSourceObjectResponse;
}

/** Real SDK error class so the gateway sees exactly what the SDK throws. */
export function notionError(options: {
  status: number;
  code?: APIErrorCode | string;
  retryAfter?: string;
  body?: string;
  additionalData?: Record<string, string | string[]>;
}): APIResponseError {
  const headers = new Headers();
  if (options.retryAfter !== undefined) {
    headers.set("retry-after", options.retryAfter);
  }
  return new APIResponseError({
    code: (options.code ?? "internal_server_error") as APIErrorCode,
    status: options.status,
    message: "synthetic upstream failure SECRET-DETAIL",
    headers,
    rawBodyText: options.body ?? "{}",
    additional_data: options.additionalData,
    request_id: undefined,
  });
}

export type MockMethod =
  | "databasesRetrieve"
  | "dataSourcesRetrieve"
  | "dataSourcesQuery"
  | "pagesRetrieve"
  | "pagesUpdate"
  | "pagesCreate"
  | "fileUploadsCreate"
  | "fileUploadsSend"
  | "fileUploadsComplete";

export type MockNotionOptions = {
  pages?: PageObjectResponse[];
  database?: DatabaseObjectResponse;
  dataSources?: DataSourceObjectResponse[];
  /** Return trashed pages from queries (real Notion would not). */
  leakTrashedInQueries?: boolean;
  /** Milliseconds; drives created_time and upload expiry. */
  now?: () => number;
  /** Notion expires unattached uploads after one hour. */
  uploadLifetimeMs?: number;
};

/** What the fake recorded for one binary send (never the bytes' meaning). */
export type FileSendCall = {
  file_upload_id: string;
  filename: string | undefined;
  type: string;
  bytes: Uint8Array;
};

type MockUpload = {
  id: string;
  filename: string | null;
  contentType: string | null;
  status: FileUploadObjectResponse["status"];
  createdMs: number;
  attached: boolean;
};

const METHODS: MockMethod[] = [
  "databasesRetrieve",
  "dataSourcesRetrieve",
  "dataSourcesQuery",
  "pagesRetrieve",
  "pagesUpdate",
  "pagesCreate",
  "fileUploadsCreate",
  "fileUploadsSend",
  "fileUploadsComplete",
];

type Outcome = unknown | (() => unknown | Promise<unknown>);
const HANG = Symbol("hang");

function sortKey(page: PageObjectResponse): [string, string] {
  const prop = page.properties["Memory date"];
  const date = prop && prop.type === "date" && prop.date ? prop.date.start : "";
  return [date, page.created_time];
}

export function createMockNotion(options: MockNotionOptions = {}) {
  const database = options.database ?? buildDatabase();
  const dataSources = new Map(
    (options.dataSources ?? [buildDataSource()]).map((ds) => [ds.id, ds]),
  );
  const pages = new Map<string, PageObjectResponse>(
    (options.pages ?? []).map((page) => [page.id, page]),
  );
  const counters = Object.fromEntries(
    METHODS.map((method) => [method, 0]),
  ) as Record<MockMethod, number>;
  const queries: QueryDataSourceParameters[] = [];
  const scripted = new Map<MockMethod, Outcome[]>();
  const afterCommit = new Map<MockMethod, Outcome[]>();
  const now = options.now ?? Date.now;
  const uploadLifetimeMs = options.uploadLifetimeMs ?? 3_600_000;
  const pageCreateCalls: CreatePageParameters[] = [];
  const pageUpdateCalls: UpdatePageParameters[] = [];
  const fileUploadCalls: CreateFileUploadParameters[] = [];
  const fileSendCalls: FileSendCall[] = [];
  const uploads = new Map<string, MockUpload>();
  let sequence = 0;

  function uploadObject(upload: MockUpload): FileUploadObjectResponse {
    const expired =
      upload.status === "expired" ||
      (!upload.attached && now() >= upload.createdMs + uploadLifetimeMs);
    if (expired) upload.status = "expired";
    return {
      object: "file_upload",
      id: upload.id,
      created_time: new Date(upload.createdMs).toISOString(),
      created_by: { id: "bot", type: "bot" },
      last_edited_time: new Date(upload.createdMs).toISOString(),
      in_trash: false,
      archived: false,
      expiry_time: new Date(upload.createdMs + uploadLifetimeMs).toISOString(),
      status: upload.status,
      filename: upload.filename,
      content_type: upload.contentType,
      content_length: null,
      upload_url: `https://api.notion.test/v1/file_uploads/${upload.id}/send`,
    };
  }

  function enter(method: MockMethod): Promise<void> | undefined {
    counters[method] += 1;
    const queue = scripted.get(method);
    if (!queue || queue.length === 0) return undefined;
    const outcome = queue.shift();
    if (outcome === HANG) return new Promise<void>(() => undefined);
    return (async () => {
      const value = typeof outcome === "function" ? await outcome() : outcome;
      throw value;
    })();
  }

  async function guard<T>(
    method: MockMethod,
    run: () => T | Promise<T>,
  ): Promise<T> {
    const scriptedFailure = enter(method);
    if (scriptedFailure) {
      await scriptedFailure;
    }
    const value = await run();
    // The write happened; the caller still sees a failure (or nothing).
    const late = afterCommit.get(method)?.shift();
    if (late === HANG) return new Promise<T>(() => undefined);
    if (late !== undefined) {
      throw typeof late === "function" ? await late() : late;
    }
    return value;
  }

  function invalid(message: string): never {
    throw notionError({ status: 400, code: "validation_error", body: message });
  }

  type Values = NonNullable<CreatePageParameters["properties"]>;
  function textOf(value: Values[string] | undefined): string | undefined {
    if (!value) return undefined;
    const items =
      "rich_text" in value
        ? value.rich_text
        : "title" in value
          ? value.title
          : undefined;
    if (!items) return undefined;
    return items
      .map((item) => ("text" in item && item.text ? item.text.content : ""))
      .join("");
  }
  function numberValue(value: Values[string] | undefined): number | null {
    return value && "number" in value ? value.number : null;
  }

  function createPage(args: CreatePageParameters): PageObjectResponse {
    pageCreateCalls.push(structuredClone(args));
    const parent = args.parent;
    if (
      !parent ||
      !("data_source_id" in parent) ||
      !dataSources.has(parent.data_source_id)
    ) {
      throw notionError({ status: 404, code: "object_not_found" });
    }
    const props = args.properties ?? {};
    const files: FileSpec[] = [];
    const media = props.Media;
    if (media && "files" in media) {
      for (const file of media.files) {
        if (!("file_upload" in file)) invalid("external files unsupported");
        const upload = uploads.get(file.file_upload.id);
        if (!upload) invalid("unknown file upload");
        if (uploadObject(upload).status !== "uploaded" || upload.attached) {
          invalid("file upload is not attachable");
        }
        files.push({ name: file.name ?? upload.filename ?? "file" });
      }
    }
    if (media && "files" in media) {
      for (const file of media.files) {
        if ("file_upload" in file) {
          const upload = uploads.get(file.file_upload.id);
          if (upload) upload.attached = true;
        }
      }
    }
    sequence += 1;
    const kindValue = props.Kind;
    const kind =
      kindValue && "select" in kindValue && kindValue.select
        ? (kindValue.select.name ?? null)
        : null;
    const dateValue = props["Memory date"];
    const date =
      dateValue && "date" in dateValue && dateValue.date
        ? dateValue.date.start
        : null;
    const page = buildPage({
      id: memoryId(9_000 + sequence),
      kind,
      date,
      createdTime: new Date(now()).toISOString(),
      caption: textOf(props.Caption) ?? "",
      text: textOf(props.Text) ?? "",
      files,
      width: numberValue(props.Width),
      height: numberValue(props.Height),
      duration: numberValue(props.Duration),
      requestId: textOf(props["Request ID"]),
      parent: {
        type: "data_source_id",
        data_source_id: parent.data_source_id,
        database_id: database.id,
      },
    });
    // buildPage gives every non-empty string one rich-text chunk; mirror the
    // real chunking so multi-chunk text round-trips like Notion would.
    for (const name of ["Caption", "Text", "Request ID", "Name"] as const) {
      const value = props[name];
      const target = page.properties[name];
      if (!value || !target) continue;
      const items =
        "rich_text" in value
          ? value.rich_text
          : "title" in value
            ? value.title
            : [];
      const rebuilt = richText(
        ...items.map((item) =>
          "text" in item && item.text ? item.text.content : "",
        ),
      );
      if (target.type === "rich_text") {
        (target as { rich_text: unknown }).rich_text = rebuilt;
      } else if (target.type === "title") {
        (target as { title: unknown }).title = rebuilt;
      }
    }
    pages.set(page.id, page);
    return page;
  }

  function matchesFilter(
    page: PageObjectResponse,
    filter: QueryDataSourceParameters["filter"],
  ): boolean {
    if (!filter) return true;
    const candidate = filter as {
      property?: string;
      rich_text?: { equals?: string };
    };
    if (
      candidate.property === "Request ID" &&
      candidate.rich_text?.equals !== undefined
    ) {
      const prop = page.properties["Request ID"];
      const stored =
        prop?.type === "rich_text"
          ? prop.rich_text.map((item) => item.plain_text).join("")
          : "";
      // Deliberately looser than the server: case-insensitive, like a search.
      return stored.toLowerCase() === candidate.rich_text.equals.toLowerCase();
    }
    throw new Error("mock-notion: unsupported filter");
  }

  const unsupported = (name: string) => () => {
    throw new Error(`mock-notion: ${name} is not implemented yet`);
  };

  const client: NotionClientLike = {
    databases: {
      retrieve: (args) =>
        guard("databasesRetrieve", () => {
          if (args.database_id !== database.id) {
            throw notionError({ status: 404, code: "object_not_found" });
          }
          return database;
        }),
    },
    dataSources: {
      retrieve: (args) =>
        guard("dataSourcesRetrieve", () => {
          const found = dataSources.get(args.data_source_id);
          if (!found) {
            throw notionError({ status: 404, code: "object_not_found" });
          }
          return found;
        }),
      query: (args) =>
        guard("dataSourcesQuery", () => {
          queries.push(structuredClone(args));
          const all = [...pages.values()]
            .filter((page) => options.leakTrashedInQueries || !page.in_trash)
            .filter((page) => matchesFilter(page, args.filter))
            .sort((a, b) => {
              const [ad, ac] = sortKey(a);
              const [bd, bc] = sortKey(b);
              return bd.localeCompare(ad) || bc.localeCompare(ac);
            });
          const offset = args.start_cursor
            ? Number(args.start_cursor.replace("mock-cursor-", ""))
            : 0;
          const size = Math.min(args.page_size ?? 100, 100);
          const slice = all.slice(offset, offset + size);
          const hasMore = offset + size < all.length;
          return {
            type: "page_or_data_source",
            page_or_data_source: {},
            object: "list",
            next_cursor: hasMore ? `mock-cursor-${offset + size}` : null,
            has_more: hasMore,
            results: slice,
          } as unknown as Awaited<
            ReturnType<NotionClientLike["dataSources"]["query"]>
          >;
        }),
    },
    pages: {
      retrieve: (args) =>
        guard("pagesRetrieve", () => {
          const found = pages.get(args.page_id);
          if (!found) {
            throw notionError({ status: 404, code: "object_not_found" });
          }
          return found;
        }),
      update: (args) =>
        guard("pagesUpdate", () => {
          const found = pages.get(args.page_id);
          if (!found) {
            throw notionError({ status: 404, code: "object_not_found" });
          }
          pageUpdateCalls.push(structuredClone(args));
          // Like Notion: a trashed page accepts no property edits.
          if (args.properties && found.in_trash) {
            invalid("Can't edit a page that is in the trash");
          }
          for (const [name, value] of Object.entries(args.properties ?? {})) {
            const target = found.properties[name];
            if (!target || !value) invalid(`unknown property ${name}`);
            if (target.type === "rich_text" && "rich_text" in value) {
              (target as { rich_text: unknown }).rich_text = richText(
                ...value.rich_text.map((item) =>
                  "text" in item && item.text ? item.text.content : "",
                ),
              );
            } else if (
              target.type === "date" &&
              "date" in value &&
              value.date
            ) {
              (target as { date: unknown }).date = {
                start: value.date.start,
                end: null,
                time_zone: null,
              };
            } else {
              invalid(`unsupported update of ${name}`);
            }
          }
          if (args.in_trash !== undefined) {
            found.in_trash = args.in_trash;
            found.archived = args.in_trash;
            found.is_archived = args.in_trash;
          }
          return found;
        }),
      create: (args) => guard("pagesCreate", () => createPage(args)),
    },
    fileUploads: {
      create: (args) =>
        guard("fileUploadsCreate", () => {
          fileUploadCalls.push(structuredClone(args));
          if (args.mode !== "single_part") invalid("only single_part");
          sequence += 1;
          const upload: MockUpload = {
            id: `f17e0000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
            filename: args.filename ?? null,
            contentType: args.content_type ?? null,
            status: "pending",
            createdMs: now(),
            attached: false,
          };
          uploads.set(upload.id, upload);
          return uploadObject(upload);
        }),
      send: (args) =>
        guard("fileUploadsSend", async () => {
          const data = args.file.data;
          const blob = typeof data === "string" ? new Blob([data]) : data;
          fileSendCalls.push({
            file_upload_id: args.file_upload_id,
            filename: args.file.filename,
            type: blob.type,
            bytes: new Uint8Array(await blob.arrayBuffer()),
          });
          const upload = uploads.get(args.file_upload_id);
          if (!upload) {
            throw notionError({ status: 404, code: "object_not_found" });
          }
          if (uploadObject(upload).status !== "pending") {
            invalid("upload is not pending");
          }
          upload.status = "uploaded";
          return uploadObject(upload);
        }),
      complete: unsupportedCounted("fileUploadsComplete"),
    },
  };

  function unsupportedCounted(method: MockMethod) {
    return () => guard(method, unsupported(method)) as never;
  }

  return {
    client,
    counters,
    queries,
    pages,
    uploads,
    pageCreateCalls,
    pageUpdateCalls,
    fileUploadCalls,
    fileSendCalls,
    /** Total count of every counted call. */
    total: () => Object.values(counters).reduce((a, b) => a + b, 0),
    /** Throw these values (or call these functions) on the next calls. */
    failNext(method: MockMethod, ...outcomes: Outcome[]) {
      scripted.set(method, [...(scripted.get(method) ?? []), ...outcomes]);
    },
    /** Next call to `method` never settles. */
    hangNext(method: MockMethod) {
      scripted.set(method, [...(scripted.get(method) ?? []), HANG]);
    },
    /**
     * The next calls perform the write, then throw these values (or never
     * settle for `"hang"`): the committed-but-unacknowledged case.
     */
    failAfterCommit(method: MockMethod, ...outcomes: (Outcome | "hang")[]) {
      afterCommit.set(method, [
        ...(afterCommit.get(method) ?? []),
        ...outcomes.map((outcome) => (outcome === "hang" ? HANG : outcome)),
      ]);
    },
    /** Marks every unattached upload expired, as Notion does after an hour. */
    expireUploads() {
      for (const upload of uploads.values()) {
        if (!upload.attached) upload.status = "expired";
      }
    },
  };
}

export type MockNotion = ReturnType<typeof createMockNotion>;
