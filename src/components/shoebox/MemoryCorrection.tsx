"use client";

import { Save } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  CaptionDateFields,
  MemoryTextField,
  validDate,
} from "@/components/shoebox/MemoryFields";
import { memoryLabel } from "@/components/shoebox/memory-format";
import JournalDialog from "@/components/shoebox/ShoeboxDialog";
import {
  isOutcomeUncertain,
  ShoeboxApiError,
  shoeboxFetch,
} from "@/features/shoebox/client/api";
import { readMemoryResult } from "@/features/shoebox/client/archive-state";
import {
  MAX_CAPTION_CHARACTERS,
  MAX_TEXT_CHARACTERS,
} from "@/features/shoebox/limits";
import { codePointLength } from "@/features/shoebox/validation";
import type {
  MemoryCorrection as Correction,
  MemorySummary,
} from "@/types/shoebox";

type Phase =
  | { name: "editing"; message?: string }
  | { name: "saving" }
  | { name: "uncertain"; checking: boolean; message?: string };

function matches(memory: MemorySummary, sent: Correction): boolean {
  return (
    memory.caption === sent.caption &&
    memory.memoryDate === sent.memoryDate &&
    (memory.kind !== "text" || memory.text === sent.text)
  );
}

/**
 * Corrects text, caption or date with the same controls as the composer; no
 * media replacement. Last confirmed write wins. A 202 or a lost connection is
 * "unknown", never success: the person checks, and the dialog reads the
 * record back before believing anything.
 */
export default function MemoryCorrection({
  memory,
  onClose,
  onCorrected,
  onGone,
  onUnauthorized,
  getOne,
}: {
  memory: MemorySummary;
  onClose(): void;
  onCorrected(memory: MemorySummary): void;
  onGone(id: string): void;
  onUnauthorized(): void;
  getOne(id: string): Promise<MemorySummary | null>;
}) {
  const [text, setText] = useState(memory.kind === "text" ? memory.text : "");
  const [caption, setCaption] = useState(memory.caption);
  const [memoryDate, setMemoryDate] = useState(memory.memoryDate);
  const [phase, setPhase] = useState<Phase>({ name: "editing" });
  const sent = useRef<Correction | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const body: Correction =
    memory.kind === "text"
      ? { text, caption, memoryDate }
      : { caption, memoryDate };
  const valid =
    (memory.kind !== "text" ||
      (text.trim() !== "" && codePointLength(text) <= MAX_TEXT_CHARACTERS)) &&
    codePointLength(caption) <= MAX_CAPTION_CHARACTERS &&
    validDate(memoryDate);

  function failed(error: unknown) {
    if (!(error instanceof ShoeboxApiError)) {
      setPhase({
        name: "editing",
        message: "Algo salió mal. Inténtalo otra vez.",
      });
      return;
    }
    if (error.code === "UNAUTHORIZED") {
      onUnauthorized();
      return;
    }
    if (error.code === "NOT_FOUND") {
      onGone(memory.id);
      return;
    }
    if (isOutcomeUncertain(error)) {
      setPhase({ name: "uncertain", checking: false });
      return;
    }
    setPhase({ name: "editing", message: error.message });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || phase.name !== "editing") return;
    sent.current = body;
    setPhase({ name: "saving" });
    try {
      const result = await shoeboxFetch<unknown>(
        `/api/shoebox/memories/${memory.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      // A write that landed is reported even if the dialog closed meanwhile.
      onCorrected(readMemoryResult(result));
    } catch (error) {
      if (!mounted.current) return;
      failed(error);
    }
  }

  async function check() {
    setPhase({ name: "uncertain", checking: true });
    try {
      const current = await getOne(memory.id);
      if (!mounted.current) return;
      if (current === null) {
        onGone(memory.id);
        return;
      }
      if (sent.current && matches(current, sent.current)) {
        onCorrected(current);
        return;
      }
      setPhase({
        name: "editing",
        message:
          "La caja todavía guarda la versión anterior. Puedes guardar la corrección otra vez.",
      });
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof ShoeboxApiError && error.code === "UNAUTHORIZED") {
        return;
      }
      setPhase({
        name: "uncertain",
        checking: false,
        message: "Tampoco pudimos comprobarlo. Prueba otra vez en un momento.",
      });
    }
  }

  const busy = phase.name === "saving" || phase.name === "uncertain";
  return (
    <JournalDialog
      isOpen
      onClose={onClose}
      title="Corregir el recuerdo"
      className="shoebox-composer"
    >
      <form
        className="grid gap-5 px-6 pt-5 pb-2 sm:px-8"
        noValidate
        onSubmit={submit}
      >
        <p className="text-sm text-[var(--journal-muted)]">
          {memoryLabel(memory)}.
          {memory.kind === "text"
            ? ""
            : " La foto o el audio no se cambian; solo el pie y la fecha."}
        </p>
        <fieldset disabled={busy} className="grid gap-4">
          {memory.kind === "text" && (
            <MemoryTextField
              idPrefix="correction"
              value={text}
              onChange={setText}
            />
          )}
          <CaptionDateFields
            idPrefix="correction"
            kind={memory.kind}
            caption={caption}
            memoryDate={memoryDate}
            onCaption={setCaption}
            onDate={setMemoryDate}
          />
        </fieldset>
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--journal-rule)] pt-4">
          <button
            type="submit"
            className="archive-button"
            disabled={!valid || busy}
          >
            <Save aria-hidden="true" size={18} />
            Guardar la corrección
          </button>
        </div>
        <div className="grid gap-2">
          <p role="status" aria-live="polite" className="min-h-6 text-sm">
            {phase.name === "saving"
              ? "Guardando la corrección…"
              : phase.name === "uncertain"
                ? phase.checking
                  ? "Comprobando qué guarda la caja…"
                  : (phase.message ??
                    "No sabemos todavía si la corrección llegó. Comprueba antes de volver a intentarlo.")
                : (phase.message ?? "")}
          </p>
          {phase.name === "uncertain" && !phase.checking && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="archive-button"
                onClick={() => void check()}
              >
                Comprobar
              </button>
            </div>
          )}
        </div>
      </form>
    </JournalDialog>
  );
}
