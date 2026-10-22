"use client";

import { Mic, RotateCcw, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useVoiceRecorder } from "@/features/shoebox/client/useVoiceRecorder";
import { MAX_AUDIO_SECONDS } from "@/features/shoebox/limits";

export type RecordedAudio = {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
};

function clock(ms: number): string {
  const seconds = Math.min(MAX_AUDIO_SECONDS, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Recording jar: explicit tap to start, stable timer and stop button, local
 * preview, discard and confirmed re-record. It never saves or uploads; the
 * composer decides what to do with the clip.
 */
export default function VoiceRecorder({
  disabled,
  suspended = false,
  onRecorded,
  onActiveChange,
}: {
  disabled: boolean;
  /** Session ended or the page is hidden: stop capturing, keep the clip. */
  suspended?: boolean;
  onRecorded: (audio: RecordedAudio | null) => void;
  onActiveChange: (active: boolean) => void;
}) {
  const recorder = useVoiceRecorder({ onActiveChange });
  const { snapshot } = recorder;
  const [confirmReplace, setConfirmReplace] = useState(false);
  const stopRef = useRef<HTMLButtonElement>(null);
  const reported = useRef<unknown>(null);

  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  });

  useEffect(() => {
    const blob = snapshot.state === "preview" ? snapshot.blob : null;
    if (reported.current === blob) return;
    reported.current = blob;
    onRecordedRef.current(
      snapshot.state === "preview"
        ? {
            blob: snapshot.blob,
            mimeType: snapshot.actualMime,
            durationSeconds: snapshot.durationSeconds,
          }
        : null,
    );
  }, [snapshot]);

  useEffect(() => {
    if (snapshot.state === "recording") stopRef.current?.focus();
  }, [snapshot.state]);

  const stopNow = useRef(recorder.stop);
  useEffect(() => {
    stopNow.current = recorder.stop;
  });
  const capturing =
    snapshot.state === "requesting" || snapshot.state === "recording";
  useEffect(() => {
    if (suspended && capturing) void stopNow.current();
  }, [suspended, capturing]);

  const start = () => {
    setConfirmReplace(false);
    void recorder.start();
  };

  return (
    <div className="grid gap-3 rounded-3xl border border-[var(--journal-rule)] bg-[var(--dream-cloud)] p-4">
      {(snapshot.state === "idle" || snapshot.state === "error") && (
        <>
          <button
            type="button"
            className="archive-button justify-self-start"
            onClick={start}
            disabled={disabled || suspended || !recorder.ready}
          >
            <Mic aria-hidden="true" size={18} />
            Grabar
          </button>
          <p className="text-sm text-[var(--journal-muted)]">
            Hasta 60 segundos. El micrófono solo se enciende al pulsar.
          </p>
        </>
      )}

      {snapshot.state === "requesting" && (
        <>
          <p role="status">Pidiendo permiso para el micrófono…</p>
          <button
            type="button"
            className="archive-button justify-self-start"
            onClick={() => void recorder.stop()}
          >
            Cancelar
          </button>
        </>
      )}

      {(snapshot.state === "recording" || snapshot.state === "stopping") && (
        <div className="flex flex-wrap items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-full bg-[#d64545] motion-safe:animate-pulse"
          />
          <p role="status" className="font-semibold">
            {snapshot.state === "recording"
              ? "Grabando"
              : "Cerrando el frasco…"}
          </p>
          <span role="timer" aria-live="off" className="font-mono tabular-nums">
            {clock(snapshot.elapsedMs)} / 1:00
          </span>
          <button
            ref={stopRef}
            type="button"
            className="archive-button"
            onClick={() => void recorder.stop()}
            disabled={snapshot.state === "stopping"}
          >
            <Square aria-hidden="true" size={16} />
            Parar
          </button>
        </div>
      )}

      {snapshot.state === "preview" && (
        <>
          {/* biome-ignore lint/a11y/useMediaCaption: a local voice clip has no captions; the optional caption field describes it. */}
          <audio
            controls
            preload="metadata"
            src={snapshot.url}
            aria-label="Escuchar la grabación"
            className="w-full"
          />
          <p className="text-sm text-[var(--journal-muted)]">
            {snapshot.durationSeconds.toFixed(1).replace(".", ",")} segundos.
            {snapshot.interrupted
              ? " La grabación se interrumpió (la pantalla se apagó o cambiaste de app); escúchala antes de guardarla."
              : snapshot.stopReason === "limit"
                ? " Paramos al llegar al límite."
                : ""}
          </p>
          {confirmReplace ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="w-full font-semibold">¿Sustituir esta grabación?</p>
              <button
                type="button"
                className="archive-button"
                onClick={() => {
                  recorder.discard();
                  start();
                }}
                disabled={disabled}
              >
                Sí, grabar otra
              </button>
              <button
                type="button"
                className="archive-button"
                onClick={() => setConfirmReplace(false)}
              >
                No, quedármela
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="archive-button"
                onClick={() => setConfirmReplace(true)}
                disabled={disabled}
              >
                <RotateCcw aria-hidden="true" size={16} />
                Grabar otra vez
              </button>
              <button
                type="button"
                className="archive-button"
                onClick={() => recorder.discard()}
                disabled={disabled}
              >
                <Trash2 aria-hidden="true" size={16} />
                Descartar la grabación
              </button>
            </div>
          )}
        </>
      )}

      {snapshot.state === "error" && (
        <p role="alert" className="text-sm text-[var(--color-danger-text)]">
          {snapshot.error.message}
        </p>
      )}
    </div>
  );
}
