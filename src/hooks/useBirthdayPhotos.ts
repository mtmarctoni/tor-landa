import { useState, useEffect } from "react";
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
}

export const useBirthdayPhotos = (isOpen: boolean): UseBirthdayPhotosReturn => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      if (!isOpen) {
        setPhotos([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/birthday-photos");
        if (!response.ok) {
          throw new Error("Failed to fetch photos");
        }

        const data = await response.json();

        // If no photos from Notion, use placeholders
        if (!data.photos || data.photos.length === 0) {
          setPhotos(PLACEHOLDER_PHOTOS);
        } else {
          setPhotos(data.photos);
        }
      } catch (err) {
        console.error("Error fetching birthday photos:", err);
        setError("Error loading photos");
        setPhotos(PLACEHOLDER_PHOTOS); // Use placeholders on error
      } finally {
        setLoading(false);
      }
    };

    fetchPhotos();
  }, [isOpen]);

  return { photos, loading, error };
};
