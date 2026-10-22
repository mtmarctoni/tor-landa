"use client";

import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  useState,
} from "react";
import { shoeboxFetch } from "@/features/shoebox/client/api";
import type { SavePhase } from "@/features/shoebox/client/useComposerSave";

/** What the save phase means for the person, and the actions it offers. */
export function PhaseNotice({
  phase,
  onCancel,
  onCheck,
  onRetry,
  onSaveAsNew,
}: {
  phase: SavePhase;
  onCancel(): void;
  onCheck(): void;
  onRetry(): void;
  onSaveAsNew(): void;
}) {
  let message = "";
  let actions: ReactNode = null;
  switch (phase.name) {
    case "editing":
      message = phase.notice ?? "";
      break;
    case "saving":
    case "checking":
      message =
        phase.name === "saving"
          ? "Guardando en la caja… Mantén esta página abierta."
          : "Comprobando si llegó a la caja…";
      actions = (
        <button type="button" className="archive-button" onClick={onCancel}>
          Cancelar envío
        </button>
      );
      break;
    case "uncertain":
      message = phase.cancelled
        ? "Cancelamos la espera aquí, pero eso no deshace nada: la caja puede terminar de guardarlo igualmente. No sabemos todavía si se guardó."
        : "No sabemos todavía si se guardó. Puede que ya esté en la caja y aún no lo veamos.";
      actions = (
        <>
          <button type="button" className="archive-button" onClick={onCheck}>
            Comprobar de nuevo
          </button>
          <button type="button" className="archive-button" onClick={onRetry}>
            Reintentar
          </button>
          <p className="w-full text-xs text-[var(--journal-muted)]">
            Reintentar comprueba primero y reenvía el mismo envío, así que la
            caja no debería duplicarlo.
          </p>
        </>
      );
      break;
    case "ambiguous":
      message =
        "La caja encontró más de una copia de este envío. No hemos borrado nada: revisa la caja y retira la que sobre. Tu borrador sigue aquí.";
      actions = (
        <button type="button" className="archive-button" onClick={onCheck}>
          Comprobar de nuevo
        </button>
      );
      break;
    case "conflict":
      message = `Este envío ya se usó con otro contenido${phase.earlier ? " y una versión anterior ya está en la caja" : ""}. Si lo guardas como recuerdo nuevo, puede quedar repetido.`;
      actions = (
        <button type="button" className="archive-button" onClick={onSaveAsNew}>
          Guardar como recuerdo nuevo
        </button>
      );
      break;
    case "failed":
      message = phase.message;
      actions = phase.retryable ? (
        <button type="button" className="archive-button" onClick={onRetry}>
          Reintentar
        </button>
      ) : null;
      break;
  }
  return (
    <div className="grid gap-2">
      <p role="status" aria-live="polite" className="min-h-6 text-sm">
        {message}
      </p>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ReauthPanel({
  passwordRef,
  onDone,
}: {
  passwordRef: RefObject<HTMLInputElement | null>;
  onDone(expiresAt: number): void;
}) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || password === "") return;
    setPending(true);
    setMessage("");
    try {
      const session = await shoeboxFetch<{ expiresAt: number }>(
        "/api/shoebox/session",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        },
      );
      setPassword("");
      onDone(session.expiresAt);
      return;
    } catch (error) {
      const code = (error as { code?: string }).code;
      setMessage(
        code === "UNAUTHORIZED"
          ? "Esa no es la contraseña. Tu borrador sigue aquí."
          : error instanceof Error
            ? error.message
            : "No pudimos abrir la caja.",
      );
    }
    setPassword("");
    setPending(false);
    passwordRef.current?.focus();
  }

  return (
    <section aria-labelledby="composer-reauth-title" className="grid gap-3">
      <h3 id="composer-reauth-title" className="text-xl font-semibold">
        La sesión caducó
      </h3>
      <p>
        Tu borrador sigue aquí, solo en esta página. Vuelve a abrir la caja y
        después pulsa Guardar; no enviaremos nada por nuestra cuenta.
      </p>
      <form onSubmit={submit} className="grid max-w-md gap-2" noValidate>
        <label
          htmlFor="composer-reauth-password"
          className="text-sm font-semibold"
        >
          Contraseña
        </label>
        <input
          id="composer-reauth-password"
          ref={passwordRef}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-12 w-full rounded-2xl border border-[var(--journal-muted)] bg-[var(--dream-cloud)] px-4"
        />
        <button
          type="submit"
          className="archive-button justify-self-start"
          disabled={pending || password === ""}
        >
          Abrir otra vez
        </button>
        <p role="status" aria-live="polite" className="min-h-6 text-sm">
          {message}
        </p>
      </form>
    </section>
  );
}
