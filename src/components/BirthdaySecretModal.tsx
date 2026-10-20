"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { BirthdaySecretModalProps } from "@/types/components";
import BirthdayWorld from "./BirthdayWorld";
import JournalDialog from "./JournalDialog";

const PASSWORD = "2329";

const BirthdaySecretModal: React.FC<BirthdaySecretModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleClose = () => {
    // Ordinary dismissal retains partial attempts, as in the original puzzle.
    // An exhausted session resets on close, without a timer leaking into reopen.
    if (attempts >= 3) {
      setPassword("");
      setAttempts(0);
      setError("");
    }
    onClose();
  };
  const onCloseRef = useRef(onClose);
  onCloseRef.current = handleClose;

  useEffect(() => {
    if (!isOpen && closeTimer.current) clearTimeout(closeTimer.current);
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [isOpen]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (attempts >= 3) return;
    if (password.toLowerCase().trim() === PASSWORD) {
      setError("");
      setPassword("");
      setAttempts(0);
      onSuccess();
    } else {
      setAttempts((value) => value + 1);
      setPassword("");
      if (attempts >= 2) {
        setError("Casi lo logras... tal vez mañana tengas más suerte");
        closeTimer.current = setTimeout(() => onCloseRef.current(), 3000);
      } else setError("Mmm... no es esa. Piensa en un 2 números especiales");
    }
  };

  return (
    <JournalDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="El secreto de Landa"
      initialFocusRef={inputRef}
      className="birthday-dialog birthday-secret"
    >
      <div className="birthday-secret-world">
        <BirthdayWorld />
        <div className="birthday-keyhole" aria-hidden="true">
          <span />
        </div>
        <p className="birthday-world-label">
          Una puerta que solo tú sabes abrir
        </p>
      </div>
      <form onSubmit={handleSubmit} className="birthday-secret-form">
        <p className="journal-eyebrow">Al otro lado de lo imposible</p>
        <p>Hay un pequeño universo preparado solo para ti.</p>
        <label htmlFor="secret-code">Código secreto</label>
        <input
          ref={inputRef}
          id="secret-code"
          type="text"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Escribe aquí..."
          disabled={attempts >= 3}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? "birthday-secret-error" : "birthday-secret-hint"
          }
          autoComplete="off"
        />
        {error && (
          <p id="birthday-secret-error" role="alert" className="birthday-error">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="control-pill"
          disabled={attempts >= 3 || !password.trim()}
        >
          {attempts >= 3 ? "Intentos agotados" : "Descubrir el secreto"}
        </button>
        <p id="birthday-secret-hint" className="birthday-secret-hint">
          Pista: ya lo has usado alguna vez.
        </p>
      </form>
    </JournalDialog>
  );
};
export default BirthdaySecretModal;
