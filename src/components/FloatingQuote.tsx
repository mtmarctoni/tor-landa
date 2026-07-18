"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQualityContext } from "@/context/QualityContext";

const CYCLE_MS = 25_000;
const INITIAL_DELAY_MS = 4_000;

export default function FloatingQuote() {
  const { qualities } = useQualityContext();
  const [quote, setQuote] = useState<string | null>(null);
  const [top, setTop] = useState(40);
  const [key, setKey] = useState(0);
  const lastRef = useRef<string | null>(null);

  const advance = useCallback(() => {
    if (qualities.length === 0) return;
    const next = qualities[Math.floor(Math.random() * qualities.length)];
    lastRef.current = next.message;
    setQuote(next.message);
    setTop(25 + Math.random() * 50);
    setKey((k) => k + 1);
  }, [qualities]);

  useEffect(() => {
    if (qualities.length === 0) return;

    const timer = setTimeout(advance, INITIAL_DELAY_MS);
    const interval = setInterval(advance, CYCLE_MS);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [qualities, advance]);

  if (!quote) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      style={{ zIndex: 5 }}
    >
      <span
        key={key}
        className="floating-quote absolute max-w-[40ch] whitespace-nowrap px-4 font-serif text-[0.95rem] italic leading-snug sm:text-sm"
        style={{ top: `${top}%` }}
      >
        {quote}
      </span>
    </div>
  );
}
