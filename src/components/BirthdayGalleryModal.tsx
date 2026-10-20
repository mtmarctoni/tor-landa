"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { useBirthdayPhotos } from "@/hooks/useBirthdayPhotos";
import { useImagePreloader } from "@/hooks/useImagePreloader";
import type { BaseModalProps } from "@/types/components";
import BirthdayConfetti from "./BirthdayConfetti";
import BirthdayWorld from "./BirthdayWorld";
import GalleryLoading from "./GalleryLoading";
import JournalDialog from "./JournalDialog";
import PhotoCaption from "./PhotoCaption";
import PhotoViewer from "./PhotoViewer";

const BirthdayGalleryModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { photos, loading, error, isPlaceholder } = useBirthdayPhotos(isOpen);
  const { imageLoadStates, preloadImages, clearPreloadedImages } =
    useImagePreloader();

  useEffect(() => {
    if (!isOpen) {
      setCurrentIndex(0);
      clearPreloadedImages();
    }
  }, [isOpen, clearPreloadedImages]);
  useEffect(() => {
    if (isOpen && !loading && photos.length)
      void preloadImages(photos.map((photo) => photo.url));
  }, [isOpen, loading, photos, preloadImages]);

  const index = currentIndex < photos.length ? currentIndex : 0;
  const next = () => {
    if (photos.length) setCurrentIndex((value) => (value + 1) % photos.length);
  };
  const prev = () => {
    if (photos.length)
      setCurrentIndex((value) => (value - 1 + photos.length) % photos.length);
  };

  return (
    <JournalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Para ti, Landa"
      className="birthday-dialog birthday-gallery"
    >
      {isOpen && <BirthdayConfetti />}
      <div className="birthday-gallery-intro">
        <p className="journal-eyebrow">Un universo en nuestras fotos</p>
        <p>La gravedad no entra aquí. Los recuerdos, sí.</p>
      </div>
      {isPlaceholder && !loading && (
        <div role="status" className="birthday-notice">
          <p>Mostrando imágenes de ejemplo</p>
          {error && (
            <p>
              No se pudieron cargar las fotos. Mientras tanto, estas pinturas
              nos acompañan.
            </p>
          )}
        </div>
      )}
      <div className="birthday-photo-world">
        <BirthdayWorld />
        {loading ? (
          <GalleryLoading photosCount={0} loadedCount={0} />
        ) : (
          <PhotoViewer
            photos={photos}
            currentIndex={index}
            imageLoadStates={imageLoadStates}
            onNext={next}
            onPrev={prev}
          />
        )}
      </div>
      {!loading && photos[index] && (
        <PhotoCaption photo={photos[index]} currentIndex={index} />
      )}
      <p className="birthday-dedication">
        Feliz cumpleaños. <span>Te quiero.</span>
      </p>
    </JournalDialog>
  );
};
export default BirthdayGalleryModal;
