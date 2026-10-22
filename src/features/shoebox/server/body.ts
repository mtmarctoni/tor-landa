import "server-only";
import type { MemoryFields } from "@/types/shoebox";
import {
  MAX_FILE_BYTES,
  MAX_METADATA_BYTES,
  MAX_MULTIPART_BYTES,
} from "../limits";
import { validateFields } from "../validation";
import { ShoeboxError } from "./errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads at most `limit` bytes. A declared Content-Length is only an early
 * hint; the bytes actually received are always counted.
 */
export async function readBodyLimited(
  request: Request,
  limit: number,
): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");
  if (declared !== null && /^\d+$/.test(declared) && Number(declared) > limit) {
    await request.body?.cancel().catch(() => undefined);
    throw new ShoeboxError("TOO_LARGE");
  }
  if (!request.body) {
    return new Uint8Array(0);
  }

  const reader = request.body.getReader();
  let aborted = false;
  const onAbort = () => {
    aborted = true;
    reader.cancel().catch(() => undefined);
  };
  request.signal.addEventListener("abort", onAbort, { once: true });

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      if (request.signal.aborted) {
        throw new ShoeboxError("UNAVAILABLE");
      }
      const { done, value } = await reader.read();
      if (aborted || request.signal.aborted) {
        throw new ShoeboxError("UNAVAILABLE");
      }
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        throw new ShoeboxError("TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    request.signal.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function parseMetadata(raw: FormDataEntryValue | null): {
  fields: MemoryFields;
  requestId: string;
} {
  if (typeof raw !== "string") {
    throw new ShoeboxError("INVALID_INPUT", { status: 400 });
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_METADATA_BYTES) {
    throw new ShoeboxError("TOO_LARGE");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ShoeboxError("INVALID_INPUT", { status: 400 });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ShoeboxError("INVALID_INPUT", { status: 400 });
  }
  const { requestId, ...rest } = parsed as Record<string, unknown>;
  if (typeof requestId !== "string" || !UUID_PATTERN.test(requestId)) {
    throw new ShoeboxError("INVALID_INPUT", { status: 400 });
  }
  return { fields: validateFields(rest), requestId };
}

/**
 * Counts the request stream first, then parses a bounded reconstructed
 * Request so the multipart parser never sees more than the total limit.
 */
export async function readMultipart(
  request: Request,
): Promise<{ fields: MemoryFields; requestId: string; file?: File }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;\s*boundary=/i.test(contentType)) {
    throw new ShoeboxError("UNSUPPORTED_MEDIA");
  }
  const bytes = await readBodyLimited(request, MAX_MULTIPART_BYTES);

  let form: FormData;
  try {
    form = await new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": contentType },
      body: bytes as BodyInit,
    }).formData();
  } catch {
    throw new ShoeboxError("INVALID_INPUT", { status: 400 });
  }

  for (const [name] of form.entries()) {
    if (name !== "metadata" && name !== "file") {
      throw new ShoeboxError("INVALID_INPUT", { status: 400 });
    }
  }
  const metadata = form.getAll("metadata");
  const files = form.getAll("file");
  if (metadata.length !== 1 || files.length > 1) {
    throw new ShoeboxError("INVALID_INPUT", { status: 400 });
  }

  const { fields, requestId } = parseMetadata(metadata[0] ?? null);
  const file = files[0];
  if (file !== undefined && typeof file === "string") {
    throw new ShoeboxError("INVALID_INPUT", { status: 400 });
  }
  if ((fields.kind === "text") !== (file === undefined)) {
    throw new ShoeboxError("INVALID_INPUT", { status: 400 });
  }
  if (file !== undefined && file.size > MAX_FILE_BYTES) {
    throw new ShoeboxError("TOO_LARGE");
  }
  return file === undefined
    ? { fields, requestId }
    : { fields, requestId, file };
}

/** Bounded JSON read: 413 over `limit`, 400 for invalid UTF-8 or JSON. */
export async function readJsonLimited(
  request: Request,
  limit: number,
): Promise<unknown> {
  const bytes = await readBodyLimited(request, limit);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new ShoeboxError("INVALID_INPUT", { status: 400 });
  }
}
