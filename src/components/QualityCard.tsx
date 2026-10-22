"use client";

import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import { isLandaBirthdayWeek } from "@/utils/dateFormatter";
import type { QualityEntry } from "../types";

interface QualityCardProps {
  entry: QualityEntry;
  onSecretClick?: () => void;
}

const QualityCard: FC<QualityCardProps> = ({ entry, onSecretClick }) => {
  const reducedMotion = useReducedMotion();
  const [dance, setDance] = useState(0);
  const [flourish, setFlourish] = useState(false);
  useEffect(() => {
    if (!dance) return;
    setFlourish(true);
    const timer = window.setTimeout(() => setFlourish(false), 1250);
    return () => window.clearTimeout(timer);
  }, [dance]);
  const reaction = useAnimationControls();
  const isBirthdayWeek = isLandaBirthdayWeek(entry.week, entry.year);
  const isBerlinBirthdayWeek = isBirthdayWeek && entry.year === 2025;
  const message = isBerlinBirthdayWeek
    ? entry.message
        .split(/(Berlín|nuestros cuatro números)/g)
        .map((part, index) =>
          part === "Berlín" || part === "nuestros cuatro números" ? (
            <button
              type="button"
              className="journal-hint"
              onClick={onSecretClick}
              key={index}
            >
              {part}
            </button>
          ) : (
            part
          ),
        )
    : entry.message;

  return (
    <motion.article
      className="journal-note"
      data-testid="message-reaction"
      animate={reaction}
      aria-label={`Mensaje de la semana ${entry.week} del ${entry.year}`}
    >
      <div
        className="dream-message-shell"
        data-testid="message-shell"
        aria-hidden="true"
      />
      {flourish && (
        <span
          key={dance}
          className="dream-flourish"
          data-testid="dream-flourish"
          aria-hidden="true"
        >
          <i />
          <i />
          <i />
        </span>
      )}
      <div className="dream-note-top">
        <span className="dream-note-label">
          Un poquito de ti, un mundo entero
        </span>
        <button
          type="button"
          className="dream-dance"
          aria-label="Hacer bailar el mensaje"
          onClick={() => {
            setDance((value) => value + 1);
            if (!reducedMotion)
              void reaction.start({
                scale: [1, 1.025, 0.99, 1],
                transition: { duration: 0.85 },
              });
          }}
        >
          <Sparkles size={20} aria-hidden="true" />
        </button>
      </div>
      <span className="journal-note-mark" aria-hidden="true">
        “
      </span>
      {isBirthdayWeek && (
        <h2 className="journal-birthday-title">¡Feliz Cumpleaños, Landa!</h2>
      )}
      <p data-testid="quality-message" className="journal-message">
        {message}
      </p>
      <p
        className="dream-dance-status"
        role="status"
        aria-label="Juego del mensaje"
        aria-live="polite"
      >
        {dance
          ? "Las palabras también saben bailar."
          : "Toca la estrella. Aquí todo puede pasar."}
      </p>
    </motion.article>
  );
};

export default QualityCard;
