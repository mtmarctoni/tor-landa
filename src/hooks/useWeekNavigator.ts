"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { QualityEntry } from "@/types";
import { getCurrentWeekAndYear } from "@/utils/dateFormatter";

const STORAGE_KEY = "tor-landa:last-viewed-week";

const getInitialWeekState = () => {
  const { week, year } = getCurrentWeekAndYear();
  return { week, year };
};

const normalizeWeek = (value: number) => {
  if (value < 1) return 1;
  if (value > 53) return 53;
  return value;
};

export const useWeekNavigator = (qualities: QualityEntry[]) => {
  const initial = getInitialWeekState();
  const [week, setWeek] = useState(initial.week);
  const [year, setYear] = useState(initial.year);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as { week?: number; year?: number };
      const { week, year } = parsed;
      if (typeof week !== "number" || typeof year !== "number") {
        return;
      }

      queueMicrotask(() => {
        setWeek(normalizeWeek(week));
        setYear(year);
      });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ week: normalizeWeek(week), year })
    );
  }, [week, year]);

  const goToCurrentWeek = useCallback(() => {
    const now = getCurrentWeekAndYear();
    setDirection(0);
    setWeek(now.week);
    setYear(now.year);
  }, []);

  const goToRandomSavedWeek = useCallback(() => {
    if (qualities.length === 0) return;

    const randomEntry = qualities[Math.floor(Math.random() * qualities.length)];
    setDirection(0);
    setWeek(randomEntry.week);
    setYear(randomEntry.year);
  }, [qualities]);

  const goToWeek = useCallback((nextWeek: number, nextYear: number) => {
    setDirection(0);
    setWeek(normalizeWeek(nextWeek));
    setYear(nextYear);
  }, []);

  const goToPreviousWeek = useCallback(() => {
    setDirection(-1);
    setWeek((prevWeek) => {
      if (prevWeek > 1) return prevWeek - 1;

      setYear((prevYear) => prevYear - 1);
      return 52;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setDirection(1);
    setWeek((prevWeek) => {
      if (prevWeek < 53) return prevWeek + 1;

      setYear((prevYear) => prevYear + 1);
      return 1;
    });
  }, []);

  const isCurrentWeek = useMemo(() => {
    const now = getCurrentWeekAndYear();
    return week === now.week && year === now.year;
  }, [week, year]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPreviousWeek();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNextWeek();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPreviousWeek, goToNextWeek]);

  return {
    week,
    year,
    direction,
    isCurrentWeek,
    goToCurrentWeek,
    goToWeek,
    goToPreviousWeek,
    goToNextWeek,
    goToRandomSavedWeek,
  };
};
