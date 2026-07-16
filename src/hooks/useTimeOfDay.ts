"use client";

import { useEffect, useMemo, useState } from "react";

export type TimePeriod = "dawn" | "day" | "dusk" | "night";

interface TimeState {
  period: TimePeriod;
  hour: number;
}

function resolvePeriod(hour: number): TimePeriod {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 18) return "day";
  if (hour >= 18 && hour < 21) return "dusk";
  return "night";
}

export function useTimeOfDay(): TimeState {
  const [state, setState] = useState<TimeState>(() => {
    const now = new Date();
    return { period: resolvePeriod(now.getHours()), hour: now.getHours() };
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hour = now.getHours();
      setState({ period: resolvePeriod(hour), hour });
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  return useMemo(() => state, [state]);
}
