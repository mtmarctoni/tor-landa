"use client";

import { LogOut, Pause, Play, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import MemoryComposer from "@/components/shoebox/MemoryComposer";
import MemoryCorrection from "@/components/shoebox/MemoryCorrection";
import MemoryDialog from "@/components/shoebox/MemoryDialog";
import MemoryScrap from "@/components/shoebox/MemoryScrap";
import { savedMessage } from "@/components/shoebox/memory-format";
import RemovalConfirmation from "@/components/shoebox/RemovalConfirmation";
import { ShoeboxDialogSuspended } from "@/components/shoebox/ShoeboxDialog";
import ShoeboxScene from "@/components/shoebox/ShoeboxScene";
import { useShoeboxMotion } from "@/components/shoebox/useShoeboxMotion";
import { useMemoryArchive } from "@/features/shoebox/client/useMemoryArchive";
import { useShoeboxSession } from "@/features/shoebox/client/useShoeboxSession";
import type { MemorySummary } from "@/types/shoebox";
import "./shoebox.css";

const LOGIN_PATH = "/shoebox/login";
const GONE = "Ese recuerdo ya no está en la caja.";

/** Exactly one native dialog at a time. */
type Dialog =
  | { kind: "none" }
  | { kind: "compose" }
  | { kind: "detail"; memory: MemorySummary }
  | { kind: "correct"; memory: MemorySummary }
  | { kind: "remove"; memory: MemorySummary };

const NONE: Dialog = { kind: "none" };

/**
 * The authenticated shoebox: session gate, one batch of memories, one dialog,
 * one playing audio, and the decorative scene. Nothing private is rendered on
 * the server; the batch is fetched only once the session gate is open.
 */
export default function ShoeboxArchive({ expiresAt }: { expiresAt: number }) {
  const [hydrated, setHydrated] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(NONE);
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState("");
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState("");
  const worldRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const activeAudio = useRef<HTMLAudioElement | null>(null);
  const authority = useRef(0);
  /** After a batch change: an adjacent action to focus, or the heading. */
  const focusAfter = useRef<string | "heading" | null>(null);
  /** Focus to restore once a closed gate opens again. */
  const focusBeforeGate = useRef<Element | null>(null);

  useEffect(() => setHydrated(true), []);

  const pauseMedia = useCallback(() => {
    for (const audio of worldRef.current?.querySelectorAll("audio") ?? []) {
      audio.pause();
    }
    activeAudio.current = null;
  }, []);

  const rememberFocus = () => {
    focusBeforeGate.current = document.activeElement;
  };

  const session = useShoeboxSession(expiresAt, {
    onHidden() {
      rememberFocus();
      pauseMedia();
    },
    onPageHide() {
      authority.current += 1;
      rememberFocus();
      pauseMedia();
      archive.clear();
    },
    onLeave() {
      authority.current += 1;
      pauseMedia();
      archive.clear();
      setDialog(NONE);
    },
  });
  const archive = useMemoryArchive({ onUnauthorized: session.expire });
  const valid = session.state === "valid";
  const composing = dialog.kind === "compose";
  // Async dialog callbacks may outlive their dialog and a whole login cycle.
  // Never apply an old authority epoch to a newly fetched private batch.
  const epoch = authority.current;
  useLayoutEffect(() => {
    if (session.state === "expired") authority.current += 1;
  }, [session.state]);
  const currentAuthority = () => valid && epoch === authority.current;

  const motion = useShoeboxMotion({
    dialogOpen: dialog.kind !== "none",
    recording,
  });

  useEffect(() => {
    if (dialog.kind !== "none") pauseMedia();
  }, [dialog.kind, pauseMedia]);

  // Fetch the batch only behind an open gate.
  useEffect(() => {
    if (valid && archive.state === "idle") archive.start();
  }, [valid, archive.state, archive.start]);

  // Confirmed expiry: drop private content at once. Leave unless a composer
  // holds a draft, whose inline reauthentication (or discard) decides.
  useEffect(() => {
    if (session.state !== "expired") return;
    pauseMedia();
    archive.clear();
    setNotice("");
    setDialog((current) => (current.kind === "compose" ? current : NONE));
    if (!composing) window.location.replace(LOGIN_PATH);
  }, [session.state, composing, archive.clear, pauseMedia]);

  useEffect(() => {
    if (session.state === "checking") pauseMedia();
    if (session.state !== "valid") return;
    const previous = focusBeforeGate.current;
    focusBeforeGate.current = null;
    if (
      previous instanceof HTMLElement &&
      previous.isConnected &&
      (document.activeElement === document.body ||
        document.activeElement === null)
    ) {
      previous.focus({ preventScroll: true });
    }
  }, [session.state, pauseMedia]);

  // A new batch from Older/Previous/Volver al principio: announce it by focus.
  const navigation = useRef(archive.navigation);
  useEffect(() => {
    if (archive.navigation === navigation.current) return;
    navigation.current = archive.navigation;
    headingRef.current?.focus();
  }, [archive.navigation]);

  // After a removal or a vanished record: an adjacent action, else heading.
  useEffect(() => {
    const target = focusAfter.current;
    if (target === null || dialog.kind !== "none") return;
    focusAfter.current = null;
    const action =
      target === "heading"
        ? null
        : worldRef.current?.querySelector<HTMLElement>(
            `[data-memory-id="${target}"] [data-scrap-action="correct"]`,
          );
    (action ?? headingRef.current)?.focus();
  });

  // A correction can move its own opener across a batch boundary. Native
  // dialog restoration cannot focus a removed node; use the batch heading.
  const batchBefore = useRef(archive.page);
  useEffect(() => {
    const previous = batchBefore.current;
    batchBefore.current = archive.page;
    if (
      previous &&
      archive.page &&
      previous !== archive.page &&
      dialog.kind === "none" &&
      document.activeElement === document.body &&
      previous.items.some(
        (old) => !archive.page?.items.some((item) => item.id === old.id),
      )
    )
      headingRef.current?.focus();
  }, [archive.page, dialog.kind]);

  const claimAudio = useCallback((audio: HTMLAudioElement) => {
    if (activeAudio.current && activeAudio.current !== audio) {
      activeAudio.current.pause();
    }
    activeAudio.current = audio;
  }, []);

  /** Removes a record from the batch and picks where focus lands next. */
  const dropFromBatch = useCallback(
    (id: string, focus: "adjacent" | "heading") => {
      const items = archive.page?.items ?? [];
      const index = items.findIndex((item) => item.id === id);
      const neighbour =
        focus === "adjacent" && index >= 0
          ? (items[index + 1] ?? items[index - 1])
          : undefined;
      focusAfter.current = neighbour?.id ?? "heading";
      if (activeAudio.current?.closest(`[data-memory-id="${id}"]`)) {
        activeAudio.current.pause();
        activeAudio.current = null;
      }
      archive.onRemoved(id);
    },
    [archive.page, archive.onRemoved],
  );

  function closeDialog() {
    setDialog(NONE);
  }

  async function openDetail(memory: MemorySummary) {
    pauseMedia();
    setDialog({ kind: "detail", memory });
    try {
      const fresh = await archive.getOne(memory.id);
      if (!currentAuthority()) return;
      if (fresh === null) {
        // Removed elsewhere: close the stale media and say so.
        setDialog((current) =>
          current.kind === "detail" && current.memory.id === memory.id
            ? NONE
            : current,
        );
        setNotice(GONE);
        dropFromBatch(memory.id, "heading");
        return;
      }
      archive.onCorrected(fresh);
      setDialog((current) =>
        current.kind === "detail" && current.memory.id === memory.id
          ? { kind: "detail", memory: fresh }
          : current,
      );
    } catch {
      // Keep showing what we have; the media itself reports its own failure.
    }
  }

  async function viewSaved(memory: MemorySummary) {
    try {
      const fresh = await archive.getOne(memory.id);
      if (!currentAuthority()) return;
      if (fresh === null) {
        setNotice(GONE);
        archive.onRemoved(memory.id);
        return;
      }
      pauseMedia();
      setDialog({ kind: "detail", memory: fresh });
    } catch {
      setNotice("No pudimos abrir ese recuerdo ahora. Inténtalo otra vez.");
    }
  }

  function page(direction: "older" | "previous" | "restart") {
    pauseMedia();
    setNotice((current) => (current === GONE ? "" : current));
    if (direction === "older") archive.older();
    else if (direction === "previous") archive.previous();
    else archive.refresh();
  }

  async function logout() {
    setLogoutPending(true);
    setLogoutMessage("");
    try {
      await session.logout();
      return;
    } catch {
      // Fall through to the message below.
    }
    setLogoutPending(false);
    setLogoutMessage("No pudimos cerrar la caja. Inténtalo otra vez.");
  }

  const items = archive.page?.items ?? [];
  const navigating = archive.state === "loading" && archive.page !== null;
  const showSavedLink =
    archive.saved !== null &&
    archive.state === "ready" &&
    !archive.savedInBatch &&
    notice !== GONE;

  return (
    <ShoeboxDialogSuspended value={session.state === "checking"}>
      <main
        ref={worldRef}
        className="archive-page shoebox-world"
        data-mischief={motion.reaction ?? undefined}
        data-motion={motion.paused ? "paused" : "running"}
      >
        <section className="shoebox-hero" aria-labelledby="shoebox-title">
          <ShoeboxScene
            reaction={motion.reaction}
            serial={motion.reactionSerial}
          />
          <div className="shoebox-hero-copy">
            <Link href="/" prefetch={false} className="shoebox-back">
              ← Correos imposibles
            </Link>
            <p className="journal-eyebrow">Todo esto es culpa nuestra</p>
            <h1 id="shoebox-title">
              Departamento
              <br />
              <em>de cosas que nos pasan</em>
            </h1>
            <p>Recuerdos ligeramente desordenados. Solo para nosotros dos.</p>
          </div>
          <div className="shoebox-controls">
            <button
              type="button"
              className="archive-button archive-return shoebox-add"
              onClick={() => {
                setNotice("");
                setDialog({ kind: "compose" });
              }}
              disabled={!hydrated || !valid}
            >
              <Plus aria-hidden="true" size={18} />
              Meter algo en la caja
            </button>
            <button
              type="button"
              className="archive-button shoebox-mischief"
              onClick={motion.mischief}
              disabled={!hydrated}
            >
              <Sparkles aria-hidden="true" size={16} />
              No tocar
            </button>
            <button
              type="button"
              className="archive-button"
              aria-pressed={motion.preferencePaused}
              onClick={motion.togglePause}
              disabled={!hydrated}
            >
              {motion.preferencePaused ? (
                <Play aria-hidden="true" size={16} />
              ) : (
                <Pause aria-hidden="true" size={16} />
              )}
              {motion.preferencePaused
                ? "Reanudar movimiento"
                : "Pausar movimiento"}
            </button>
            <button
              type="button"
              className="archive-button"
              onClick={logout}
              disabled={!hydrated || logoutPending}
            >
              <LogOut aria-hidden="true" size={18} />
              Cerrar la caja
            </button>
          </div>
          <div className="shoebox-status shoebox-private-feedback">
            <p role="status" aria-live="polite">
              {notice}
            </p>
            {showSavedLink && archive.saved && (
              <button
                type="button"
                className="archive-button"
                onClick={() => {
                  if (archive.saved) void viewSaved(archive.saved);
                }}
              >
                Ver recuerdo
              </button>
            )}
            <p role="status" aria-live="polite">
              {logoutMessage}
            </p>
            {motion.reduced && (
              <p className="shoebox-motion-note">
                Tu dispositivo pide menos movimiento: la escena se queda quieta.
              </p>
            )}
          </div>
        </section>

        {session.state === "checking" && (
          <div className="shoebox-gate">
            {session.checkFailed ? (
              <div role="alert" className="grid justify-items-center gap-3">
                <p>
                  No pudimos comprobar que la caja sigue abierta. Revisa la
                  conexión; no mostraremos nada hasta saberlo.
                </p>
                <button
                  type="button"
                  className="archive-button"
                  onClick={() => void session.revalidate()}
                >
                  Comprobar otra vez
                </button>
              </div>
            ) : (
              <p role="status">Comprobando que la caja sigue abierta…</p>
            )}
          </div>
        )}

        <section
          className="shoebox-private"
          aria-labelledby="shoebox-batch-title"
        >
          <h2
            id="shoebox-batch-title"
            ref={headingRef}
            tabIndex={-1}
            className="shoebox-batch-title"
          >
            Los recuerdos de esta caja
          </h2>

          {archive.state === "loading" && archive.page === null && (
            <div className="shoebox-loading">
              <p role="status">Abriendo la caja…</p>
              <div className="shoebox-batch" aria-hidden="true">
                {[0, 1, 2].map((slot) => (
                  <div
                    key={slot}
                    className="shoebox-placeholder"
                    data-shoebox-placeholder
                  />
                ))}
              </div>
            </div>
          )}

          {archive.state === "error" && (
            <div className="archive-state" role="alert">
              <p>{archive.error}</p>
              <button
                type="button"
                className="archive-button"
                onClick={() => archive.refresh()}
              >
                Reintentar
              </button>
            </div>
          )}

          {archive.page !== null && items.length === 0 && (
            <div className="shoebox-empty">
              <svg viewBox="0 0 220 150" aria-hidden="true" focusable="false">
                <path
                  d="M30 60L110 82L190 60L190 120L110 142L30 120Z"
                  fill="#efa080"
                  stroke="#492752"
                  strokeWidth="3"
                />
                <path
                  d="M30 60L110 38L190 60L110 82Z"
                  fill="#fff3cd"
                  stroke="#492752"
                  strokeWidth="3"
                />
                <path d="M110 82V142" stroke="#492752" strokeWidth="3" />
                <path
                  d="M62 128L54 148M158 128L166 148"
                  stroke="#492752"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
              {archive.atNewest ? (
                <>
                  <p className="shoebox-empty-title">
                    Todavía no hay nada en la caja.
                  </p>
                  <p>
                    Usa «Meter algo en la caja» para guardar la primera prueba.
                  </p>
                </>
              ) : (
                <>
                  <p className="shoebox-empty-title">
                    Esta tanda se ha quedado vacía.
                  </p>
                  <p>Puedes volver a recuerdos más recientes o al principio.</p>
                </>
              )}
            </div>
          )}

          {items.length > 0 && (
            <ol className="shoebox-batch" aria-busy={navigating}>
              {items.map((memory) => (
                <MemoryScrap
                  key={memory.id}
                  memory={memory}
                  onOpen={(item) => void openDetail(item)}
                  onCorrect={(item) =>
                    setDialog({ kind: "correct", memory: item })
                  }
                  onRemove={(item) =>
                    setDialog({ kind: "remove", memory: item })
                  }
                  onPlay={claimAudio}
                />
              ))}
            </ol>
          )}

          {archive.page !== null && (
            <nav className="shoebox-pager" aria-label="Tandas de recuerdos">
              <p
                role="status"
                aria-live="polite"
                className="shoebox-pager-status"
              >
                {navigating ? "Buscando otra tanda…" : ""}
              </p>
              {archive.errorDuring === "navigate" && archive.error && (
                <p role="alert" className="shoebox-pager-error">
                  {archive.error}
                </p>
              )}
              <div className="shoebox-pager-buttons">
                <button
                  type="button"
                  className="archive-button"
                  onClick={() => page("previous")}
                  disabled={!archive.hasPrevious}
                >
                  Recuerdos más recientes
                </button>
                <button
                  type="button"
                  className="archive-button"
                  onClick={() => page("older")}
                  disabled={!archive.page.nextCursor}
                >
                  Recuerdos anteriores
                </button>
                <button
                  type="button"
                  className="archive-button"
                  onClick={() => page("restart")}
                >
                  Volver al principio
                </button>
              </div>
              {archive.truncated &&
                !archive.hasPrevious &&
                !archive.atNewest && (
                  <p className="shoebox-pager-note">
                    Hemos olvidado el camino de vuelta tanda a tanda; «Volver al
                    principio» te lleva a lo más nuevo.
                  </p>
                )}
            </nav>
          )}

          {dialog.kind === "detail" && (
            <MemoryDialog
              memory={dialog.memory}
              onClose={closeDialog}
              onPlay={claimAudio}
            />
          )}
          {dialog.kind === "correct" && (
            <MemoryCorrection
              memory={dialog.memory}
              onClose={closeDialog}
              getOne={archive.getOne}
              onUnauthorized={session.expire}
              onCorrected={(memory) => {
                if (!currentAuthority()) return;
                archive.onCorrected(memory);
                setDialog((current) =>
                  current.kind === "correct" && current.memory.id === memory.id
                    ? NONE
                    : current,
                );
              }}
              onGone={(id) => {
                if (!currentAuthority()) return;
                setDialog(NONE);
                setNotice(GONE);
                dropFromBatch(id, "heading");
              }}
            />
          )}
          {dialog.kind === "remove" && (
            <RemovalConfirmation
              memory={dialog.memory}
              onClose={closeDialog}
              getOne={archive.getOne}
              onUnauthorized={session.expire}
              onRemoved={(id) => {
                if (!currentAuthority()) return;
                setDialog((current) =>
                  current.kind === "remove" && current.memory.id === id
                    ? NONE
                    : current,
                );
                dropFromBatch(id, "adjacent");
              }}
            />
          )}
        </section>

        <MemoryComposer
          open={composing}
          sessionValid={session.state !== "expired"}
          onSaved={(memory) => {
            if (!currentAuthority()) return false;
            setDialog(NONE);
            setNotice(savedMessage(memory));
            archive.onSaved(memory);
          }}
          onClose={closeDialog}
          onUnauthorized={session.expire}
          onReauthenticate={session.reopened}
          onRecordingChange={setRecording}
        />
      </main>
    </ShoeboxDialogSuspended>
  );
}
