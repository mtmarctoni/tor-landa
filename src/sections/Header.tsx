"use client";

import { motion } from "framer-motion";
import { Cloud, Moon, Star } from "lucide-react";
import type React from "react";

const Header: React.FC = () => {
  return (
    <header className="time-header sticky top-0 z-20 overflow-hidden border-b border-white/45 px-3 py-3 backdrop-blur-xl sm:px-4 sm:py-4">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-center">
        <div
          className="time-surface-card relative flex min-h-[4.5rem] w-full items-center justify-center overflow-hidden rounded-[1.75rem] border px-5 py-4 shadow-[0_16px_40px_-32px_rgba(18,49,79,0.65)] sm:min-h-[5.25rem] sm:px-8"
          style={{
            background:
              "linear-gradient(to right, rgba(255,255,255,0.45), rgba(255,255,255,0.15), var(--time-glow))",
          }}
        >
          <motion.div
            className="absolute right-4 top-2 sm:right-8 sm:top-3"
            style={{ color: "var(--time-glow)" }}
            animate={{
              y: [0, -10, 0],
              rotate: [0, 5, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Moon size={18} className="sm:size-6" />
          </motion.div>

          <motion.div
            className="absolute bottom-2 left-4 opacity-70 sm:left-8"
            style={{ color: "var(--time-orb-2)" }}
            animate={{
              x: [0, 10, 0],
              y: [0, 5, 0],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Cloud size={16} className="sm:size-5" />
          </motion.div>

          <motion.div
            className="absolute left-6 top-3 hidden sm:block"
            style={{ color: "var(--time-orb-1)" }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Star size={16} />
          </motion.div>

          <div className="relative z-10 flex flex-col items-center gap-1 text-center">
            <p
              className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] opacity-70 sm:text-[0.72rem]"
              style={{ color: "var(--time-text-muted)" }}
            >
              Archivo onírico semanal
            </p>
            <h1
              className="text-balance text-[1.85rem] font-serif italic leading-none tracking-tight sm:text-4xl md:text-5xl"
              style={{ color: "var(--time-text)" }}
            >
              Cualidades de Landa
            </h1>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
