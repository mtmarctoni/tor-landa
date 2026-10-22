"use client";

import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";
import {
  LOGIN_FALLBACK,
  loginFailureMessage,
} from "@/features/shoebox/client/login-error";

const OFFLINE = "No pudimos hablar con la caja. Revisa la conexión.";

/** Generic login shell: nothing private is rendered or fetched here. */
export default function ShoeboxLogin() {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    let text = LOGIN_FALLBACK;
    try {
      const response = await fetch("/api/shoebox/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.ok) {
        // Full navigation to the fixed route, never a caller-chosen target.
        window.location.assign("/shoebox");
        return;
      }
      text = await loginFailureMessage(response);
    } catch {
      text = OFFLINE;
    }
    setPassword("");
    setPending(false);
    setMessage(text);
    input.current?.focus();
  }

  return (
    <main className="archive-page">
      <section aria-labelledby="shoebox-login-title">
        <Link
          href="/"
          prefetch={false}
          className="archive-return archive-button"
        >
          <ArrowLeft aria-hidden="true" size={20} />
          Volver al presente
        </Link>
        <div className="archive-title-scene">
          <div className="archive-orbit" aria-hidden="true">
            <span className="archive-door" />
            <span className="archive-orbit-moon" />
          </div>
          <div className="archive-title-cloud">
            <p className="journal-eyebrow">Ventanilla de asuntos imposibles</p>
            <h1 id="shoebox-login-title">
              Nuestra caja
              <br />
              <em>imposible</em>
            </h1>
            <p>Está cerrada con una palabra que solo sabemos nosotros.</p>
          </div>
        </div>
        <form
          className="archive-tools grid max-w-md gap-3"
          onSubmit={submit}
          noValidate
        >
          <label
            htmlFor="shoebox-password"
            className="text-sm font-semibold text-[var(--journal-muted)]"
          >
            Contraseña
          </label>
          <input
            id="shoebox-password"
            ref={input}
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="shoebox-login-status"
            className="min-h-12 w-full rounded-2xl border border-[var(--journal-muted)] bg-[var(--dream-cloud)] px-4 py-2 text-[var(--journal-ink)]"
          />
          <button
            type="submit"
            className="archive-button"
            disabled={pending || password.length === 0}
          >
            <KeyRound aria-hidden="true" size={18} />
            {pending ? "Girando la llave…" : "Abrir la caja"}
          </button>
          <p
            id="shoebox-login-status"
            role="status"
            aria-live="polite"
            className="min-h-6 text-sm text-[var(--journal-ink)]"
          >
            {message}
          </p>
        </form>
      </section>
    </main>
  );
}
