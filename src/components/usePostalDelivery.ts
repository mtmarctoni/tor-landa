"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const preference = "(prefers-reduced-motion: reduce)";
const subscribe = (change: () => void) => {
  const media = window.matchMedia(preference);
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
};
const getSnapshot = () => window.matchMedia(preference).matches;
const getServerSnapshot = () => false;
type Phase = "flight" | "land" | "fold" | "open" | "stamp" | "complete";

/** One bounded timeline per authoritative selection. Timers are also the
 * fail-safe: readable content never depends on animationend being delivered. */
export default function usePostalDelivery(cue: string, available: boolean) {
  const reduced = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [replay, setReplay] = useState(0);
  const identity = `${cue}-${available}-${replay}`;
  const [sequence, setSequence] = useState<{ identity: string; phase: Phase }>({
    identity,
    phase: "flight",
  });
  if (sequence.identity !== identity) {
    setSequence({ identity, phase: "flight" });
  }
  const phase = !available || reduced ? "complete" : sequence.phase;
  const running = available && phase !== "complete";

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const timers: number[] = [];
    const cancel = () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
      observer.disconnect();
    };
    const settleForDialog = () => {
      if (cancelled || !document.querySelector("dialog[open]")) return;
      cancel();
      setSequence((current) =>
        current.identity === identity
          ? { identity, phase: "complete" }
          : current,
      );
    };
    const observer = new MutationObserver(settleForDialog);
    // Modal ownership stays native. Cancel presentation, never move its focus.
    if (document.querySelector("dialog[open]")) {
      settleForDialog();
      return;
    }
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["open"],
      childList: true,
      subtree: true,
    });
    const stages: [number, Phase][] = [
      [950, "land"],
      [1250, "fold"],
      [1600, "open"],
      [2150, "stamp"],
      [2700, "complete"],
    ];
    for (const [delay, next] of stages)
      timers.push(
        window.setTimeout(() => {
          setSequence((current) =>
            !cancelled && current.identity === identity
              ? { identity, phase: next }
              : current,
          );
        }, delay),
      );
    return cancel;
    // Phase changes must not restart the timeline; only cancellation or a new cue does.
  }, [identity, running]);

  useEffect(() => {
    if (reduced) setSequence({ identity, phase: "complete" });
  }, [identity, reduced]);

  return {
    identity,
    phase,
    running,
    opened: !available || ["open", "stamp", "complete"].includes(phase),
    stamped: available && ["stamp", "complete"].includes(phase),
    toggle: () => {
      if (!available) return;
      if (running) setSequence({ identity, phase: "complete" });
      else if (!reduced) setReplay((value) => value + 1);
    },
  };
}
