"use client";

import {
  MAX_CAPTION_CHARACTERS,
  MAX_TEXT_CHARACTERS,
} from "@/features/shoebox/limits";
import { codePointLength, readMemoryDate } from "@/features/shoebox/validation";
import type { MemoryKind } from "@/types/shoebox";

/** Today on the local calendar (not UTC), as YYYY-MM-DD. */
export function localToday(): string {
  const now = new Date();
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function validDate(value: string): boolean {
  try {
    readMemoryDate(value);
    return true;
  } catch {
    return false;
  }
}

const INPUT =
  "min-h-12 w-full rounded-2xl border border-[var(--journal-muted)] bg-[var(--dream-cloud)] px-4";

/** The written memory: the same control for composing and correcting. */
export function MemoryTextField({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: string;
  onChange(value: string): void;
}) {
  const length = codePointLength(value);
  return (
    <div className="grid gap-1">
      <label htmlFor={`${idPrefix}-text`} className="text-sm font-semibold">
        Lo que pasó
      </label>
      <textarea
        id={`${idPrefix}-text`}
        value={value}
        rows={5}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={`${idPrefix}-text-count`}
        className="min-h-32 w-full rounded-2xl border border-[var(--journal-muted)] bg-[var(--dream-cloud)] px-4 py-3"
      />
      <p
        id={`${idPrefix}-text-count`}
        className={`text-xs ${length > MAX_TEXT_CHARACTERS ? "text-[var(--color-danger-text)]" : "text-[var(--journal-muted)]"}`}
      >
        {length} / {MAX_TEXT_CHARACTERS}
      </p>
    </div>
  );
}

/** Optional caption and the date of the memory (date-only, local calendar). */
export function CaptionDateFields({
  idPrefix,
  kind,
  caption,
  memoryDate,
  onCaption,
  onDate,
}: {
  idPrefix: string;
  kind: MemoryKind;
  caption: string;
  memoryDate: string;
  onCaption(value: string): void;
  onDate(value: string): void;
}) {
  const captionLength = codePointLength(caption);
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
      <div className="grid gap-1">
        <label
          htmlFor={`${idPrefix}-caption`}
          className="text-sm font-semibold"
        >
          Pie (opcional)
        </label>
        <input
          id={`${idPrefix}-caption`}
          type="text"
          value={caption}
          onChange={(event) => onCaption(event.target.value)}
          aria-describedby={`${idPrefix}-caption-count`}
          className={INPUT}
        />
        <p
          id={`${idPrefix}-caption-count`}
          className={`text-xs ${captionLength > MAX_CAPTION_CHARACTERS ? "text-[var(--color-danger-text)]" : "text-[var(--journal-muted)]"}`}
        >
          {captionLength} / {MAX_CAPTION_CHARACTERS}
          {kind === "audio" ? " · Puedes describir aquí lo que se oye." : ""}
        </p>
      </div>
      <div className="grid content-start gap-1">
        <label htmlFor={`${idPrefix}-date`} className="text-sm font-semibold">
          Fecha
        </label>
        <input
          id={`${idPrefix}-date`}
          type="date"
          required
          value={memoryDate}
          onChange={(event) => onDate(event.target.value)}
          className={INPUT}
        />
      </div>
    </div>
  );
}
