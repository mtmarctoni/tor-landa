"use client";

import { motion } from "framer-motion";
import { Heart, Star } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { isLandaBirthdayWeek } from "@/utils/dateFormatter";
import {
  birthdayColorCombo,
  qualityColorCombos,
} from "@/utils/qualityColorCombos";
import type { QualityEntry } from "../types";

interface QualityCardProps {
  entry: QualityEntry;
  onSecretClick?: () => void;
}

const QualityCard: React.FC<QualityCardProps> = ({ entry, onSecretClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Check if this is Landa's birthday week
  const isBirthdayWeek = isLandaBirthdayWeek(entry.week, entry.year);

  // Use birthday colors if it's birthday week, otherwise use deterministic random color
  const colorIndex =
    ((entry.week ?? 0) + (entry.year ?? 0)) % qualityColorCombos.length;
  const color = isBirthdayWeek
    ? birthdayColorCombo
    : qualityColorCombos[colorIndex];

  const handleSecretClick = () => {
    if (onSecretClick) {
      onSecretClick();
    }
  };

  // Function to render message with clickable hints
  const renderMessage = (message: string) => {
    if (!isBirthdayWeek) {
      return message;
    }

    // Split by both Berlín and nuestros cuatro números
    const regex = /(Berlín|nuestros cuatro números)/g;
    const parts = message.split(regex);

    return parts.map((part, index) => {
      if (part === "Berlín" || part === "nuestros cuatro números") {
        return (
          <motion.span
            key={index}
            onClick={handleSecretClick}
            className="font-bold cursor-pointer relative inline-block"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              background: "linear-gradient(120deg, #fbbf24 0%, #f59e0b 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              textShadow: "0 0 20px rgba(251, 191, 36, 0.5)",
            }}
          >
            {part}
            <motion.span
              className="absolute -top-1 -right-1 text-xs"
              animate={{
                rotate: [0, 360],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
            >
              ✨
            </motion.span>
          </motion.span>
        );
      }
      return part;
    });
  };

  return (
    <motion.div
      className={`relative flex w-full flex-col items-center justify-center overflow-hidden border-2 px-2 transition-all duration-500 animate-blob-morph
            ${color.border} ${color.shadow} ${color.bg}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      style={{
        minHeight: "320px",
        boxShadow: isBirthdayWeek
          ? "0 0 52px 0 #f8717130, 0 14px 34px -18px #fbbf2455"
          : "0 0 52px 0 #a78bfa24, 0 14px 34px -18px #38bdf855",
      }}
      role="article"
      aria-label={`Mensaje de la semana ${entry.week} del ${entry.year}`}
    >
      {isBirthdayWeek && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-rose-300/85 sm:text-rose-300"
              style={{
                left: `${12 + i * 9}%`,
                top: `${8 + (i % 3) * 28}%`,
              }}
              animate={{
                y: [0, -10, 0],
                rotate: [0, 360],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 3 + i * 0.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.1,
              }}
            >
              {i % 2 === 0 ? (
                <Heart size={18} className="sm:size-5" />
              ) : (
                <Star size={16} className="sm:size-[18px]" />
              )}
            </motion.div>
          ))}
        </motion.div>
      )}

      <div className="relative z-10 flex w-full max-w-[44rem] flex-col items-center justify-center p-5 sm:p-8">
        {isHovered && !isBirthdayWeek && (
          <motion.div
            className="absolute inset-0 pointer-events-none z-30 hidden sm:block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="absolute top-4 right-4 text-dream-200 z-40"
              animate={{
                rotate: [0, 360],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              <Star size={40} />
            </motion.div>
            <motion.div
              className="absolute bottom-4 left-4 text-dream-800 z-40"
              animate={{
                rotate: [0, 360],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              <Star size={40} />
            </motion.div>
          </motion.div>
        )}

        <div className="relative mb-5 w-full max-w-[26rem] px-3 text-center sm:mb-6">
          {isBirthdayWeek && (
            <motion.div
              className="mb-2 text-center text-3xl sm:text-4xl"
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
              }}
            >
              🎂✨🎉
            </motion.div>
          )}
          <h2
            className={`text-center font-serif text-[1.65rem] leading-tight sm:text-3xl ${isBirthdayWeek ? "text-rose-700" : "text-dream-700"} italic drop-shadow-[0_2px_8px_rgba(56,189,248,0.45)]`}
          >
            {isBirthdayWeek
              ? "¡Feliz Cumpleaños, Landa!"
              : `Semana ${entry.week} / ${entry.year}`}
          </h2>
          <div
            className={`mx-auto mt-3 h-0.5 w-full max-w-64 rounded bg-gradient-to-r ${
              isBirthdayWeek
                ? "from-rose-400 via-pink-300 to-amber-400"
                : "from-dream-400 via-dream-200 to-dream-600"
            } sm:max-w-80`}
          ></div>
        </div>

        <motion.div
          className="flex w-full flex-col items-center justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span
            className={`${isBirthdayWeek ? "text-rose-900" : "text-dream-900"} max-w-[34ch] text-balance px-2 text-left text-[1.02rem] leading-7 drop-shadow-[0_1px_3px_rgba(14,165,233,0.18)] sm:px-0 sm:text-center sm:text-xl sm:leading-relaxed`}
          >
            {renderMessage(entry.message)}
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default QualityCard;
