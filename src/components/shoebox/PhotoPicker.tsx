"use client";

import { ImagePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  PHOTO_DECODE_ERROR,
  PhotoProcessingError,
  type PreparedPhoto,
  preparePhoto,
} from "@/features/shoebox/client/photo-processing";

const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

function megabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1).replace(".", ",")} MB`;
}

/**
 * The composer's local photo draft: one preparation job at a time (a newer
 * choice supersedes the older one), and the preview URL is released whenever
 * the photo is replaced or the composer closes.
 */
export function usePhotoDraft() {
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const photoRef = useRef<PreparedPhoto | null>(null);
  const job = useRef<{ id: number; abort: AbortController | null }>({
    id: 0,
    abort: null,
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      job.current.abort?.abort();
      photoRef.current?.dispose();
    };
  }, []);

  function replace(next: PreparedPhoto | null) {
    photoRef.current?.dispose();
    photoRef.current = next;
    setPhoto(next);
  }

  async function choose(file: File) {
    job.current.abort?.abort();
    const abort = new AbortController();
    const id = job.current.id + 1;
    job.current = { id, abort };
    replace(null);
    setError("");
    setBusy(true);
    try {
      const prepared = await preparePhoto(file, abort.signal);
      if (!mounted.current || job.current.id !== id) {
        prepared.dispose();
        return;
      }
      replace(prepared);
    } catch (failure) {
      if (!mounted.current || job.current.id !== id) return;
      setError(
        failure instanceof PhotoProcessingError
          ? failure.message
          : PHOTO_DECODE_ERROR,
      );
    } finally {
      if (mounted.current && job.current.id === id) setBusy(false);
    }
  }

  return { photo, busy, error, choose, remove: () => replace(null) };
}

export type PhotoDraft = ReturnType<typeof usePhotoDraft>;

/** File choice (no drag and drop needed), progress, error and preview. */
export default function PhotoPicker({
  draft,
  locked,
  onEdit,
}: {
  draft: PhotoDraft;
  locked: boolean;
  onEdit(): void;
}) {
  const { photo } = draft;
  return (
    <div className="grid gap-2">
      <label
        htmlFor="composer-photo"
        className="archive-button cursor-pointer justify-self-start"
      >
        <ImagePlus aria-hidden="true" size={18} />
        Elegir una foto
      </label>
      <input
        id="composer-photo"
        type="file"
        accept={PHOTO_ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && !locked) {
            onEdit();
            void draft.choose(file);
          }
          event.target.value = "";
        }}
      />
      {draft.busy && <p role="status">Preparando la foto…</p>}
      {draft.error && (
        <p role="alert" className="text-sm text-[var(--color-danger-text)]">
          {draft.error}
        </p>
      )}
      {photo && (
        <figure className="grid gap-2">
          {/* biome-ignore lint/performance/noImgElement: a local blob preview, never the image optimizer. */}
          <img
            src={photo.previewUrl}
            alt="Vista previa de la foto"
            className="max-h-72 w-auto justify-self-start rounded-2xl border border-[var(--journal-rule)] object-contain"
          />
          <figcaption className="text-sm text-[var(--journal-muted)]">
            {photo.width} × {photo.height} · {megabytes(photo.file.size)}
          </figcaption>
          <button
            type="button"
            className="archive-button justify-self-start"
            onClick={() => {
              onEdit();
              draft.remove();
            }}
          >
            Quitar la foto
          </button>
        </figure>
      )}
    </div>
  );
}
