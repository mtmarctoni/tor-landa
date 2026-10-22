import {
  MAX_FILE_BYTES,
  MAX_IMAGE_EDGE,
  MAX_PHOTO_SOURCE_BYTES,
  MAX_PHOTO_SOURCE_PIXELS,
  PHOTO_FALLBACK_EDGE,
  PHOTO_FALLBACK_QUALITY,
  PHOTO_JPEG_QUALITIES,
} from "@/features/shoebox/limits";

/**
 * Local photo preparation for the composer: decode with orientation-aware
 * browser APIs, flatten onto cream, downsample to a 2,048 long edge and
 * compress to JPEG under 4,000,000 bytes with a bounded set of attempts.
 *
 * This is for UX and bandwidth only. The server re-validates and re-encodes
 * (at equivalent dimensions), so the saved bytes and metadata are normalized,
 * not promised byte-identical to the local preview. Browser decoding support
 * (HEIC, orientation) varies; real-engine checks happen with the composer.
 */

export const PHOTO_DECODE_ERROR =
  "Esta foto no se puede abrir aquí. Prueba exportarla como JPEG o usar una captura.";

export type PhotoProcessingReason =
  | "too_large"
  | "too_many_pixels"
  | "decode"
  | "encode"
  | "too_large_output"
  | "aborted";

const MESSAGES: Record<PhotoProcessingReason, string> = {
  too_large:
    "Esta foto pesa demasiado (más de 20 MB). Prueba con una captura o una versión más pequeña.",
  too_many_pixels:
    "Esta foto es demasiado grande para prepararla aquí. Prueba con una captura o una versión más pequeña.",
  decode: PHOTO_DECODE_ERROR,
  encode: "No pudimos preparar esta foto. Prueba con otra o usa una captura.",
  too_large_output:
    "No pudimos reducir esta foto lo suficiente. Prueba con otra o usa una captura.",
  aborted: "Se canceló la preparación de la foto.",
};

export class PhotoProcessingError extends Error {
  readonly reason: PhotoProcessingReason;

  constructor(reason: PhotoProcessingReason) {
    super(MESSAGES[reason]);
    this.name = "PhotoProcessingError";
    this.reason = reason;
  }
}

type PhotoBitmap = { width: number; height: number; close(): void };
type PhotoImage = { naturalWidth: number; naturalHeight: number };
type PhotoContext = {
  fillStyle: string | CanvasGradient | CanvasPattern;
  imageSmoothingEnabled?: boolean;
  imageSmoothingQuality?: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  drawImage(
    image: CanvasImageSource,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
};
type PhotoCanvas = {
  width: number;
  height: number;
  getContext(type: "2d"): PhotoContext | null;
  toBlob(
    callback: (blob: Blob | null) => void,
    type: string,
    quality: number,
  ): void;
};

/** Browser APIs used here; injectable so the algorithm is unit-testable. */
export type PhotoEnvironment = {
  createImageBitmap?: (
    source: Blob,
    options?: ImageBitmapOptions,
  ) => Promise<PhotoBitmap>;
  loadImage: (url: string) => Promise<PhotoImage>;
  createCanvas: () => PhotoCanvas;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
};

export type PreparedPhoto = {
  file: File;
  width: number;
  height: number;
  previewUrl: string;
  dispose(): void;
};

/** Flattening colour for transparent sources (the scrapbook's paper). */
const CREAM = "#fff8ec";
const HEADER_BYTES = 262_144;

function browserPhotoEnvironment(): PhotoEnvironment {
  return {
    createImageBitmap:
      typeof globalThis.createImageBitmap === "function"
        ? (source, options) => globalThis.createImageBitmap(source, options)
        : undefined,
    loadImage: (url) => {
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      return image.decode().then(() => image);
    },
    createCanvas: () => document.createElement("canvas"),
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
  };
}

/**
 * Reads pixel dimensions from a JPEG SOF or PNG IHDR header without decoding,
 * so obviously huge sources are refused before any allocation. Returns null
 * for other formats (they are measured after decode instead).
 */
function readHeaderSize(
  b: Uint8Array,
): { width: number; height: number } | null {
  const u16 = (at: number) => ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0);
  const u32 = (at: number) => u16(at) * 65_536 + u16(at + 2);
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return b.length >= 24 ? { width: u32(16), height: u32(20) } : null;
  }
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let at = 2;
  while (at + 9 < b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1] ?? 0;
    if (marker === 0xff) {
      at += 1; // fill byte
      continue;
    }
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      at += 2;
      continue;
    }
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isSof) return { height: u16(at + 5), width: u16(at + 7) };
    if (marker === 0xd9 || marker === 0xda) return null;
    at += 2 + u16(at + 2);
  }
  return null;
}

export async function preparePhoto(
  file: File,
  signal?: AbortSignal,
  env: PhotoEnvironment = browserPhotoEnvironment(),
): Promise<PreparedPhoto> {
  const checkAbort = () => {
    if (signal?.aborted) throw new PhotoProcessingError("aborted");
  };
  checkAbort();
  if (file.size > MAX_PHOTO_SOURCE_BYTES) {
    throw new PhotoProcessingError("too_large");
  }
  if (file.size === 0) throw new PhotoProcessingError("decode");

  const header = readHeaderSize(
    new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer()),
  );
  if (header && header.width * header.height > MAX_PHOTO_SOURCE_PIXELS) {
    throw new PhotoProcessingError("too_many_pixels");
  }
  checkAbort();

  let bitmap: PhotoBitmap | null = null;
  let sourceUrl: string | null = null;
  let canvas: PhotoCanvas | null = null;
  try {
    // 1. Decode, orientation-aware where supported, else an <img> element
    //    (which applies EXIF orientation by default in current engines).
    let source: { image: object; width: number; height: number } | null = null;
    if (env.createImageBitmap) {
      try {
        bitmap = await env.createImageBitmap(file, {
          imageOrientation: "from-image",
        });
        source = { image: bitmap, width: bitmap.width, height: bitmap.height };
      } catch {
        bitmap = null;
      }
    }
    checkAbort();
    if (!source) {
      sourceUrl = env.createObjectURL(file);
      try {
        const image = await env.loadImage(sourceUrl);
        source = {
          image,
          width: image.naturalWidth,
          height: image.naturalHeight,
        };
      } catch {
        throw new PhotoProcessingError("decode");
      }
      checkAbort();
    }
    const { width, height } = source;
    if (!(width > 0 && height > 0)) throw new PhotoProcessingError("decode");
    if (width * height > MAX_PHOTO_SOURCE_PIXELS) {
      throw new PhotoProcessingError("too_many_pixels");
    }

    // 2. Bounded attempts: 2,048 edge at 0.9/0.8/0.7, then 1,600 at 0.75.
    //    Never upscale.
    const longEdge = Math.max(width, height);
    const attempts = [
      ...PHOTO_JPEG_QUALITIES.map((quality) => ({
        edge: Math.min(longEdge, MAX_IMAGE_EDGE),
        quality,
      })),
      {
        edge: Math.min(longEdge, PHOTO_FALLBACK_EDGE),
        quality: PHOTO_FALLBACK_QUALITY,
      },
    ];
    const target = env.createCanvas();
    canvas = target;
    let drawnEdge = 0;
    let output: { blob: Blob; width: number; height: number } | null = null;
    for (const { edge, quality } of attempts) {
      if (edge !== drawnEdge) {
        const scale = edge / longEdge;
        target.width = Math.max(1, Math.round(width * scale));
        target.height = Math.max(1, Math.round(height * scale));
        // Resizing resets context state, so configure it afterwards.
        const ctx = target.getContext("2d");
        if (!ctx) throw new PhotoProcessingError("encode");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.fillStyle = CREAM;
        ctx.fillRect(0, 0, target.width, target.height);
        ctx.drawImage(
          source.image as CanvasImageSource,
          0,
          0,
          target.width,
          target.height,
        );
        drawnEdge = edge;
      }
      const blob = await new Promise<Blob | null>((resolve) =>
        target.toBlob(resolve, "image/jpeg", quality),
      );
      checkAbort();
      if (blob?.type !== "image/jpeg") {
        throw new PhotoProcessingError("encode");
      }
      if (blob.size <= MAX_FILE_BYTES) {
        output = { blob, width: target.width, height: target.height };
        break;
      }
    }
    if (!output) throw new PhotoProcessingError("too_large_output");

    const prepared = new File([output.blob], "memory.jpg", {
      type: "image/jpeg",
    });
    const previewUrl = env.createObjectURL(prepared);
    let disposed = false;
    return {
      file: prepared,
      width: output.width,
      height: output.height,
      previewUrl,
      dispose() {
        if (disposed) return;
        disposed = true;
        env.revokeObjectURL(previewUrl);
      },
    };
  } finally {
    bitmap?.close();
    if (sourceUrl) env.revokeObjectURL(sourceUrl);
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
