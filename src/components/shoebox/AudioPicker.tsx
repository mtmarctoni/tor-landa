"use client";

import { Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import VoiceRecorder, {
  type RecordedAudio,
} from "@/components/shoebox/VoiceRecorder";
import {
  AudioPreviewError,
  inspectAudioPreview,
} from "@/features/shoebox/client/audio-preview";
import { MAX_FILE_BYTES } from "@/features/shoebox/limits";

const AUDIO_ACCEPT =
  "audio/mp4,audio/x-m4a,audio/mpeg,audio/webm,audio/ogg,audio/wav,audio/x-wav,.m4a,.mp3,.weba,.webm,.ogg,.opus,.wav";
const AUDIO_TYPES =
  /^(audio\/(mp4|x-m4a|m4a|mpeg|mp3|webm|ogg|opus|wav|x-wav|wave)|video\/webm|application\/ogg)?$/;
const AUDIO_EXTENSIONS = /\.(m4a|mp4|mp3|weba|webm|ogg|opus|wav)$/i;

type UploadedAudio = { file: File; url: string; durationSeconds: number };

/**
 * An uploaded audio file checked locally (type, size, duration) before it
 * becomes part of the draft. One inspection at a time; the local URL is
 * revoked on replacement and when the composer closes.
 */
export function useAudioUpload() {
  const [upload, setUpload] = useState<UploadedAudio | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const uploadRef = useRef<UploadedAudio | null>(null);
  const job = useRef<{ id: number; abort: AbortController | null }>({
    id: 0,
    abort: null,
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      job.current.abort?.abort();
      if (uploadRef.current) URL.revokeObjectURL(uploadRef.current.url);
    };
  }, []);

  function replace(next: UploadedAudio | null) {
    if (uploadRef.current) URL.revokeObjectURL(uploadRef.current.url);
    uploadRef.current = next;
    setUpload(next);
  }

  async function choose(file: File) {
    job.current.abort?.abort();
    const abort = new AbortController();
    const id = job.current.id + 1;
    job.current = { id, abort };
    replace(null);
    setError("");
    if (
      !AUDIO_TYPES.test(file.type.toLowerCase()) &&
      !AUDIO_EXTENSIONS.test(file.name)
    ) {
      setError(
        "Ese archivo no es un audio que la caja acepte (M4A, MP3, WebM, Ogg o WAV).",
      );
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(new AudioPreviewError("too_large").message);
      return;
    }
    setBusy(true);
    try {
      const { durationSeconds } = await inspectAudioPreview(file, abort.signal);
      if (!mounted.current || job.current.id !== id) return;
      replace({ file, url: URL.createObjectURL(file), durationSeconds });
    } catch (failure) {
      if (!mounted.current || job.current.id !== id) return;
      setError(
        failure instanceof AudioPreviewError
          ? failure.message
          : new AudioPreviewError("unsupported").message,
      );
    } finally {
      if (mounted.current && job.current.id === id) setBusy(false);
    }
  }

  return { upload, busy, error, choose, remove: () => replace(null) };
}

export type AudioUpload = ReturnType<typeof useAudioUpload>;

/** The recording jar plus the upload alternative; never both at once. */
export default function AudioPicker({
  hidden,
  draft,
  locked,
  recorded,
  recording,
  suspended,
  onRecorded,
  onRecordingChange,
  onEdit,
}: {
  hidden: boolean;
  draft: AudioUpload;
  locked: boolean;
  recorded: RecordedAudio | null;
  recording: boolean;
  /** The session is not valid: stop any capture, keep what was recorded. */
  suspended: boolean;
  onRecorded(audio: RecordedAudio | null): void;
  onRecordingChange(active: boolean): void;
  onEdit(): void;
}) {
  const { upload } = draft;
  return (
    <div hidden={hidden} className="grid gap-3">
      <VoiceRecorder
        disabled={locked || upload !== null || draft.busy}
        suspended={suspended}
        onRecorded={(audio) => {
          if (audio || recorded) onEdit();
          onRecorded(audio);
        }}
        onActiveChange={onRecordingChange}
      />
      <div className="grid gap-2">
        <label htmlFor="composer-audio" className="text-sm font-semibold">
          <Upload aria-hidden="true" size={16} className="mr-1 inline" />
          Subir un audio
        </label>
        <input
          id="composer-audio"
          type="file"
          accept={AUDIO_ACCEPT}
          disabled={recorded !== null || recording}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file && !locked) {
              onEdit();
              void draft.choose(file);
            }
            event.target.value = "";
          }}
          className="text-sm"
        />
        <p className="text-xs text-[var(--journal-muted)]">
          M4A, MP3, WebM, Ogg o WAV; hasta 4 MB y 60 segundos.
        </p>
        {draft.busy && <p role="status">Comprobando el audio…</p>}
        {draft.error && (
          <p role="alert" className="text-sm text-[var(--color-danger-text)]">
            {draft.error}
          </p>
        )}
        {upload && (
          <>
            {/* biome-ignore lint/a11y/useMediaCaption: a local voice clip has no captions; the optional caption field describes it. */}
            <audio
              controls
              preload="metadata"
              src={upload.url}
              aria-label="Escuchar el audio elegido"
              className="w-full"
            />
            <p className="text-sm text-[var(--journal-muted)]">
              {upload.durationSeconds.toFixed(1).replace(".", ",")} segundos.
            </p>
            <button
              type="button"
              className="archive-button justify-self-start"
              onClick={() => {
                onEdit();
                draft.remove();
              }}
            >
              Quitar el audio
            </button>
          </>
        )}
      </div>
    </div>
  );
}
