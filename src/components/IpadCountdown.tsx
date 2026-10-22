"use client";

import { useEffect, useRef, useState } from "react";
import IpadPromiseCertificate from "@/components/IpadPromiseCertificate";
import JournalDialog from "@/components/JournalDialog";
import { ipadCountdownConfig } from "@/data/ipadCountdown";
import { useIpadCountdown } from "@/hooks/useIpadCountdown";
import "./ipad-countdown.css";

export default function IpadCountdown() {
  const [revealOpen, setRevealOpen] = useState(false);
  const model = useIpadCountdown(ipadCountdownConfig, revealOpen);
  const fallbackFocus = useRef<HTMLHeadingElement>(null);
  const previousContent = useRef(model?.content);
  const announced = useRef(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (revealOpen && model?.placement !== "reveal") {
      setRevealOpen(false);
      fallbackFocus.current?.focus({ preventScroll: true });
    }
  }, [model?.placement, revealOpen]);

  useEffect(() => {
    if (
      previousContent.current === "pending" &&
      model?.content === "shopping-open" &&
      (model.placement === "inline" || revealOpen) &&
      !announced.current
    ) {
      announced.current = true;
      setAnnouncement("Se abre el plazo de cumplir la promesa.");
    }
    previousContent.current = model?.content;
  }, [model?.content, model?.placement, revealOpen]);

  if (!model || model.placement === "hidden") return null;
  return (
    <div className="ipad-countdown" data-testid="ipad-countdown">
      {model.placement === "reveal" ? (
        <div className="ipad-promise-invitation">
          <span aria-hidden="true" className="ipad-promise-invitation-mark">
            IP-01
          </span>
          <button
            type="button"
            className="control-pill ipad-promise-trigger"
            onClick={() => setRevealOpen(true)}
          >
            ¿Y mi iPad?
          </button>
          <span className="ipad-promise-invitation-note">
            Hay una promesa haciendo cola.
          </span>
        </div>
      ) : (
        <>
          <h2 ref={fallbackFocus} tabIndex={-1} className="sr-only">
            La promesa del iPad
          </h2>
          <IpadPromiseCertificate model={model} variant="compact" />
        </>
      )}
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </p>
      <JournalDialog
        isOpen={revealOpen && model.placement === "reveal"}
        onClose={() => setRevealOpen(false)}
        title="Departamento de Promesas Pendientes"
        className="ipad-promise-dialog"
      >
        {revealOpen && model.placement === "reveal" && (
          <IpadPromiseCertificate model={model} variant="full" />
        )}
      </JournalDialog>
    </div>
  );
}
