"use client";

import { useState } from "react";
import { useQualityContext } from "@/context/QualityContext";

export default function FloatingQuote() {
  const { qualities, loading, error } = useQualityContext();
  const [quote, setQuote] = useState<string | null>(null);

  if (loading || error || qualities.length === 0) return null;

  return (
    <details
      className="journal-details journal-memory"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          setQuote(
            qualities[Math.floor(Math.random() * qualities.length)].message,
          );
        }
      }}
    >
      <summary>Un recuerdo al azar</summary>
      <p
        data-testid="memory-message"
        className="whitespace-pre-wrap break-words py-4 text-base leading-8"
      >
        {quote}
      </p>
    </details>
  );
}
