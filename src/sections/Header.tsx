"use client";

import { motion } from "framer-motion";
import { Cloud, Moon, Star } from "lucide-react";
import type React from "react";

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-20 overflow-hidden border-b border-white/45 bg-white/32 px-3 py-3 backdrop-blur-xl sm:px-4 sm:py-4">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-center">
        <div className="relative flex min-h-[4.5rem] w-full items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/35 bg-gradient-to-r from-white/45 via-white/15 to-dream-100/35 px-5 py-4 shadow-[0_16px_40px_-32px_rgba(18,49,79,0.65)] sm:min-h-[5.25rem] sm:px-8">
          <motion.div
            className="absolute right-4 top-2 text-dream-500/80 sm:right-8 sm:top-3"
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
            className="absolute bottom-2 left-4 text-dream-300/85 sm:left-8"
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
            className="absolute left-6 top-3 hidden text-dream-500/80 sm:block"
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
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-dream-600/85 sm:text-[0.72rem]">
              Archivo onírico semanal
            </p>
            <h1 className="text-balance text-[1.85rem] font-serif italic leading-none tracking-tight text-dream-900 sm:text-4xl md:text-5xl">
              Cualidades de Landa
            </h1>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
