import { useEffect, useState } from "react";
import type { Photo } from "@/types";

const PLACEHOLDER_PHOTOS: Photo[] = [
  {
    url: "/images/dali1.webp",
    caption: "Cada momento contigo es un regalo ✨",
  },
  {
    url: "/images/dali2.webp",
    caption: "Los mejores recuerdos están por venir 💖",
  },
  {
    url: "/images/thekiss.jpg",
    caption: "Feliz cumpleaños, mi amor 🎂",
  },
];

export interface UseBirthdayPhotosReturn {
  photos: Photo[];
  loading: boolean;
  error: string | null;
  isPlaceholder: boolean;
}

export const useBirthdayPhotos = (isOpen: boolean): UseBirthdayPhotosReturn => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaceholder, setIsPlaceholder] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const fetchPhotos = async () => {
      if (!isOpen) {
        setPhotos([]);
        setLoading(true);
        setIsPlaceholder(false);
        return;
      }

      setLoading(true);
      setError(null);
      setIsPlaceholder(false);

      try {
        const response = await fetch("/api/birthday-photos", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Failed to fetch photos");
        }

        const data = await response.json();
        if (controller.signal.aborted) return;

        // If no photos from Notion, use placeholders
        if (!data.photos || data.photos.length === 0) {
          setPhotos(PLACEHOLDER_PHOTOS);
          setIsPlaceholder(true);
        } else {
          setPhotos(data.photos);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Error fetching birthday photos:", err);
        setError("Error loading photos");
        setPhotos(PLACEHOLDER_PHOTOS); // Use placeholders on error
        setIsPlaceholder(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchPhotos();
    return () => controller.abort();
  }, [isOpen]);

  return { photos, loading, error, isPlaceholder };
};
