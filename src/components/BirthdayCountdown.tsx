"use client";

import { motion } from "framer-motion";
import { Cake } from "lucide-react";
import type React from "react";
import {
  getDaysUntilLandaBirthday,
  isLandaBirthday,
} from "@/utils/dateFormatter";

const BirthdayCountdown: React.FC = () => {
  const daysUntil = getDaysUntilLandaBirthday();
  const isToday = isLandaBirthday();

  if (daysUntil > 30 && !isToday) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      className="birthday-countdown mb-4 text-center"
      role="status"
      aria-live="polite"
    >
      <motion.div className="inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 shadow-lg">
        <Cake size={20} aria-hidden="true" />
        <span className="text-sm font-semibold">
          {isToday
            ? "¡Hoy es el cumpleaños de Landa!"
            : `${daysUntil} ${daysUntil === 1 ? "dia" : "dias"} para el cumpleanos de Landa`}
        </span>
      </motion.div>
    </motion.div>
  );
};

export default BirthdayCountdown;
