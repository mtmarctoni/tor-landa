"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ShoeboxApiError, shoeboxFetch } from "@/features/shoebox/client/api";

export type SessionState = "checking" | "valid" | "expired";

const LOGIN_PATH = "/shoebox/login";
/** Recheck interval once the server says the session is still valid. */
const SESSION_RECHECK_MS = 60_000;
/** setTimeout overflows above 2^31 - 1 ms (about 24.8 days). */
const MAX_TIMER_MS = 2_147_483_647;
/** Automatic retries after a failed check while the gate is closed. */
const RETRY_DELAYS_MS = [3_000, 10_000, 30_000] as const;

/** Route-owned attribute on <html>; shoebox.css hides private surfaces. */
const GATE_ATTRIBUTE = "data-shoebox-gate";

function setGate(value: "open" | "closed" | "expired") {
  document.documentElement.setAttribute(GATE_ATTRIBUTE, value);
}

type CheckResult =
  | { kind: "valid"; expiresAt: number }
  | { kind: "expired" }
  | { kind: "failed" };

async function confirmSession(): Promise<CheckResult> {
  try {
    const session = await shoeboxFetch<{ expiresAt: number }>(
      "/api/shoebox/session",
    );
    if (
      typeof session?.expiresAt !== "number" ||
      !Number.isFinite(session.expiresAt)
    ) {
      return { kind: "failed" };
    }
    return { kind: "valid", expiresAt: session.expiresAt };
  } catch (error) {
    return error instanceof ShoeboxApiError && error.code === "UNAUTHORIZED"
      ? { kind: "expired" }
      : { kind: "failed" };
  }
}

export type SessionEvents = {
  /** The tab was hidden (the gate is already closed). Pause media. */
  onHidden?(): void;
  /** pagehide: the page may enter the bfcache. Drop private rendering. */
  onPageHide?(): void;
  /** Just before the full navigation of a logout. Drop everything. */
  onLeave?(): void;
};

/**
 * Client session gate. The server verified the session before rendering, so
 * it starts valid. Expiry is confirmed with the server before acting (the
 * client clock may run ahead); only a 401 ends it. Hiding the tab or leaving
 * the page closes the gate synchronously through a DOM attribute, before any
 * React work, and it reopens only after the server confirms the session
 * again. A failed check keeps it closed (fail-closed), never presumed valid.
 */
export function useShoeboxSession(
  initialExpiresAt: number,
  events: SessionEvents = {},
) {
  const [state, setState] = useState<SessionState>("valid");
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [checkFailed, setCheckFailed] = useState(false);
  /** Any newer check, hide or explicit transition outranks older results. */
  const generation = useRef(0);
  const retry = useRef({ timer: 0, attempt: 0 });
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  });

  useLayoutEffect(() => {
    setGate(
      state === "valid" ? "open" : state === "expired" ? "expired" : "closed",
    );
  }, [state]);
  useEffect(
    () => () => {
      document.documentElement.removeAttribute(GATE_ATTRIBUTE);
      window.clearTimeout(retry.current.timer);
      generation.current += 1;
    },
    [],
  );

  const settle = useCallback((result: CheckResult, reveal: () => void) => {
    if (result.kind === "valid") {
      retry.current.attempt = 0;
      setCheckFailed(false);
      setExpiresAt(result.expiresAt);
      reveal();
      return;
    }
    if (result.kind === "expired") {
      setCheckFailed(false);
      setState("expired");
      return;
    }
    // Fail closed: private content stays hidden until a check succeeds.
    setGate("closed");
    setState("checking");
    setCheckFailed(true);
    const delay =
      RETRY_DELAYS_MS[
        Math.min(retry.current.attempt, RETRY_DELAYS_MS.length - 1)
      ];
    retry.current.attempt += 1;
    retry.current.timer = window.setTimeout(
      () => void revalidateRef.current(),
      delay,
    );
  }, []);

  /** Closes the gate and reopens it only after a successful server check. */
  const revalidate = useCallback(async () => {
    generation.current += 1;
    const mine = generation.current;
    window.clearTimeout(retry.current.timer);
    setGate("closed");
    setState((current) => (current === "expired" ? current : "checking"));
    const result = await confirmSession();
    if (mine !== generation.current) return;
    settle(result, () => setState("valid"));
  }, [settle]);
  const revalidateRef = useRef(revalidate);
  revalidateRef.current = revalidate;

  // Expiry timer: a quiet server confirmation while the gate is open.
  useEffect(() => {
    if (state !== "valid") return;
    let timer = 0;
    const schedule = (ms: number) => {
      timer = window.setTimeout(run, Math.min(MAX_TIMER_MS, Math.max(0, ms)));
    };
    async function run() {
      generation.current += 1;
      const mine = generation.current;
      const result = await confirmSession();
      if (mine !== generation.current) return;
      if (result.kind === "valid") {
        retry.current.attempt = 0;
        if (result.expiresAt !== expiresAt) setExpiresAt(result.expiresAt);
        // A local clock ahead of the server: wait, do not loop.
        schedule(
          Math.max(SESSION_RECHECK_MS, result.expiresAt * 1000 - Date.now()),
        );
        return;
      }
      settle(result, () => setState("valid"));
    }
    schedule(expiresAt * 1000 - Date.now());
    return () => window.clearTimeout(timer);
  }, [state, expiresAt, settle]);

  useEffect(() => {
    const hide = () => {
      // Synchronous, before React: nothing private stays painted.
      setGate("closed");
      generation.current += 1;
      window.clearTimeout(retry.current.timer);
      setState((current) => (current === "expired" ? current : "checking"));
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hide();
        eventsRef.current.onHidden?.();
      } else {
        void revalidateRef.current();
      }
    };
    const onPageHide = () => {
      hide();
      eventsRef.current.onPageHide?.();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void revalidateRef.current();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  /** A 401 from any request: the session is over (drafts stay in memory). */
  const expire = useCallback(() => {
    generation.current += 1;
    window.clearTimeout(retry.current.timer);
    setState("expired");
  }, []);

  /** Inline reauthentication succeeded with this new expiry. */
  const reopened = useCallback((nextExpiresAt: number) => {
    generation.current += 1;
    window.clearTimeout(retry.current.timer);
    retry.current.attempt = 0;
    setCheckFailed(false);
    setExpiresAt(nextExpiresAt);
    setState("valid");
  }, []);

  /** Ends the session on the server, then leaves with a full navigation. */
  const logout = useCallback(async () => {
    await shoeboxFetch("/api/shoebox/logout", { method: "POST" });
    generation.current += 1;
    setGate("closed");
    eventsRef.current.onLeave?.();
    window.location.replace(LOGIN_PATH);
  }, []);

  return {
    state,
    expiresAt,
    checkFailed,
    revalidate,
    logout,
    expire,
    reopened,
  };
}
