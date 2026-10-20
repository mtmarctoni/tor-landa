"use client";

import { Sparkles } from "lucide-react";
import type React from "react";
import { useState } from "react";
import EasterEggKeyboardListener from "@/components/EasterEggKeyboardListener";
import EasterEggModal from "@/components/EasterEggModal";
import FloatingIcons from "@/components/FloatingIcons";

const Footer: React.FC = () => {
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  return (
    <footer className="journal-footer">
      <div className="journal-footer-inner">
        <FloatingIcons />
        <p>Capturando momentos en el paisaje onírico del tiempo</p>
        <button
          type="button"
          className="journal-surprise"
          onClick={() => setShowEasterEgg(true)}
          aria-label="Abrir sorpresa"
          title="Abrir sorpresa"
        >
          <Sparkles size={21} strokeWidth={1.3} aria-hidden="true" />
        </button>
        <EasterEggKeyboardListener />
      </div>
      {showEasterEgg && (
        <EasterEggModal onClose={() => setShowEasterEgg(false)} />
      )}
    </footer>
  );
};

export default Footer;
