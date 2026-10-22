import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { inspectAudioPreview } from "@/features/shoebox/client/audio-preview";
import * as limits from "@/features/shoebox/limits";
import { MEDIA_RULES } from "@/features/shoebox/media-inspection.mjs";
import {
  createMediaValidator,
  inspectStoredMedia,
  validateMedia,
} from "@/features/shoebox/server/media-validation";
import {
  AUDIO_FIXTURES,
  fixtureBytes,
  fixtureFile,
  PHOTO_FIXTURES,
} from "../../helpers/mock-media";

const HOSTILE_WORKER = fileURLToPath(
  new URL("../../helpers/hostile-media-worker.mjs", import.meta.url),
);
const HANG = 1;
const ALLOCATE = 2;
const ECHO_ENV = 3;

const hostileFile = (mode: number) =>
  new File([new Uint8Array([mode, 0, 0, 0])], "x", { type: "audio/webm" });

// Validation must never reach Notion (or anything else on the network).
let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch");
});
afterAll(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});

const webmNoDuration = fixtureFile(
  "audio-webm-opus-2s-no-duration.webm",
  "audio/webm;codecs=opus",
);
const hiddenVideoMp4 = fixtureFile("hidden-audio-video.mp4", "audio/mp4");

describe("core gate: packet-derived duration and hidden video", () => {
  it("accepts a recorder WebM with no Duration element", async () => {
    const media = await validateMedia(webmNoDuration, "audio");
    expect(media.durationSeconds).toBeGreaterThan(0);
    expect(media.durationSeconds).toBeLessThanOrEqual(60);
  });

  it("rejects an MP4 carrying a video track declared as audio/*", async () => {
    await expect(validateMedia(hiddenVideoMp4, "audio")).rejects.toMatchObject({
      code: "UNSUPPORTED_MEDIA",
    });
  });

  it("accepts fragmented MP4 without a declared duration", async () => {
    const media = await validateMedia(
      fixtureFile("audio-fmp4-aac-2s.m4a", "audio/mp4"),
      "audio",
    );
    expect(media.durationSeconds).toBeCloseTo(2.0213, 3);
  });
});

describe("audio fixtures (real worker, real parser)", () => {
  for (const fixture of AUDIO_FIXTURES) {
    const { expect: outcome } = fixture;
    it(`${fixture.name}: ${fixture.why}`, async () => {
      const file = fixtureFile(fixture.name, fixture.type);
      if (!outcome.ok) {
        await expect(validateMedia(file, "audio")).rejects.toMatchObject({
          code: outcome.code,
        });
        return;
      }
      const media = await validateMedia(file, "audio");
      expect(media.mimeType).toBe(outcome.mimeType);
      expect(media.filename).toBe(outcome.filename);
      expect(media.durationSeconds).toBeCloseTo(
        outcome.durationSeconds ?? Number.NaN,
        3,
      );
      expect(media.width).toBeUndefined();
      // Audio bytes are stored as uploaded, never transcoded.
      const original = new Uint8Array(await file.arrayBuffer());
      expect(Buffer.from(media.bytes).equals(original)).toBe(true);
    });
  }

  it("does not let corrupt or unknown bytes pass on MIME alone", async () => {
    const random = new Uint8Array(4096).map((_, i) => (i * 7919) % 251);
    const html = new TextEncoder().encode("<!doctype html><script>1</script>");
    for (const [bytes, type] of [
      [random, "audio/webm"],
      [random, "audio/mpeg"],
      [html, "audio/mp4"],
      [new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0]), "audio/mpeg"],
    ] as const) {
      await expect(
        validateMedia(new File([bytes], "x", { type }), "audio"),
      ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA" });
    }
  });

  it("rejects a declared MIME that contradicts the container", async () => {
    const bytes = fixtureBytes("audio-webm-opus-2s.webm");
    for (const type of ["audio/mpeg", "image/jpeg", "text/html"]) {
      await expect(
        validateMedia(new File([bytes], "x.webm", { type }), "audio"),
      ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA" });
    }
  });

  it("maps every accepted container to a filename Task 3 can read back", () => {
    // Mirrors AUDIO_TYPES in memory-service.ts (extension -> MIME).
    const readBack: Record<string, string> = {
      m4a: "audio/mp4",
      mp3: "audio/mpeg",
      weba: "audio/webm",
      ogg: "audio/ogg",
      wav: "audio/wav",
    };
    const rules = Object.values(MEDIA_RULES.audioContainers);
    expect(rules).toHaveLength(5);
    for (const rule of rules) {
      expect(readBack[rule.extension]).toBe(rule.mimeType);
    }
  });
});

describe("photo fixtures (real worker, real Sharp)", () => {
  for (const fixture of PHOTO_FIXTURES) {
    const { expect: outcome } = fixture;
    it(`${fixture.name}: ${fixture.why}`, async () => {
      const file = fixtureFile(fixture.name, fixture.type);
      if (!outcome.ok) {
        await expect(validateMedia(file, "photo")).rejects.toMatchObject({
          code: outcome.code,
        });
        return;
      }
      const media = await validateMedia(file, "photo");
      expect(media).toMatchObject({
        mimeType: outcome.mimeType,
        filename: outcome.filename,
        width: outcome.width,
        height: outcome.height,
      });
      expect(media.durationSeconds).toBeUndefined();
      expect(media.bytes.byteLength).toBeLessThanOrEqual(4_000_000);
      expect([...media.bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
      const meta = await sharp(media.bytes).metadata();
      expect(meta).toMatchObject({
        format: "jpeg",
        width: outcome.width,
        height: outcome.height,
        space: "srgb",
      });
      // Orientation is applied to pixels; EXIF/GPS/XMP/ICC are gone.
      expect(meta.orientation).toBeUndefined();
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(meta.icc).toBeUndefined();
      expect(Buffer.from(media.bytes).includes("Exif")).toBe(false);
    });
  }

  it("rejects active content and non-JPEG bytes declared as JPEG", async () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>',
    );
    const png = fixtureBytes("photo-transparent.png");
    for (const bytes of [svg, png]) {
      await expect(
        validateMedia(
          new File([bytes], "x.jpg", { type: "image/jpeg" }),
          "photo",
        ),
      ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA" });
    }
  });

  it("rejects a JPEG submitted as audio and audio submitted as a photo", async () => {
    await expect(
      validateMedia(fixtureFile("photo-edge-2048.jpg", "image/jpeg"), "audio"),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA" });
    await expect(validateMedia(webmNoDuration, "photo")).rejects.toMatchObject({
      code: "UNSUPPORTED_MEDIA",
    });
  });
});

describe("input bounds before any worker runs", () => {
  it("rejects empty, oversized and unknown-kind input without reading it", async () => {
    const validator = createMediaValidator();
    const big = new File([new Uint8Array(4_000_001)], "big.webm", {
      type: "audio/webm",
    });
    const read = vi.spyOn(big, "arrayBuffer");
    await expect(validator.validateMedia(big, "audio")).rejects.toMatchObject({
      code: "TOO_LARGE",
    });
    expect(read).not.toHaveBeenCalled();
    await expect(
      validator.validateMedia(new File([], "e.webm"), "audio"),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA" });
    await expect(
      validator.validateMedia(webmNoDuration, "video" as unknown as "audio"),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA" });
    expect(validator.activeWorkers()).toBe(0);
  });

  it("rejects an already aborted request without spawning a worker", async () => {
    const validator = createMediaValidator();
    const controller = new AbortController();
    controller.abort();
    await expect(
      validator.validateMedia(webmNoDuration, "audio", controller.signal),
    ).rejects.toMatchObject({ code: "UNAVAILABLE" });
    expect(validator.activeWorkers()).toBe(0);
  });
});

describe("inspectStoredMedia (downloads)", () => {
  it("re-inspects stored audio without returning or detaching bytes", async () => {
    const bytes = fixtureBytes("audio-webm-opus-2s-no-duration.webm");
    const before = bytes.byteLength;
    const info = await inspectStoredMedia(bytes, "audio");
    expect(info).toEqual({ mimeType: "audio/webm", durationSeconds: 2.0015 });
    expect(bytes.byteLength).toBe(before);
  });

  it("re-inspects a stored JPEG without re-encoding it", async () => {
    const saved = await validateMedia(
      fixtureFile("photo-exif-orientation-gps.jpg", "image/jpeg"),
      "photo",
    );
    const info = await inspectStoredMedia(saved.bytes, "photo");
    expect(info).toEqual({ mimeType: "image/jpeg", width: 32, height: 64 });
    expect(saved.bytes.byteLength).toBeGreaterThan(0);
  });

  it("rejects tampered stored media", async () => {
    await expect(
      inspectStoredMedia(fixtureBytes("hidden-audio-video.webm"), "audio"),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA" });
    await expect(
      inspectStoredMedia(fixtureBytes("photo-truncated.jpg"), "photo"),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA" });
    await expect(
      inspectStoredMedia(fixtureBytes("photo-edge-2049.jpg"), "photo"),
    ).rejects.toMatchObject({ code: "TOO_LARGE" });
  });
});

describe("worker boundary", () => {
  it("caps concurrency at two and answers overflow with 503", async () => {
    const validator = createMediaValidator({
      workerPath: HOSTILE_WORKER,
      deadlineMs: 2_000,
    });
    const one = new AbortController();
    const two = new AbortController();
    const first = validator.validateMedia(
      hostileFile(HANG),
      "audio",
      one.signal,
    );
    const second = validator.validateMedia(
      hostileFile(HANG),
      "audio",
      two.signal,
    );
    await expect(
      validator.validateMedia(hostileFile(HANG), "audio"),
    ).rejects.toMatchObject({ code: "UNAVAILABLE", status: 503 });

    one.abort();
    two.abort();
    const settled = await Promise.allSettled([first, second]);
    for (const result of settled) {
      expect(result).toMatchObject({
        status: "rejected",
        reason: { code: "UNAVAILABLE", detail: "media_aborted" },
      });
    }
    // Slots are released only once the worker threads have actually exited.
    expect(validator.activeWorkers()).toBe(0);
    await expect(
      validator.validateMedia(hostileFile(ECHO_ENV), "audio"),
    ).resolves.toMatchObject({ durationSeconds: 1 });
  });

  it("terminates a worker that misses the wall-clock deadline", async () => {
    const validator = createMediaValidator({
      workerPath: HOSTILE_WORKER,
      deadlineMs: 150,
    });
    const started = Date.now();
    await expect(
      validator.validateMedia(hostileFile(HANG), "audio"),
    ).rejects.toMatchObject({ code: "UNAVAILABLE", detail: "media_deadline" });
    expect(Date.now() - started).toBeLessThan(1_500);
    expect(validator.activeWorkers()).toBe(0);
  });

  it("stops a falsified huge allocation at the worker heap limit", async () => {
    const validator = createMediaValidator({ workerPath: HOSTILE_WORKER });
    await expect(
      validator.validateMedia(hostileFile(ALLOCATE), "audio"),
    ).rejects.toMatchObject({ code: "UNAVAILABLE", detail: "media_resources" });
    expect(validator.activeWorkers()).toBe(0);
  });

  it("releases the slot when the worker cannot start", async () => {
    const validator = createMediaValidator({
      workerPath: "relative/not-a-worker.mjs",
    });
    await expect(
      validator.validateMedia(hostileFile(ECHO_ENV), "audio"),
    ).rejects.toMatchObject({ code: "UNAVAILABLE", detail: "media_worker" });
    expect(validator.activeWorkers()).toBe(0);
  });

  it("gives the worker an empty environment (no secrets)", async () => {
    expect(process.env.SHOEBOX_SESSION_SECRET).toBeTruthy();
    const validator = createMediaValidator({ workerPath: HOSTILE_WORKER });
    const media = await validator.validateMedia(hostileFile(ECHO_ENV), "audio");
    expect(media.durationSeconds).toBe(1);
  });

  it("rejects the dimension bomb before decoding, well inside the deadline", async () => {
    const started = Date.now();
    await expect(
      validateMedia(
        fixtureFile("photo-dimension-bomb.jpg", "image/jpeg"),
        "photo",
      ),
    ).rejects.toMatchObject({ code: "TOO_LARGE" });
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});

describe("shared rules stay in step with limits.ts", () => {
  it("uses the same numbers in the browser-safe .mjs module", () => {
    expect(MEDIA_RULES).toMatchObject({
      maxFileBytes: limits.MAX_FILE_BYTES,
      maxAudioSeconds: limits.MAX_AUDIO_SECONDS,
      maxAudioPackets: limits.MAX_AUDIO_PACKETS,
      maxImageEdge: limits.MAX_IMAGE_EDGE,
      maxServerImagePixels: limits.MAX_SERVER_IMAGE_PIXELS,
      serverJpegQuality: limits.SERVER_JPEG_QUALITY,
    });
  });
});

describe("browser audio inspection (same parser, local Blob)", () => {
  it("measures a metadata-less recorder WebM from its packets", async () => {
    const blob = new Blob(
      [fixtureBytes("audio-webm-opus-2s-no-duration.webm")],
      {
        type: "audio/webm;codecs=opus",
      },
    );
    await expect(inspectAudioPreview(blob)).resolves.toEqual({
      durationSeconds: 2.0015,
      mimeType: "audio/webm",
    });
  });

  it("measures fragmented MP4 from its packets", async () => {
    const blob = new Blob([fixtureBytes("audio-fmp4-aac-2s.m4a")]);
    const preview = await inspectAudioPreview(blob);
    expect(preview.mimeType).toBe("audio/mp4");
    expect(preview.durationSeconds).toBeCloseTo(2.0213, 3);
  });

  it("refuses hidden video, over-long and empty clips with Spanish text", async () => {
    for (const [name, reason] of [
      ["hidden-audio-video.webm", "unsupported"],
      ["audio-webm-opus-61s-no-duration.webm", "too_long"],
      ["truncated-webm-live-block.webm", "unsupported"],
    ] as const) {
      await expect(
        inspectAudioPreview(new Blob([fixtureBytes(name)])),
      ).rejects.toMatchObject({ name: "AudioPreviewError", reason });
    }
    await expect(inspectAudioPreview(new Blob([]))).rejects.toMatchObject({
      reason: "empty",
      message: expect.stringMatching(/grabación|audio/),
    });
  });

  it("honours an aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      inspectAudioPreview(
        new Blob([fixtureBytes("audio-webm-opus-2s.webm")]),
        controller.signal,
      ),
    ).rejects.toMatchObject({ reason: "aborted" });
  });
});
