"use client";

import type React from "react";
import JournalDialog from "./JournalDialog";
import SurpriseWorld from "./SurpriseWorld";

interface AmorEasterEggModalProps {
  onClose: () => void;
}

const AmorEasterEggModal: React.FC<AmorEasterEggModalProps> = ({ onClose }) => (
  <JournalDialog
    isOpen={true}
    onClose={onClose}
    title="Momento especial"
    className="surprise-dialog amor-dialog"
  >
    <SurpriseWorld />
    <div className="surprise-letter">
      <span className="surprise-note" aria-hidden="true">
        Donde la gravedad se enamora
      </span>
      <p>A veces lo mejor aparece cuando menos te lo esperas.</p>
    </div>
  </JournalDialog>
);

export default AmorEasterEggModal;
