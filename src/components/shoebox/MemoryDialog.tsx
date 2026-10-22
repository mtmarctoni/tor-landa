"use client";

import { useState } from "react";
import { spanishDate } from "@/components/shoebox/memory-format";
import JournalDialog from "@/components/shoebox/ShoeboxDialog";
import type { MemorySummary } from "@/types/shoebox";

/**
 * The full memory in one native dialog: the processed photo with contain
 * sizing (ordinary <img>, never the optimizer or the public birthday viewer),
 * an audio jar, or the whole note, always with caption and date. The page's
 * own zoom and scroll keep working; there is no custom gesture engine.
 */
export default function MemoryDialog({
  memory,
  onClose,
  onPlay,
}: {
  memory: MemorySummary;
  onClose(): void;
  onPlay(audio: HTMLAudioElement): void;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const date = spanishDate(memory.memoryDate);
  return (
    <JournalDialog
      isOpen
      onClose={onClose}
      title="Un recuerdo de la caja"
      className="shoebox-detail"
    >
      <figure className="shoebox-detail-figure">
        {memory.kind === "photo" &&
          (photoFailed ? (
            <p role="status" className="shoebox-detail-missing">
              Esta foto no está disponible ahora. El pie y la fecha siguen aquí.
            </p>
          ) : (
            // biome-ignore lint/performance/noImgElement: authenticated same-origin media; never the image optimizer.
            <img
              src={memory.mediaPath}
              alt={memory.caption || `Foto del ${date}`}
              width={memory.width}
              height={memory.height}
              className="shoebox-detail-photo"
              onError={() => setPhotoFailed(true)}
            />
          ))}
        {memory.kind === "audio" && (
          // biome-ignore lint/a11y/useMediaCaption: a voice memory has no captions; its optional caption describes it.
          <audio
            controls
            preload="none"
            src={memory.mediaPath}
            aria-label={
              memory.caption
                ? `Escuchar: ${memory.caption}`
                : `Escuchar el audio del ${date}`
            }
            onPlay={(event) => onPlay(event.currentTarget)}
            onError={() => setAudioFailed(true)}
            className="w-full"
          />
        )}
        {memory.kind === "audio" && audioFailed && (
          <p role="status">
            Este audio no está disponible ahora. El pie y la fecha siguen aquí.
          </p>
        )}
        {memory.kind === "text" && (
          <p className="shoebox-detail-text">{memory.text}</p>
        )}
        <figcaption className="grid gap-1">
          {memory.caption && <span>{memory.caption}</span>}
          <time dateTime={memory.memoryDate} className="shoebox-detail-date">
            {date}
          </time>
        </figcaption>
      </figure>
    </JournalDialog>
  );
}
