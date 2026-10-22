// Short-lived media validation worker. media-validation.ts starts one per
// file from this fixed path, sends a single message { kind, mode, bytes } and
// terminates the thread afterwards (or on deadline/abort). It reads no files,
// URLs or environment variables, and makes no network requests: its only input
// is the transferred byte buffer.
import { parentPort } from "node:worker_threads";
import * as mediabunny from "mediabunny";
import sharp from "sharp";
import {
  inspectAudio,
  MEDIA_RULES,
  MediaRejection,
} from "../media-inspection.mjs";

// One libvips thread and no operation cache: this worker handles one file.
sharp.concurrency(1);
sharp.cache(false);
// Parser warnings about rejected codecs are expected input, not server logs.
mediabunny.Logging.level = mediabunny.LogLevel.Silent;

const SHARP_TIMEOUT_SECONDS = 5;

/** @param {Uint8Array} b */
const isJpeg = (b) =>
  b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/**
 * @param {Uint8Array} bytes
 * @param {"validate" | "inspect"} mode
 */
async function checkPhoto(bytes, mode) {
  if (!isJpeg(bytes))
    throw new MediaRejection("UNSUPPORTED_MEDIA", "jpeg_signature");
  const options = {
    failOn: /** @type {const} */ ("warning"),
    limitInputPixels: MEDIA_RULES.maxServerImagePixels,
    autoOrient: true,
    sequentialRead: true,
  };
  // Header only: dimensions are checked before any pixel is decoded.
  let meta;
  try {
    meta = await sharp(bytes, {
      ...options,
      limitInputPixels: false,
    }).metadata();
  } catch {
    throw new MediaRejection("UNSUPPORTED_MEDIA", "jpeg_header");
  }
  if (meta.format !== "jpeg")
    throw new MediaRejection("UNSUPPORTED_MEDIA", "jpeg_format");
  const width = meta.autoOrient?.width ?? meta.width;
  const height = meta.autoOrient?.height ?? meta.height;
  if (!width || !height)
    throw new MediaRejection("UNSUPPORTED_MEDIA", "jpeg_size");
  if (
    Math.max(width, height) > MEDIA_RULES.maxImageEdge ||
    width * height > MEDIA_RULES.maxServerImagePixels
  ) {
    // Oversized input is refused, never resized on the server.
    throw new MediaRejection("TOO_LARGE", "jpeg_dimensions");
  }

  const image = sharp(bytes, options).timeout({
    seconds: SHARP_TIMEOUT_SECONDS,
  });
  try {
    if (mode === "inspect") {
      // Full decode to prove the stored bytes are intact; nothing re-encoded.
      const { info } = await image.raw().toBuffer({ resolveWithObject: true });
      return { width: info.width, height: info.height };
    }
    // Default output strips EXIF/GPS/XMP/ICC and converts to sRGB.
    const { data, info } = await image
      .toColourspace("srgb")
      .jpeg({ quality: MEDIA_RULES.serverJpegQuality })
      .toBuffer({ resolveWithObject: true });
    if (data.byteLength > MEDIA_RULES.maxFileBytes) {
      throw new MediaRejection("TOO_LARGE", "jpeg_output");
    }
    const out = new Uint8Array(data.byteLength);
    out.set(data);
    return { width: info.width, height: info.height, bytes: out };
  } catch (error) {
    if (error instanceof MediaRejection) throw error;
    throw new MediaRejection("UNSUPPORTED_MEDIA", "jpeg_decode");
  }
}

parentPort?.once("message", async (message) => {
  const { kind, mode, bytes } = message ?? {};
  try {
    if (
      !(bytes instanceof Uint8Array) ||
      bytes.byteLength === 0 ||
      bytes.byteLength > MEDIA_RULES.maxFileBytes ||
      (mode !== "validate" && mode !== "inspect")
    ) {
      throw new MediaRejection("UNSUPPORTED_MEDIA", "message");
    }
    if (kind === "photo") {
      const photo = await checkPhoto(bytes, mode);
      const transfer = photo.bytes ? [photo.bytes.buffer] : [];
      parentPort?.postMessage({ ok: true, kind, ...photo }, transfer);
      return;
    }
    if (kind === "audio") {
      const audio = await inspectAudio(mediabunny, bytes);
      parentPort?.postMessage({
        ok: true,
        kind,
        container: audio.container,
        durationSeconds: audio.durationSeconds,
      });
      return;
    }
    throw new MediaRejection("UNSUPPORTED_MEDIA", "kind");
  } catch (error) {
    const rejection =
      error instanceof MediaRejection
        ? error
        : new MediaRejection("UNSUPPORTED_MEDIA", "worker");
    parentPort?.postMessage({
      ok: false,
      code: rejection.code,
      reason: rejection.reason,
    });
  }
});
