"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { scrapLook, spanishDate } from "@/components/shoebox/memory-format";
import type { MemorySummary } from "@/types/shoebox";

/** Media failures get a small, bounded number of fresh attempts. */
const MAX_MEDIA_ATTEMPTS = 3;
/** One quiet retry after a first failure (uploads can briefly busy media). */
const AUTO_RETRY_MS = 1_500;

type MediaState = { attempt: number; failed: boolean };

/** Remounts the media element for a fresh, bounded attempt after failures. */
function useMediaAttempts() {
  const [media, setMedia] = useState<MediaState>({ attempt: 1, failed: false });
  const exhausted = media.failed && media.attempt >= MAX_MEDIA_ATTEMPTS;
  useEffect(() => {
    if (!media.failed || media.attempt !== 1) return;
    const timer = window.setTimeout(
      () => setMedia({ attempt: 2, failed: false }),
      AUTO_RETRY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [media]);
  return {
    key: media.attempt,
    failed: media.failed,
    exhausted,
    retryable: media.failed && media.attempt > 1 && !exhausted,
    fail: () => setMedia((current) => ({ ...current, failed: true })),
    retry: () =>
      setMedia((current) => ({ attempt: current.attempt + 1, failed: false })),
  };
}

function Legs() {
  return (
    <svg
      className="scrap-legs"
      aria-hidden="true"
      viewBox="0 0 120 54"
      focusable="false"
    >
      <path
        className="scrap-leg scrap-leg-left"
        d="M38 0L30 34L46 46"
        fill="none"
        stroke="#492752"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="scrap-leg scrap-leg-right"
        d="M82 0L90 34L74 46"
        fill="none"
        stroke="#492752"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M36 44Q52 40 54 50L28 52Q26 45 36 44ZM84 44Q68 40 66 50L92 52Q94 45 84 44Z"
        fill="#fa967f"
        stroke="#492752"
        strokeWidth="2"
      />
    </svg>
  );
}

function PhotoContent({
  memory,
  onOpen,
}: {
  memory: Extract<MemorySummary, { kind: "photo" }>;
  onOpen(): void;
}) {
  const media = useMediaAttempts();
  const label = memory.caption
    ? `Ver la foto: ${memory.caption}`
    : `Ver la foto del ${spanishDate(memory.memoryDate)}`;
  const ratio = `${memory.width} / ${memory.height}`;
  if (media.failed) {
    return (
      <div className="scrap-photo-missing" style={{ aspectRatio: ratio }}>
        <p role="status">
          {media.exhausted
            ? "Esta foto no está disponible ahora."
            : media.retryable
              ? "La foto no quiere salir ahora."
              : "La foto se resiste; lo intentamos otra vez…"}
        </p>
        {media.retryable && (
          <button
            type="button"
            className="archive-button"
            onClick={media.retry}
          >
            Reintentar la foto
          </button>
        )}
      </div>
    );
  }
  return (
    <button
      type="button"
      className="scrap-photo"
      onClick={onOpen}
      aria-label={label}
    >
      {/* biome-ignore lint/performance/noImgElement: authenticated same-origin media; never the image optimizer. */}
      <img
        key={media.key}
        src={memory.mediaPath}
        alt=""
        width={memory.width}
        height={memory.height}
        loading="lazy"
        decoding="async"
        style={{ aspectRatio: ratio }}
        onError={media.fail}
      />
    </button>
  );
}

function AudioContent({
  memory,
  onPlay,
}: {
  memory: Extract<MemorySummary, { kind: "audio" }>;
  onPlay(audio: HTMLAudioElement): void;
}) {
  const media = useMediaAttempts();
  const label = memory.caption
    ? `Escuchar: ${memory.caption}`
    : `Escuchar el audio del ${spanishDate(memory.memoryDate)}`;
  return (
    <div className="scrap-jar-content">
      <span className="scrap-jar-label" aria-hidden="true">
        Voz en conserva
      </span>
      {media.failed ? (
        <div className="grid gap-2">
          <p role="status">
            {media.exhausted
              ? "Este audio no está disponible ahora."
              : media.retryable
                ? "Este audio no se puede reproducir ahora."
                : "El frasco no se abre; lo intentamos otra vez…"}
          </p>
          {media.retryable && (
            <button
              type="button"
              className="archive-button"
              onClick={media.retry}
            >
              Reintentar el audio
            </button>
          )}
        </div>
      ) : (
        // biome-ignore lint/a11y/useMediaCaption: a voice memory has no captions; its optional caption describes it.
        <audio
          key={media.key}
          controls
          preload="none"
          src={memory.mediaPath}
          aria-label={label}
          onPlay={(event) => onPlay(event.currentTarget)}
          onError={media.fail}
        />
      )}
      <p className="scrap-duration">
        {Math.max(1, Math.round(memory.durationSeconds))} s
      </p>
    </div>
  );
}

/**
 * One memory on the batch: a crooked paper, note or jar. Only decoration is
 * rotated (the paper layer, tape, stamp and legs, all aria-hidden and
 * pointer-events: none); the real text, media and buttons stay upright.
 */
export default function MemoryScrap({
  memory,
  onOpen,
  onCorrect,
  onRemove,
  onPlay,
}: {
  memory: MemorySummary;
  onOpen(memory: MemorySummary): void;
  onCorrect(memory: MemorySummary): void;
  onRemove(memory: MemorySummary): void;
  onPlay(audio: HTMLAudioElement): void;
}) {
  const look = scrapLook(memory.id);
  const date = spanishDate(memory.memoryDate);
  const legs = memory.kind === "photo" || look.legs;
  return (
    <li
      className="shoebox-scrap"
      data-memory-id={memory.id}
      data-kind={memory.kind}
      data-tone={look.tone}
      data-shape={look.shape}
      data-legs={legs}
      style={{ "--scrap-tilt": `${look.tilt}deg` } as CSSProperties}
    >
      <span className="scrap-paper" aria-hidden="true" />
      {memory.kind === "audio" ? (
        <span className="scrap-lid" aria-hidden="true" />
      ) : (
        <span
          className={`scrap-tape scrap-tape-${look.tape}`}
          aria-hidden="true"
        />
      )}
      <article className="scrap-body" aria-label={`Recuerdo del ${date}`}>
        {memory.kind === "photo" && (
          <PhotoContent memory={memory} onOpen={() => onOpen(memory)} />
        )}
        {memory.kind === "audio" && (
          <AudioContent memory={memory} onPlay={onPlay} />
        )}
        {memory.kind === "text" && <p className="scrap-text">{memory.text}</p>}
        {memory.caption && <p className="scrap-caption">{memory.caption}</p>}
        <p className="scrap-date">
          <time dateTime={memory.memoryDate}>{date}</time>
        </p>
        <div className="scrap-actions">
          <button
            type="button"
            className="archive-button"
            data-scrap-action="correct"
            onClick={() => onCorrect(memory)}
          >
            Corregir<span className="sr-only"> el recuerdo del {date}</span>
          </button>
          <button
            type="button"
            className="archive-button scrap-remove"
            data-scrap-action="remove"
            onClick={() => onRemove(memory)}
          >
            Retirar de la caja
            <span className="sr-only"> el recuerdo del {date}</span>
          </button>
        </div>
      </article>
      <span className="scrap-stamp" aria-hidden="true">
        {look.stamp}
      </span>
      {legs && <Legs />}
    </li>
  );
}
