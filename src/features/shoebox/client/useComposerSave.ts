"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkRequest,
  type SaveDraft,
  type SaveOutcome,
  saveMemory,
} from "@/features/shoebox/client/api";
import type { MemorySummary } from "@/types/shoebox";

export type SavePhase =
  | { name: "editing"; notice?: string }
  | { name: "saving" }
  | { name: "checking" }
  | { name: "uncertain"; cancelled: boolean }
  | { name: "ambiguous" }
  | { name: "conflict"; earlier: boolean }
  | { name: "failed"; message: string; retryable: boolean };

/** Phases where the draft and its Request ID must not change. */
const LOCKED = new Set<SavePhase["name"]>([
  "saving",
  "checking",
  "uncertain",
  "ambiguous",
]);

/**
 * The composer's save phase and Request ID lifecycle (Task 5 contract): one
 * request at a time, read-only status checks after an unknown outcome, and a
 * fresh Request ID only after a known outcome and a draft change, or on the
 * explicit "save as new" choice. A 401 is reported to the session owner; the
 * draft stays in memory.
 */
export function useComposerSave({
  onSaved,
  onUnauthorized,
  sessionValid,
}: {
  onSaved(memory: MemorySummary): boolean | undefined;
  onUnauthorized(): void;
  sessionValid: boolean;
}) {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [phase, setPhase] = useState<SavePhase>({ name: "editing" });
  const inFlight = useRef(false);
  const idSent = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const generation = useRef(0);
  // A later no-write failure cannot rule out an earlier interrupted write.
  const possiblyInFlight = useRef(false);

  const interrupt = useCallback(() => {
    if (!inFlight.current) return;
    generation.current += 1;
    possiblyInFlight.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    inFlight.current = false;
    setPhase({ name: "uncertain", cancelled: true });
  }, []);

  useEffect(() => {
    window.addEventListener("pagehide", interrupt);
    return () => window.removeEventListener("pagehide", interrupt);
  }, [interrupt]);
  useEffect(() => {
    if (!sessionValid) interrupt();
  }, [sessionValid, interrupt]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  /** A draft change after a known outcome gets a fresh Request ID. */
  function changed() {
    if (LOCKED.has(phase.name) || possiblyInFlight.current) return;
    if (idSent.current && !LOCKED.has(phase.name)) {
      idSent.current = false;
      setRequestId(crypto.randomUUID());
    }
    if (phase.name !== "editing") setPhase({ name: "editing" });
  }

  function settle(outcome: SaveOutcome) {
    if (!mounted.current) return;
    switch (outcome.kind) {
      case "saved":
        if (onSaved(outcome.memory) === false) {
          possiblyInFlight.current = true;
          setPhase({ name: "uncertain", cancelled: false });
        } else possiblyInFlight.current = false;
        return;
      case "uncertain":
        possiblyInFlight.current = true;
        if (outcome.cause.code === "UNAUTHORIZED") onUnauthorized();
        setPhase({
          name: "uncertain",
          cancelled: outcome.cause.code === "ABORTED",
        });
        return;
      case "ambiguous":
        setPhase({ name: "ambiguous" });
        return;
      case "conflict":
        possiblyInFlight.current = false;
        setPhase({ name: "conflict", earlier: outcome.memory !== null });
        return;
      case "failed": {
        const { error } = outcome;
        if (possiblyInFlight.current) {
          if (error.code === "UNAUTHORIZED") onUnauthorized();
          setPhase({ name: "uncertain", cancelled: false });
          return;
        }
        if (error.code === "UNAUTHORIZED") {
          onUnauthorized();
          setPhase({ name: "editing" });
          return;
        }
        const wait = error.retryAfterSeconds
          ? ` Espera unos ${Math.ceil(error.retryAfterSeconds)} segundos.`
          : "";
        setPhase({
          name: "failed",
          message: error.message + wait,
          retryable:
            error.code === "UNAVAILABLE" || error.code === "RATE_LIMITED",
        });
      }
    }
  }

  /**
   * One request at a time. "save" reuses the draft's ID (nothing was sent
   * yet, or a known no-write failure such as 503); "retry" after an unknown
   * outcome checks status before resending the same ID; "new" is the explicit
   * choice to store this draft as a separate memory.
   */
  async function send(
    mode: "save" | "retry" | "new",
    buildDraft: (id: string) => SaveDraft | null,
  ) {
    if (inFlight.current || !sessionValid) return;
    if (
      mode === "save" &&
      (LOCKED.has(phase.name) || phase.name === "conflict")
    )
      return;
    let id = requestId;
    if (mode === "new") {
      if (phase.name !== "conflict") return;
      possiblyInFlight.current = false;
      id = crypto.randomUUID();
      setRequestId(id);
    }
    const draft = buildDraft(id);
    if (!draft) return;
    inFlight.current = true;
    idSent.current = true;
    const abort = new AbortController();
    const mine = ++generation.current;
    abortRef.current = abort;
    setPhase(mode === "retry" ? { name: "checking" } : { name: "saving" });
    try {
      const outcome = await saveMemory(draft, {
        signal: abort.signal,
        checkFirst: mode === "retry",
        onReconcile: () => {
          if (
            mounted.current &&
            mine === generation.current &&
            !abort.signal.aborted
          )
            setPhase({ name: "checking" });
        },
      });
      if (mine === generation.current) settle(outcome);
    } finally {
      if (mine === generation.current) inFlight.current = false;
      if (abortRef.current === abort) abortRef.current = null;
    }
  }

  async function checkAgain() {
    if (inFlight.current || !sessionValid) return;
    inFlight.current = true;
    const abort = new AbortController();
    const mine = ++generation.current;
    abortRef.current = abort;
    setPhase({ name: "checking" });
    try {
      const outcome = await checkRequest(requestId, abort.signal);
      if (mine === generation.current) settle(outcome);
    } finally {
      if (mine === generation.current) inFlight.current = false;
      if (abortRef.current === abort) abortRef.current = null;
    }
  }

  return {
    phase,
    setPhase,
    locked: LOCKED.has(phase.name),
    pendingWrite:
      phase.name === "saving" ||
      phase.name === "checking" ||
      phase.name === "uncertain" ||
      phase.name === "ambiguous",
    changed,
    send,
    checkAgain,
    cancel: () => abortRef.current?.abort(),
  };
}
