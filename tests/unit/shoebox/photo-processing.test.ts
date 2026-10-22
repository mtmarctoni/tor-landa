import { describe, expect, it, vi } from "vitest";
import {
  PHOTO_DECODE_ERROR,
  type PhotoEnvironment,
  preparePhoto,
} from "@/features/shoebox/client/photo-processing";
import { fixtureBytes } from "../../helpers/mock-media";

/**
 * Algorithm tests with mocked canvas/bitmap/image APIs. They prove sizing,
 * quality fallback and cleanup only; real browser decoding, EXIF orientation
 * and HEIC behaviour are verified in Task 8 on real engines/devices.
 */

type Size = { width: number; height: number };

function makeEnv(options: {
  bitmap?: Size | "throw" | "absent";
  image?: Size | "throw";
  /** Sizes returned by successive toBlob calls; default 1,000 bytes. */
  blobSizes?: number[];
  blobType?: string;
}) {
  const calls: string[] = [];
  const urls = new Set<string>();
  let urlCount = 0;
  const bitmaps: { close: ReturnType<typeof vi.fn> }[] = [];
  const qualities: number[] = [];
  const canvasSizes: Size[] = [];
  const blobSizes = [...(options.blobSizes ?? [])];

  const ctx = {
    fillStyle: "",
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
    fillRect: vi.fn((..._args: number[]) =>
      calls.push(`fill:${ctx.fillStyle}`),
    ),
    drawImage: vi.fn((_src: unknown, ...rect: number[]) =>
      calls.push(`draw:${rect.join(",")}`),
    ),
  };
  const canvas = {
    width: 300,
    height: 150,
    getContext: vi.fn(() => ctx),
    toBlob: vi.fn(
      (cb: (blob: Blob | null) => void, type: string, quality: number) => {
        qualities.push(quality);
        canvasSizes.push({ width: canvas.width, height: canvas.height });
        const size = blobSizes.shift() ?? 1_000;
        cb(
          new Blob([new Uint8Array(size)], {
            type: options.blobType ?? type,
          }),
        );
      },
    ),
  };

  const env: PhotoEnvironment = {
    createImageBitmap:
      options.bitmap === "absent"
        ? undefined
        : vi.fn(async (_blob: Blob, opts?: ImageBitmapOptions) => {
            calls.push(`bitmap:${opts?.imageOrientation}`);
            const size = options.bitmap;
            if (size === undefined || typeof size === "string") {
              throw new DOMException("bad", "InvalidStateError");
            }
            const bitmap = { ...size, close: vi.fn() };
            bitmaps.push(bitmap);
            return bitmap;
          }),
    loadImage: vi.fn(async (url: string) => {
      calls.push(`image:${urls.has(url)}`);
      if (options.image === undefined || options.image === "throw") {
        throw new Error("decode failed");
      }
      return {
        naturalWidth: options.image.width,
        naturalHeight: options.image.height,
      };
    }),
    createCanvas: vi.fn(() => canvas),
    createObjectURL: vi.fn(() => {
      const url = `blob:test/${++urlCount}`;
      urls.add(url);
      return url;
    }),
    revokeObjectURL: vi.fn((url: string) => {
      urls.delete(url);
    }),
  };
  return { env, calls, urls, bitmaps, qualities, canvas, canvasSizes, ctx };
}

const jpegFile = (bytes = 1_000) =>
  new File([new Uint8Array(bytes)], "IMG_0001.HEIC", { type: "image/heic" });

describe("preparePhoto", () => {
  it("downsamples to a 2,048 long edge, flattening onto cream first", async () => {
    const t = makeEnv({ bitmap: { width: 4000, height: 3000 } });
    const result = await preparePhoto(jpegFile(), undefined, t.env);

    expect(result.width).toBe(2048);
    expect(result.height).toBe(1536);
    expect(result.file.type).toBe("image/jpeg");
    expect(result.file.name).toBe("memory.jpg");
    expect(t.calls[0]).toBe("bitmap:from-image");
    const fill = t.calls.findIndex((c) => c.startsWith("fill:"));
    const draw = t.calls.findIndex((c) => c.startsWith("draw:"));
    expect(fill).toBeGreaterThanOrEqual(0);
    expect(fill).toBeLessThan(draw);
    expect(t.calls[fill]).toMatch(/^fill:#f/i);
    expect(t.calls[draw]).toBe("draw:0,0,2048,1536");
    expect(t.qualities).toEqual([0.9]);

    // Bitmap closed and canvas released; only the preview URL stays alive.
    expect(t.bitmaps[0]?.close).toHaveBeenCalledOnce();
    expect(t.canvas.width).toBe(0);
    expect(t.canvas.height).toBe(0);
    expect([...t.urls]).toEqual([result.previewUrl]);
    result.dispose();
    result.dispose();
    expect(t.urls.size).toBe(0);
    expect(t.env.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("never upscales a small photo", async () => {
    const t = makeEnv({ bitmap: { width: 800, height: 600 } });
    const result = await preparePhoto(jpegFile(), undefined, t.env);
    expect([result.width, result.height]).toEqual([800, 600]);
    result.dispose();
  });

  it("tries qualities 0.9, 0.8, 0.7, then a 1,600 edge at 0.75", async () => {
    const t = makeEnv({
      bitmap: { width: 4096, height: 3072 },
      blobSizes: [5_000_000, 4_500_000, 4_000_001, 3_000_000],
    });
    const result = await preparePhoto(jpegFile(), undefined, t.env);
    expect(t.qualities).toEqual([0.9, 0.8, 0.7, 0.75]);
    expect(t.canvasSizes.at(-1)).toEqual({ width: 1600, height: 1200 });
    expect([result.width, result.height]).toEqual([1600, 1200]);
    expect(result.file.size).toBe(3_000_000);
    result.dispose();
  });

  it("fails after the last bounded attempt and releases everything", async () => {
    const t = makeEnv({
      bitmap: { width: 4096, height: 3072 },
      blobSizes: [9e6, 9e6, 9e6, 4_000_001, 1],
    });
    await expect(
      preparePhoto(jpegFile(), undefined, t.env),
    ).rejects.toMatchObject({
      name: "PhotoProcessingError",
      reason: "too_large_output",
    });
    expect(t.qualities).toHaveLength(4);
    expect(t.bitmaps[0]?.close).toHaveBeenCalledOnce();
    expect(t.canvas.width).toBe(0);
    expect(t.urls.size).toBe(0);
  });

  it("rejects a source over 20,000,000 bytes before decoding", async () => {
    const t = makeEnv({ bitmap: { width: 10, height: 10 } });
    await expect(
      preparePhoto(jpegFile(20_000_001), undefined, t.env),
    ).rejects.toMatchObject({ reason: "too_large" });
    expect(t.env.createImageBitmap).not.toHaveBeenCalled();
    expect(t.env.loadImage).not.toHaveBeenCalled();
  });

  it("rejects a header declaring over 40 megapixels before decoding", async () => {
    const t = makeEnv({ bitmap: { width: 10, height: 10 } });
    const bomb = new File([fixtureBytes("photo-dimension-bomb.jpg")], "b.jpg", {
      type: "image/jpeg",
    });
    await expect(preparePhoto(bomb, undefined, t.env)).rejects.toMatchObject({
      reason: "too_many_pixels",
    });
    expect(t.env.createImageBitmap).not.toHaveBeenCalled();
  });

  it("rejects over 40 megapixels after decode and closes the bitmap", async () => {
    const t = makeEnv({ bitmap: { width: 8000, height: 6000 } });
    await expect(
      preparePhoto(jpegFile(), undefined, t.env),
    ).rejects.toMatchObject({ reason: "too_many_pixels" });
    expect(t.bitmaps[0]?.close).toHaveBeenCalledOnce();
    expect(t.canvas.toBlob).not.toHaveBeenCalled();
  });

  it("falls back to an image element and revokes its source URL", async () => {
    const t = makeEnv({
      bitmap: "throw",
      image: { width: 3000, height: 4000 },
    });
    const result = await preparePhoto(jpegFile(), undefined, t.env);
    expect(t.calls).toContain("image:true");
    expect([result.width, result.height]).toEqual([1536, 2048]);
    expect([...t.urls]).toEqual([result.previewUrl]);
    result.dispose();
  });

  it("uses the image element where createImageBitmap is missing", async () => {
    const t = makeEnv({ bitmap: "absent", image: { width: 100, height: 50 } });
    const result = await preparePhoto(jpegFile(), undefined, t.env);
    expect([result.width, result.height]).toEqual([100, 50]);
    result.dispose();
  });

  it("explains an undecodable photo in Spanish and cleans up", async () => {
    const t = makeEnv({ bitmap: "throw", image: "throw" });
    const failure = preparePhoto(jpegFile(), undefined, t.env);
    await expect(failure).rejects.toMatchObject({
      reason: "decode",
      message: PHOTO_DECODE_ERROR,
    });
    expect(PHOTO_DECODE_ERROR).toBe(
      "Esta foto no se puede abrir aquí. Prueba exportarla como JPEG o usar una captura.",
    );
    expect(t.urls.size).toBe(0);
  });

  it("refuses to save a non-JPEG canvas encoding", async () => {
    const t = makeEnv({
      bitmap: { width: 10, height: 10 },
      blobType: "image/png",
    });
    await expect(
      preparePhoto(jpegFile(), undefined, t.env),
    ).rejects.toMatchObject({ reason: "encode" });
    expect(t.urls.size).toBe(0);
    expect(t.canvas.width).toBe(0);
  });

  it("stops on abort and leaves no URLs or bitmaps behind", async () => {
    const t = makeEnv({ bitmap: { width: 4000, height: 3000 } });
    const controller = new AbortController();
    const createImageBitmap = t.env.createImageBitmap;
    t.env.createImageBitmap = async (blob, opts) => {
      const bitmap = await createImageBitmap?.(blob, opts);
      controller.abort();
      if (!bitmap) throw new Error("unreachable");
      return bitmap;
    };
    await expect(
      preparePhoto(jpegFile(), controller.signal, t.env),
    ).rejects.toMatchObject({ reason: "aborted" });
    expect(t.bitmaps[0]?.close).toHaveBeenCalledOnce();
    expect(t.urls.size).toBe(0);
    expect(t.canvas.toBlob).not.toHaveBeenCalled();
  });
});
