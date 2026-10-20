"use client";

import type React from "react";
import type { SimpleModalProps } from "@/types/components";
import JournalDialog from "./JournalDialog";
import SurpriseWorld from "./SurpriseWorld";

const EasterEggModal: React.FC<SimpleModalProps> = ({ onClose }) => (
  <JournalDialog
    isOpen={true}
    onClose={onClose}
    title="Sorpresa surrealista"
    className="surprise-dialog"
  >
    <SurpriseWorld />
    <div className="surprise-letter">
      <span className="surprise-note" aria-hidden="true">
        Un bolsillo del universo
      </span>
      <p>
        Esta sorpresa es para ti, de alguien que te quiere mucho. A veces el
        cariño no se ve, pero siempre está contigo, incluso en los momentos más
        simples.
      </p>
    </div>
  </JournalDialog>
);

export default EasterEggModal;
