import { motion, type PanInfo, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { Photo } from "@/types";

interface PhotoViewerProps {
  photos: Photo[];
  currentIndex: number;
  imageLoadStates: { [key: number]: boolean };
  onNext: () => void;
  onPrev: () => void;
}

export default function PhotoViewer({
  photos,
  currentIndex,
  imageLoadStates,
  onNext,
  onPrev,
}: PhotoViewerProps) {
  const reducedMotion = useReducedMotion();
  const [displayStates, setDisplayStates] = useState<
    Record<string, "loaded" | "error">
  >({});
  const photo = photos[currentIndex];
  if (!photo)
    return (
      <p className="birthday-notice">Pronto habrá fotos especiales aquí</p>
    );
  const state = displayStates[photo.url];
  const handlePanEnd = (_event: Event, info: PanInfo) => {
    if (info.offset.x > 50) onPrev();
    else if (info.offset.x < -50) onNext();
  };
  return (
    <div className="birthday-photo-composition">
      <motion.div
        className="birthday-photo-frame"
        onPanEnd={handlePanEnd}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={reducedMotion ? 0 : 0.12}
      >
        <div className="birthday-photo-surface">
          {!state && (
            <p role="status" className="birthday-image-status">
              Cargando foto...
            </p>
          )}
          {state === "error" && (
            <p role="status" className="birthday-image-status">
              Esta foto no se pudo cargar. Puedes pasar a la siguiente.
            </p>
          )}
          <Image
            key={photo.url}
            src={photo.url}
            alt={`Recuerdo ${currentIndex + 1}`}
            fill
            sizes="(max-width: 600px) 80vw, 65vw"
            loading="eager"
            draggable={false}
            onLoad={() =>
              setDisplayStates((previous) => ({
                ...previous,
                [photo.url]: "loaded",
              }))
            }
            onError={() =>
              setDisplayStates((previous) => ({
                ...previous,
                [photo.url]: "error",
              }))
            }
            style={{
              objectFit: "contain",
              opacity: state === "loaded" ? 1 : 0,
            }}
            data-preloaded={Boolean(imageLoadStates[currentIndex])}
          />
        </div>
      </motion.div>
      <nav aria-label="Navegar entre fotos" className="birthday-photo-nav">
        {photos.length > 1 && (
          <button type="button" onClick={onPrev} aria-label="Foto anterior">
            <ChevronLeft aria-hidden="true" />
          </button>
        )}
        <span aria-live="polite" aria-atomic="true">
          {currentIndex + 1} / {photos.length}
        </span>
        {photos.length > 1 && (
          <button type="button" onClick={onNext} aria-label="Foto siguiente">
            <ChevronRight aria-hidden="true" />
          </button>
        )}
      </nav>
    </div>
  );
}
