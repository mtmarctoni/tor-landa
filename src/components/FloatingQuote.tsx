"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQualityContext } from "@/context/QualityContext";

const CYCLE_MS = 25_000;
const INITIAL_DELAY_MS = 4_000;
const EXPAND_AUTO_DISMISS_MS = 4_000;
const CONFETTI_COUNT = 22;
const CONFETTI_COLORS = [
  "#6dd5ed",
  "#38bdf8",
  "#fda4af",
  "#fbbf24",
  "#f9a8d4",
  "#a78bfa",
  "#9eceff",
];

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

interface Particle {
  id: number;
  color: string;
  tx: number;
  ty: number;
  size: number;
  delay: number;
  rotation: number;
}

function generateParticles(): Particle[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    tx: randomBetween(-80, 80),
    ty: randomBetween(-90, 30),
    size: randomBetween(4, 8),
    delay: randomBetween(0, 0.15),
    rotation: randomBetween(360, 720),
  }));
}

export default function FloatingQuote() {
  const { qualities } = useQualityContext();
  const [quote, setQuote] = useState<string | null>(null);
  const [top, setTop] = useState(40);
  const [key, setKey] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const lastRef = useRef<string | null>(null);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = useCallback(() => {
    if (qualities.length === 0) return;
    const next = qualities[Math.floor(Math.random() * qualities.length)];
    lastRef.current = next.message;
    setQuote(next.message);
    setTop(25 + Math.random() * 50);
    setKey((k) => k + 1);
    setIsExpanded(false);
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

  const collapse = useCallback(() => {
    setIsExpanded(false);
    if (autoDismissRef.current) {
      clearTimeout(autoDismissRef.current);
      autoDismissRef.current = null;
    }
  }, []);

  const expand = useCallback(() => {
    setIsExpanded(true);
    setParticles(generateParticles());

    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    autoDismissRef.current = setTimeout(collapse, EXPAND_AUTO_DISMISS_MS);
  }, [collapse]);

  const handleInteract = useCallback(() => {
    if (isExpanded) {
      collapse();
    } else {
      expand();
    }
  }, [isExpanded, collapse, expand]);

  const handlePointerEnter = useCallback(() => {
    if (!isExpanded) expand();
  }, [isExpanded, expand]);

  const handlePointerLeave = useCallback(() => {
    if (isExpanded) collapse();
  }, [isExpanded, collapse]);

  useEffect(() => {
    if (!isExpanded) return;

    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".floating-quote-wrapper")) {
        collapse();
      }
    };

    document.addEventListener("click", handleDocClick);
    return () => document.removeEventListener("click", handleDocClick);
  }, [isExpanded, collapse]);

  useEffect(() => {
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, []);

  if (!quote) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      style={{ zIndex: 5 }}
    >
      <button
        key={key}
        type="button"
        className={`floating-quote-wrapper floating-quote absolute px-4 font-serif text-[0.95rem] italic leading-snug sm:text-sm ${
          isExpanded ? "expanded" : ""
        }`}
        style={{ top: `${top}%` }}
        onClick={handleInteract}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        {quote}
        {isExpanded && (
          <span className="confetti-container">
            {particles.map((p) => (
              <span
                key={p.id}
                className="confetti-particle"
                style={
                  {
                    "--tx": `${p.tx}px`,
                    "--ty": `${p.ty}px`,
                    "--rotation": `${p.rotation}deg`,
                    backgroundColor: p.color,
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    animationDelay: `${p.delay}s`,
                  } as React.CSSProperties
                }
              />
            ))}
          </span>
        )}
      </button>
    </div>
  );
}
