"use client";

import type React from "react";
import { useEffect, useId, useRef } from "react";

// A new native modal supersedes any pending transition, even if it closes
// before that transition's timer fires. Only successful acquisitions advance it.
let ownershipVersion = 0;
export function getDialogOwnershipVersion(): number {
  return ownershipVersion;
}

export interface JournalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

export default function JournalDialog({
  isOpen,
  onClose,
  title,
  children,
  className = "",
  initialFocusRef,
}: JournalDialogProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return;
    const opener = document.activeElement;
    const root = document.documentElement;
    const body = document.body;
    const previous = [root.style.overflow, body.style.overflow];
    const position = { left: window.scrollX, top: window.scrollY };
    dialog.showModal();
    ownershipVersion += 1;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    (initialFocusRef?.current ?? closeRef.current)?.focus({
      preventScroll: true,
    });

    return () => {
      dialog.close();
      [root.style.overflow, body.style.overflow] = previous;
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus({ preventScroll: true });
      }
      window.scrollTo({ ...position, behavior: "instant" });
    };
  }, [isOpen, initialFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      className={`journal-dialog ${className}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="journal-dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button
          ref={closeRef}
          type="button"
          className="journal-dialog-close"
          onClick={onClose}
        >
          Cerrar
        </button>
      </header>
      <div className="journal-dialog-content">{children}</div>
    </dialog>
  );
}
