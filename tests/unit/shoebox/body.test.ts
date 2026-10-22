import { describe, expect, it } from "vitest";
import {
  MAX_FILE_BYTES,
  MAX_METADATA_BYTES,
  MAX_MULTIPART_BYTES,
} from "@/features/shoebox/limits";
import {
  readBodyLimited,
  readJsonLimited,
  readMultipart,
} from "@/features/shoebox/server/body";
import { ShoeboxError } from "@/features/shoebox/server/errors";
import {
  bytes,
  multipartRequest,
  photoFields,
  REQUEST_ID,
} from "../../helpers/shoebox-fixtures";

function streamRequest(
  chunks: Uint8Array[],
  headers: Record<string, string> = {},
  onCancel?: () => void,
): Request {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index++];
      if (chunk) {
        controller.enqueue(chunk);
      } else {
        controller.close();
      }
    },
    cancel() {
      onCancel?.();
    },
  });
  return new Request("https://shoebox.test/x", {
    method: "POST",
    headers,
    body,
    duplex: "half",
  } as RequestInit);
}

async function code(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return error instanceof ShoeboxError ? error.code : `other:${error}`;
  }
}

describe("readBodyLimited", () => {
  it("returns bytes at the limit and rejects one byte over", async () => {
    const ok = await readBodyLimited(streamRequest([bytes(10)]), 10);
    expect(ok.byteLength).toBe(10);
    expect(await code(readBodyLimited(streamRequest([bytes(11)]), 10))).toBe(
      "TOO_LARGE",
    );
  });

  it("counts actual stream bytes when Content-Length is absent", async () => {
    const request = streamRequest([bytes(6), bytes(6)]);
    expect(request.headers.get("content-length")).toBeNull();
    expect(await code(readBodyLimited(request, 10))).toBe("TOO_LARGE");
  });

  it("cannot be bypassed by a false small Content-Length", async () => {
    const request = streamRequest([bytes(6), bytes(6)], {
      "content-length": "1",
    });
    expect(await code(readBodyLimited(request, 10))).toBe("TOO_LARGE");
  });

  it("rejects an oversized declared length before reading, and cancels", async () => {
    let cancelled = false;
    const request = streamRequest(
      [bytes(1)],
      { "content-length": "11" },
      () => {
        cancelled = true;
      },
    );
    expect(await code(readBodyLimited(request, 10))).toBe("TOO_LARGE");
    expect(cancelled).toBe(true);
  });

  it("cancels the stream on overflow", async () => {
    let cancelled = false;
    const request = streamRequest([bytes(6), bytes(6), bytes(6)], {}, () => {
      cancelled = true;
    });
    await code(readBodyLimited(request, 10));
    expect(cancelled).toBe(true);
  });

  it("returns an empty array for a bodiless request", async () => {
    const result = await readBodyLimited(
      new Request("https://shoebox.test/x", { method: "POST" }),
      10,
    );
    expect(result.byteLength).toBe(0);
  });

  it("stops and cancels when the request is aborted", async () => {
    const controller = new AbortController();
    let cancelled = false;
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        pulls += 1;
        if (pulls > 3) {
          c.close();
          return;
        }
        c.enqueue(bytes(2));
        controller.abort();
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("https://shoebox.test/x", {
      method: "POST",
      body,
      signal: controller.signal,
      duplex: "half",
    } as RequestInit);
    const outcome = await code(readBodyLimited(request, 100));
    expect(outcome).toBeDefined();
    expect(cancelled).toBe(true);
  });
});

describe("readBodyLimited mid-read abort", () => {
  it("throws instead of returning partial bytes when aborted while a read is pending", async () => {
    const controller = new AbortController();
    let sent = false;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        if (!sent) {
          sent = true;
          c.enqueue(bytes(2));
        }
        // Second pull stays pending until cancelled.
        return new Promise(() => undefined);
      },
    });
    const request = new Request("https://shoebox.test/x", {
      method: "POST",
      body,
      signal: controller.signal,
      duplex: "half",
    } as RequestInit);
    const pending = readBodyLimited(request, 100);
    setTimeout(() => controller.abort(), 20);
    expect(await code(pending)).toBe("UNAVAILABLE");
  });
});

describe("readMultipart", () => {
  const photoMetadata = { requestId: REQUEST_ID, ...photoFields };

  it("returns validated fields, request id and the single file", async () => {
    const result = await readMultipart(
      multipartRequest({ files: [bytes(10)] }),
    );
    expect(result.requestId).toBe(REQUEST_ID);
    expect(result.fields).toEqual(photoFields);
    expect(result.file?.size).toBe(10);
  });

  it("accepts a text memory with no file", async () => {
    const result = await readMultipart(
      multipartRequest({
        metadata: {
          requestId: REQUEST_ID,
          kind: "text",
          text: "hola",
          caption: "",
          memoryDate: "2026-10-21",
        },
      }),
    );
    expect(result.file).toBeUndefined();
    expect(result.fields.text).toBe("hola");
  });

  it("rejects zero files for media and any file for text", async () => {
    expect(await code(readMultipart(multipartRequest({})))).toBe(
      "INVALID_INPUT",
    );
    expect(
      await code(
        readMultipart(
          multipartRequest({
            metadata: {
              requestId: REQUEST_ID,
              kind: "text",
              text: "x",
              caption: "",
              memoryDate: "2026-10-21",
            },
            files: [bytes(5)],
          }),
        ),
      ),
    ).toBe("INVALID_INPUT");
  });

  it("rejects more than one file and unexpected fields", async () => {
    expect(
      await code(
        readMultipart(multipartRequest({ files: [bytes(5), bytes(5)] })),
      ),
    ).toBe("INVALID_INPUT");
    expect(
      await code(
        readMultipart(
          multipartRequest({ files: [bytes(5)], extraFields: { note: "x" } }),
        ),
      ),
    ).toBe("INVALID_INPUT");
  });

  it("accepts a file of 4,000,000 bytes and rejects 4,000,001", async () => {
    const ok = await readMultipart(
      multipartRequest({ files: [bytes(MAX_FILE_BYTES)] }),
    );
    expect(ok.file?.size).toBe(MAX_FILE_BYTES);
    expect(
      await code(
        readMultipart(multipartRequest({ files: [bytes(MAX_FILE_BYTES + 1)] })),
      ),
    ).toBe("TOO_LARGE");
  });

  it("accepts a total of 4,200,000 bytes and rejects 4,200,001", async () => {
    const ok = await readMultipart(
      multipartRequest({
        files: [bytes(MAX_FILE_BYTES)],
        totalBytes: MAX_MULTIPART_BYTES,
      }),
    );
    expect(ok.file?.size).toBe(MAX_FILE_BYTES);
    expect(
      await code(
        readMultipart(
          multipartRequest({
            files: [bytes(MAX_FILE_BYTES)],
            totalBytes: MAX_MULTIPART_BYTES + 1,
          }),
        ),
      ),
    ).toBe("TOO_LARGE");
  });

  it("enforces the total even when Content-Length lies or is unknown", async () => {
    const lying = multipartRequest({
      files: [bytes(MAX_FILE_BYTES)],
      totalBytes: MAX_MULTIPART_BYTES + 1,
      headers: { "content-length": "100" },
    });
    expect(await code(readMultipart(lying))).toBe("TOO_LARGE");
  });

  it("limits metadata to 16,384 bytes", async () => {
    const base = JSON.stringify(photoMetadata);
    const atLimit = base + " ".repeat(MAX_METADATA_BYTES - base.length);
    expect(new TextEncoder().encode(atLimit).byteLength).toBe(
      MAX_METADATA_BYTES,
    );
    const ok = await readMultipart(
      multipartRequest({ metadata: atLimit, files: [bytes(5)] }),
    );
    expect(ok.requestId).toBe(REQUEST_ID);
    expect(
      await code(
        readMultipart(
          multipartRequest({ metadata: `${atLimit} `, files: [bytes(5)] }),
        ),
      ),
    ).toBe("TOO_LARGE");
  });

  it("requires a UUID request id and exact metadata keys", async () => {
    for (const metadata of [
      { ...photoFields },
      { requestId: "not-a-uuid", ...photoFields },
      { requestId: REQUEST_ID, ...photoFields, extra: 1 },
      "{not json",
      "[]",
    ]) {
      expect(
        await code(
          readMultipart(multipartRequest({ metadata, files: [bytes(5)] })),
        ),
      ).toBeDefined();
    }
  });

  it("rejects calendar-invalid dates in metadata", async () => {
    const error = await readMultipart(
      multipartRequest({
        metadata: { ...photoMetadata, memoryDate: "2026-02-30" },
        files: [bytes(5)],
      }),
    ).catch((e) => e);
    expect(error).toBeDefined();
    expect(error.message).not.toContain("2026-02-30");
  });

  it("rejects non-multipart content types", async () => {
    const request = new Request("https://shoebox.test/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(await code(readMultipart(request))).toBe("UNSUPPORTED_MEDIA");
  });
});

describe("readJsonLimited", () => {
  const json = (body: BodyInit) =>
    new Request("https://shoebox.test/x", { method: "POST", body });

  it("parses JSON up to the limit", async () => {
    expect(await readJsonLimited(json('{"a":1}'), 7)).toEqual({ a: 1 });
  });

  it("rejects one byte over the limit with TOO_LARGE (413)", async () => {
    const error = await readJsonLimited(json('{"a":1} '), 7).catch((e) => e);
    expect(error).toBeInstanceOf(ShoeboxError);
    expect(error).toMatchObject({ code: "TOO_LARGE", status: 413 });
  });

  it.each([
    ["invalid JSON", "{a:1}"],
    ["empty body", ""],
    ["invalid UTF-8", new Uint8Array([0x22, 0xff, 0x22])],
  ])("rejects %s with INVALID_INPUT (400)", async (_, body) => {
    const error = await readJsonLimited(json(body), 100).catch((e) => e);
    expect(error).toMatchObject({ code: "INVALID_INPUT", status: 400 });
  });
});
