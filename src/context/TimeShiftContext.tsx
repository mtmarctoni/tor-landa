"use client";

import React, {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { type TimePeriod, useTimeOfDay } from "@/hooks/useTimeOfDay";

interface TimeShiftContextType {
  period: TimePeriod;
  hour: number;
}

const TimeShiftContext = createContext<TimeShiftContextType | undefined>(
  undefined,
);

export const useTimeShift = () => {
  const context = useContext(TimeShiftContext);
  if (context === undefined) {
    throw new Error("useTimeShift must be used within a TimeShiftProvider");
  }
  return context;
};

interface TimeShiftProviderProps {
  children: ReactNode;
}

export const TimeShiftProvider: React.FC<TimeShiftProviderProps> = ({
  children,
}) => {
  const { period: realPeriod, hour: realHour } = useTimeOfDay();

  const [override, setOverride] = useState<TimePeriod | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("time");
    if (t && ["dawn", "day", "dusk", "night"].includes(t)) {
      setOverride(t as TimePeriod);
    }
  }, []);

  const period = override ?? realPeriod;
  const hour = override
    ? { dawn: 6, day: 12, dusk: 18, night: 22 }[override]
    : realHour;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-time", period);

    return () => {
      root.removeAttribute("data-time");
    };
  }, [period]);

  const value = useMemo(() => ({ period, hour }), [period, hour]);

  return (
    <TimeShiftContext.Provider value={value}>
      {children}
    </TimeShiftContext.Provider>
  );
};
