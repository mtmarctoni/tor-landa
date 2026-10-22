import { MAX_FILE_BYTES } from "@/features/shoebox/limits";

/**
 * Final local check of a recorded or chosen audio Blob before saving. Uses
 * the same packet inspection as the server (Mediabunny, loaded on demand), so
 * a recorder WebM whose `audio.duration` is Infinity still gets a finite,
 * packet-derived duration. Native <audio> is still used for listening.
 */

export type AudioPreviewReason =
  | "empty"
  | "too_large"
  | "too_long"
  | "unsupported"
  | "aborted";

const MESSAGES: Record<AudioPreviewReason, string> = {
  empty: "La grabación está vacía. Prueba a grabar otra vez.",
  too_large: "Este audio pesa demasiado. El límite es de 4 MB.",
  too_long: "Este audio dura más de 60 segundos. Prueba con uno más corto.",
  unsupported:
    "Este audio no se puede usar aquí. Prueba con otra grabación o archivo.",
  aborted: "Se canceló la comprobación del audio.",
};

export class AudioPreviewError extends Error {
  readonly reason: AudioPreviewReason;

  constructor(reason: AudioPreviewReason) {
    super(MESSAGES[reason]);
    this.name = "AudioPreviewError";
    this.reason = reason;
  }
}

export async function inspectAudioPreview(
  blob: Blob,
  signal?: AbortSignal,
): Promise<{ durationSeconds: number; mimeType: string }> {
  if (signal?.aborted) throw new AudioPreviewError("aborted");
  if (blob.size === 0) throw new AudioPreviewError("empty");
  if (blob.size > MAX_FILE_BYTES) throw new AudioPreviewError("too_large");

  const [mediabunny, inspection, buffer] = await Promise.all([
    import("mediabunny"),
    import("@/features/shoebox/media-inspection.mjs"),
    blob.arrayBuffer(),
  ]);
  if (signal?.aborted) throw new AudioPreviewError("aborted");
  try {
    const result = await inspection.inspectAudio(
      mediabunny,
      new Uint8Array(buffer),
      { signal },
    );
    if (signal?.aborted) throw new AudioPreviewError("aborted");
    return {
      durationSeconds: result.durationSeconds,
      mimeType: result.mimeType,
    };
  } catch (error) {
    if (error instanceof AudioPreviewError) throw error;
    if (signal?.aborted) throw new AudioPreviewError("aborted");
    if (error instanceof inspection.MediaRejection) {
      if (error.code === "INVALID_INPUT") {
        throw new AudioPreviewError("too_long");
      }
      if (error.code === "TOO_LARGE") {
        throw new AudioPreviewError("too_large");
      }
    }
    throw new AudioPreviewError("unsupported");
  }
}
