"use client";

import { Heart } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import AmorEasterEggModal from "./AmorEasterEggModal";

const EasterEggKeyboardListener: React.FC = () => {
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const sequence = useRef("");
  const lastKeyTime = useRef(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        document.querySelector("dialog[open]") ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing ||
        (event.target instanceof HTMLElement &&
          (event.target.isContentEditable ||
            event.target.closest("input, textarea, select")))
      ) {
        sequence.current = "";
        return;
      }
      const now = Date.now();
      if (now - lastKeyTime.current > 3000) sequence.current = "";
      lastKeyTime.current = now;
      const key = event.key.toLowerCase();
      sequence.current = "amor".startsWith(sequence.current + key)
        ? sequence.current + key
        : key === "a"
          ? "a"
          : "";
      if (sequence.current === "amor") {
        sequence.current = "";
        setShowEasterEgg(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        className="journal-surprise journal-amor-trigger"
        aria-label="Abrir un momento especial"
        title="Abrir un momento especial"
        onClick={() => setShowEasterEgg(true)}
      >
        <Heart size={21} strokeWidth={1.3} aria-hidden="true" />
      </button>
      {showEasterEgg && (
        <AmorEasterEggModal onClose={() => setShowEasterEgg(false)} />
      )}
    </>
  );
};

export default EasterEggKeyboardListener;
