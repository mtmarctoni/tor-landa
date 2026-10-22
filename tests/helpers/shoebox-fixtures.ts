import type { MemoryFields } from "@/types/shoebox";

export const REQUEST_ID = "0b0f5f0e-6a2c-4f43-9a41-1d9d3b6a7c10";

export function textFields(overrides: Record<string, unknown> = {}) {
  return {
    kind: "text",
    text: "x",
    caption: "",
    memoryDate: "2026-10-21",
    ...overrides,
  };
}

export const photoFields: MemoryFields = {
  kind: "photo",
  caption: "",
  memoryDate: "2026-10-21",
};

const encoder = new TextEncoder();

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

export type MultipartOptions = {
  metadata?: unknown;
  files?: Uint8Array[];
  extraFields?: Record<string, string>;
  /** Pad using leading CRLF pairs and, for odd lengths, header whitespace. */
  totalBytes?: number;
  headers?: Record<string, string>;
};

export function buildMultipartBody(options: MultipartOptions): {
  body: Uint8Array;
  contentType: string;
} {
  const boundary = "----shoeboxtestboundary";
  const section = (header: string, content: Uint8Array) => [
    encoder.encode(`--${boundary}\r\n${header}\r\n\r\n`),
    content,
    encoder.encode("\r\n"),
  ];
  const parts: Uint8Array[] = [];
  const metadata =
    options.metadata === undefined
      ? { requestId: REQUEST_ID, ...photoFields }
      : options.metadata;
  const raw =
    typeof metadata === "string" ? metadata : JSON.stringify(metadata);
  parts.push(
    ...section(
      'Content-Disposition: form-data; name="metadata"',
      encoder.encode(raw),
    ),
  );
  for (const [name, value] of Object.entries(options.extraFields ?? {})) {
    parts.push(
      ...section(
        `Content-Disposition: form-data; name="${name}"`,
        encoder.encode(value),
      ),
    );
  }
  for (const file of options.files ?? []) {
    parts.push(
      ...section(
        'Content-Disposition: form-data; name="file"; filename="a.jpg"\r\nContent-Type: image/jpeg',
        file,
      ),
    );
  }
  parts.push(encoder.encode(`--${boundary}--\r\n`));
  let body = concat(parts);
  if (options.totalBytes !== undefined) {
    const pad = options.totalBytes - body.byteLength;
    if (pad < 0) {
      throw new Error("totalBytes smaller than the multipart body");
    }
    // Node22's multipart parser accepts leading CRLF, not an arbitrary space
    // preamble (Node24 is more permissive). Keep the opening delimiter valid.
    if (pad % 2 === 1) {
      // Optional whitespace after the first header colon changes neither the
      // metadata nor file bytes and lets us construct odd total lengths too.
      const afterColon = body.indexOf(0x3a) + 1;
      body = concat([
        body.subarray(0, afterColon),
        new Uint8Array([0x20]),
        body.subarray(afterColon),
      ]);
    }
    const prefix = new Uint8Array(pad - (pad % 2));
    for (let index = 0; index < prefix.length; index += 2) {
      prefix[index] = 0x0d;
      prefix[index + 1] = 0x0a;
    }
    body = concat([prefix, body]);
  }
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

export function multipartRequest(options: MultipartOptions): Request {
  const { body, contentType } = buildMultipartBody(options);
  return new Request("https://shoebox.test/api/shoebox/memories", {
    method: "POST",
    headers: { "content-type": contentType, ...options.headers },
    body: body as BodyInit,
  });
}

export function bytes(length: number): Uint8Array {
  return new Uint8Array(length).fill(0x61);
}
