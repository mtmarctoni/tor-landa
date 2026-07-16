"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type React from "react";
import { useState } from "react";

import EasterEggModal from "@/components/EasterEggModal";
import FloatingIcons from "@/components/FloatingIcons";

const Footer: React.FC = () => {
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const handleClick = () => setShowEasterEgg(true);
  const handleClose = () => setShowEasterEgg(false);

  return (
    <footer className="mt-10 border-t border-white/35 bg-gradient-to-r from-white/75 via-dream-50/80 to-dream-100/70 px-3 py-5 shadow-[0_-10px_28px_-24px_rgba(56,189,248,0.55)] backdrop-blur-xl sm:mt-14 sm:px-4 sm:py-8">
      <div className="relative mx-auto flex min-h-[7rem] w-full max-w-5xl items-center justify-center overflow-hidden rounded-[1.6rem] border border-white/35 bg-white/38 px-5 py-5 text-center shadow-[0_18px_45px_-34px_rgba(18,49,79,0.55)] sm:min-h-[120px] sm:px-6">
        {/* Scattered Surreal Icons */}
        <FloatingIcons />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.42),_rgba(255,255,255,0))]"
          aria-hidden="true"
        />
        {/* Sparkles icon triggers the easter egg */}
        <motion.button
          className="absolute bottom-3 right-3 z-10 rounded-full bg-white/55 p-2 text-dream-500 shadow-[0_12px_24px_-18px_rgba(18,49,79,0.65)] transition hover:bg-dream-100 sm:bottom-auto sm:right-auto sm:bg-transparent sm:text-dream-400 sm:shadow-none"
          style={{ transform: "none" }}
          whileHover={{ scale: 1.15, rotate: 0 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleClick}
          aria-label="Sparkles Easter Egg"
          title="Abrir sorpresa"
          animate={{
            x: [0, 12, -8, 18, -5, 8, -3, 0],
            y: [0, -10, 6, -14, 4, -6, 2, 0],
          }}
          transition={{
            duration: 14,
            repeat: Infinity,
            repeatType: "loop",
            ease: "easeInOut",
            delay: 0.7,
          }}
        >
          <Sparkles
            size={24}
            strokeWidth={2.5}
            className="animate-pulse sm:size-9"
          />
        </motion.button>

        <p className="relative z-20 w-[min(100%,34rem)] px-8 text-sm font-semibold leading-6 text-dream-800 sm:px-0 sm:text-base">
          Capturando momentos en el paisaje onírico del tiempo
        </p>
      </div>
      {/* Easter Egg Modal */}
      {showEasterEgg && <EasterEggModal onClose={handleClose} />}
    </footer>
  );
};

export default Footer;
