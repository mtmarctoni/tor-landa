"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** The only thing the shoebox keeps in browser storage: a motion preference. */
export const MOTION_STORAGE_KEY = "tor-landa:shoebox-motion-paused";
/** Every reaction settles well under three seconds. */
export const MISCHIEF_MS = 2_400;

export type Mischief = "moon" | "legs" | "stamp" | "jars";
const ORDER: readonly Mischief[] = ["moon", "legs", "stamp", "jars"];

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (change: () => void) => {
  const media = window.matchMedia(REDUCED);
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
};
const reducedSnapshot = () => window.matchMedia(REDUCED).matches;
const serverReduced = () => false;

const subscribeVisibility = (change: () => void) => {
  document.addEventListener("visibilitychange", change);
  return () => document.removeEventListener("visibilitychange", change);
};
const hiddenSnapshot = () => document.visibilityState === "hidden";
const serverHidden = () => false;

/** Any native modal on the page, including inherited footer surprises. */
const subscribeDialogs = (change: () => void) => {
  const observer = new MutationObserver(change);
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["open"],
    childList: true,
    subtree: true,
  });
  return () => observer.disconnect();
};
const dialogSnapshot = () => document.querySelector("dialog[open]") !== null;
const serverDialog = () => false;

function readPreference(): boolean {
  try {
    return window.localStorage.getItem(MOTION_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writePreference(paused: boolean) {
  try {
    if (paused) window.localStorage.setItem(MOTION_STORAGE_KEY, "1");
    else window.localStorage.removeItem(MOTION_STORAGE_KEY);
  } catch {
    // Storage blocked: the preference lasts for this page only.
  }
}

/**
 * Ambient motion and the "No tocar" reaction for the shoebox route.
 *
 * `paused` is true when the person paused motion, the system asks for reduced
 * motion, a native dialog is open anywhere on the page, a recording runs or
 * the tab is hidden. Root data attributes let the route stylesheet pause
 * every inherited CSS animation on this page; they are removed on route exit.
 * One reaction at a time: a new press replaces the running one, and each
 * settles by itself after MISCHIEF_MS. When paused or reduced, the reaction
 * shows only its static punchline.
 */
export function useShoeboxMotion({
  dialogOpen,
  recording,
}: {
  dialogOpen: boolean;
  recording: boolean;
}) {
  const reduced = useSyncExternalStore(
    subscribeReduced,
    reducedSnapshot,
    serverReduced,
  );
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    hiddenSnapshot,
    serverHidden,
  );
  const anyDialog = useSyncExternalStore(
    subscribeDialogs,
    dialogSnapshot,
    serverDialog,
  );
  // Read after mount only, so server and first client render agree.
  const [preference, setPreference] = useState(false);
  useEffect(() => setPreference(readPreference()), []);

  const [reaction, setReaction] = useState<{
    kind: Mischief;
    serial: number;
  } | null>(null);
  const presses = useRef(0);

  const paused =
    preference || reduced || hidden || dialogOpen || anyDialog || recording;

  useEffect(() => {
    if (!reaction) return;
    const timer = window.setTimeout(() => setReaction(null), MISCHIEF_MS);
    return () => window.clearTimeout(timer);
  }, [reaction]);

  // A dialog or recording mid-reaction ends it at once.
  const interrupted = dialogOpen || anyDialog || recording || hidden;
  useEffect(() => {
    if (interrupted) setReaction(null);
  }, [interrupted]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-shoebox-motion", paused ? "paused" : "running");
    root.toggleAttribute("data-shoebox-reduced", reduced);
  }, [paused, reduced]);
  useEffect(
    () => () => {
      const root = document.documentElement;
      root.removeAttribute("data-shoebox-motion");
      root.removeAttribute("data-shoebox-reduced");
    },
    [],
  );

  return {
    paused,
    reduced,
    preferencePaused: preference,
    reaction: reaction?.kind ?? null,
    reactionSerial: reaction?.serial ?? 0,
    togglePause() {
      setPreference((current) => {
        writePreference(!current);
        return !current;
      });
    },
    mischief() {
      if (interrupted) return;
      presses.current += 1;
      const serial = presses.current;
      setReaction({
        kind: ORDER[(serial - 1) % ORDER.length] ?? "moon",
        serial,
      });
    },
  };
}
