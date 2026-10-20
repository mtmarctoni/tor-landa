"use client";

import { motion } from "framer-motion";
import { History } from "lucide-react";
import Link from "next/link";
import type React from "react";

const HistoryButton: React.FC = () => {
  return (
    <motion.div
      className="col-span-2 self-center sm:col-span-1"
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1, duration: 0.4 }}
    >
      <Link
        href="/history"
        className="inline-flex items-center gap-2 rounded-full border border-dream-300 bg-white/88 px-4 py-3 text-sm font-semibold text-dream-800 shadow-sm backdrop-blur-md transition-all duration-300 hover:bg-dream-100 sm:px-5 sm:py-2 sm:text-base"
        title="Ver historia completa de cualidades"
      >
        <History size={20} aria-hidden="true" />
        <span>Historia completa</span>
      </Link>
    </motion.div>
  );
};

export default HistoryButton;
