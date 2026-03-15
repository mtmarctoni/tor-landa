"use client";

import React from "react";
import { motion } from "framer-motion";
import { Cake } from "lucide-react";
import { getDaysUntilLandaBirthday, isLandaBirthday } from "@/utils/dateFormatter";

const BirthdayCountdown: React.FC = () => {
  const daysUntil = getDaysUntilLandaBirthday();
  const isToday = isLandaBirthday();

  if (daysUntil > 30 && !isToday) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 text-center"
      role="status"
      aria-live="polite"
    >
      <motion.div
        className="inline-flex items-center gap-2 rounded-full border-2 border-rose-300 bg-gradient-to-r from-rose-100 via-pink-100 to-amber-100 px-4 py-2 shadow-lg"
        animate={{ scale: isToday ? [1, 1.05, 1] : 1 }}
        transition={{ duration: 1, repeat: isToday ? Infinity : 0 }}
      >
        <Cake className="text-rose-500" size={20} aria-hidden="true" />
        <span className="text-sm font-semibold text-rose-700">
          {isToday
            ? "🎉 ¡Hoy es el cumpleaños de Landa! 🎉"
            : `${daysUntil} ${daysUntil === 1 ? "dia" : "dias"} para el cumpleanos de Landa`}
        </span>
      </motion.div>
    </motion.div>
  );
};

export default BirthdayCountdown;
