"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { memoryLabel } from "@/components/shoebox/memory-format";
import JournalDialog from "@/components/shoebox/ShoeboxDialog";
import {
  isOutcomeUncertain,
  ShoeboxApiError,
  shoeboxFetch,
} from "@/features/shoebox/client/api";
import type { MemorySummary } from "@/types/shoebox";

type Phase =
  | { name: "asking"; message?: string }
  | { name: "removing" }
  | { name: "uncertain"; checking: boolean; message?: string };

/**
 * Confirms moving one identified memory to the Notion trash. Cancel has the
 * initial focus. The memory leaves the batch only after a confirmed 204 (or a
 * read-back that shows it gone); every failure keeps it.
 */
export default function RemovalConfirmation({
  memory,
  onClose,
  onRemoved,
  onUnauthorized,
  getOne,
}: {
  memory: MemorySummary;
  onClose(): void;
  onRemoved(id: string): void;
  onUnauthorized(): void;
  getOne(id: string): Promise<MemorySummary | null>;
}) {
  const [phase, setPhase] = useState<Phase>({ name: "asking" });
  const cancelRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function remove() {
    if (phase.name !== "asking") return;
    setPhase({ name: "removing" });
    try {
      await shoeboxFetch(`/api/shoebox/memories/${memory.id}`, {
        method: "DELETE",
      });
      onRemoved(memory.id);
    } catch (error) {
      if (error instanceof ShoeboxApiError && error.code === "NOT_FOUND") {
        // Already gone from this box: nothing left to remove.
        onRemoved(memory.id);
        return;
      }
      if (error instanceof ShoeboxApiError && error.code === "UNAUTHORIZED") {
        onUnauthorized();
        return;
      }
      if (!mounted.current) return;
      if (isOutcomeUncertain(error)) {
        setPhase({ name: "uncertain", checking: false });
        return;
      }
      setPhase({
        name: "asking",
        message:
          error instanceof Error
            ? `${error.message} El recuerdo sigue en la caja.`
            : "No pudimos retirarlo. El recuerdo sigue en la caja.",
      });
    }
  }

  async function check() {
    setPhase({ name: "uncertain", checking: true });
    try {
      const current = await getOne(memory.id);
      if (current === null) {
        onRemoved(memory.id);
        return;
      }
      if (!mounted.current) return;
      setPhase({
        name: "asking",
        message: "Sigue en la caja. Puedes intentarlo otra vez.",
      });
    } catch {
      if (!mounted.current) return;
      setPhase({
        name: "uncertain",
        checking: false,
        message: "Tampoco pudimos comprobarlo. Prueba otra vez en un momento.",
      });
    }
  }

  const busy = phase.name !== "asking";
  return (
    <JournalDialog
      isOpen
      onClose={onClose}
      title="¿Retirar este recuerdo?"
      initialFocusRef={cancelRef}
      className="shoebox-composer"
    >
      <div className="grid gap-4 px-6 pt-5 pb-2 sm:px-8">
        <p className="font-semibold">{memoryLabel(memory)}.</p>
        <p className="text-sm text-[var(--journal-muted)]">
          Irá a la papelera de Notion. Aquí no hay papelera: si hiciera falta,
          se puede restaurar a mano desde Notion.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            ref={cancelRef}
            type="button"
            className="archive-button"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="archive-button"
            onClick={() => void remove()}
            disabled={busy}
          >
            <Trash2 aria-hidden="true" size={16} />
            Sí, retirarlo
          </button>
        </div>
        <div className="grid gap-2">
          <p role="status" aria-live="polite" className="min-h-6 text-sm">
            {phase.name === "removing"
              ? "Retirándolo…"
              : phase.name === "uncertain"
                ? phase.checking
                  ? "Comprobando si sigue en la caja…"
                  : (phase.message ??
                    "No sabemos todavía si se retiró. Comprueba antes de intentarlo otra vez.")
                : (phase.message ?? "")}
          </p>
          {phase.name === "uncertain" && !phase.checking && (
            <button
              type="button"
              className="archive-button justify-self-start"
              onClick={() => void check()}
            >
              Comprobar
            </button>
          )}
        </div>
      </div>
    </JournalDialog>
  );
}
