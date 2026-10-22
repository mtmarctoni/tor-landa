"use client";

import { useEffect, useState } from "react";
import {
  deriveIpadCountdown,
  type IpadCountdownModel,
} from "@/utils/ipadCountdown";

export function useIpadCountdown(
  config: unknown,
  revealOpen: boolean,
): IpadCountdownModel | null {
  const [model, setModel] = useState<IpadCountdownModel | null>(null);
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    function refreshIpadCountdown() {
      clearTimeout(timeout);
      timeout = undefined;
      if (document.hidden) return;
      const now = Date.now();
      const next = deriveIpadCountdown(config, now);
      setModel(next);
      const ticking =
        next.content === "pending" &&
        (next.placement === "inline" ||
          (next.placement === "reveal" && revealOpen));
      const minuteAt = ticking ? now + 60_000 - (now % 60_000) : Infinity;
      const updateAt = Math.min(next.nextBoundaryAt ?? Infinity, minuteAt);
      if (Number.isFinite(updateAt)) {
        timeout = setTimeout(
          refreshIpadCountdown,
          Math.min(2_147_483_647, Math.max(1, updateAt - now)),
        );
      }
    }
    refreshIpadCountdown();
    document.addEventListener("visibilitychange", refreshIpadCountdown);
    window.addEventListener("focus", refreshIpadCountdown);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", refreshIpadCountdown);
      window.removeEventListener("focus", refreshIpadCountdown);
    };
  }, [config, revealOpen]);
  return model;
}
