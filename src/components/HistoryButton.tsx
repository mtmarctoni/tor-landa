"use client";

import { motion } from "framer-motion";
import { History } from "lucide-react";
import Link from "next/link";
import type React from "react";

const HistoryButton: React.FC = () => {
  return (
    <motion.div
      className="sticky bottom-4 z-30 mt-3 self-end sm:fixed sm:bottom-auto sm:right-6 sm:top-6 sm:mt-0"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1, duration: 0.4 }}
    >
      <Link href="/history">
        <motion.button
          className="inline-flex items-center gap-2 rounded-full border border-dream-300 bg-white/88 px-4 py-3 text-sm font-semibold text-dream-800 shadow-[0_18px_35px_-24px_rgba(18,49,79,0.65)] backdrop-blur-md transition-all duration-300 hover:bg-dream-100 hover:shadow-xl sm:bg-dream-200 sm:p-4 sm:text-base"
          whileHover={{
            scale: 1.06,
            boxShadow:
              "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          }}
          whileTap={{ scale: 0.95 }}
          title="Ver historia completa de cualidades"
          aria-label="Ver historia completa"
        >
          <History size={20} className="sm:size-6" />
          <span className="sm:sr-only">Historia completa</span>
        </motion.button>
      </Link>
    </motion.div>
  );
};

export default HistoryButton;
