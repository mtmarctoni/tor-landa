import { useState, useCallback } from "react";

export interface UseImagePreloaderReturn {
  imageLoadStates: { [key: number]: boolean };
  preloadedImages: { [key: string]: HTMLImageElement };
  preloadImages: (photoUrls: string[]) => Promise<void>;
  clearPreloadedImages: () => void;
  resetLoadStates: () => void;
}

export const useImagePreloader = (): UseImagePreloaderReturn => {
  const [imageLoadStates, setImageLoadStates] = useState<{
    [key: number]: boolean;
  }>({});
  const [preloadedImages, setPreloadedImages] = useState<{
    [key: string]: HTMLImageElement;
  }>({});

  const preloadImages = useCallback(
    async (photoUrls: string[]) => {
      const imagePromises = photoUrls.map((url, index) => {
        return new Promise<void>((resolve, reject) => {
          // Skip if already preloaded to avoid duplicate loading
          if (preloadedImages[url]) {
            setImageLoadStates((prev) => ({ ...prev, [index]: true }));
            resolve();
            return;
          }

          const img = new Image();
          img.onload = () => {
            // Use functional update to avoid stale closure issues
            setPreloadedImages((prev) => ({ ...prev, [url]: img }));
            setImageLoadStates((prev) => ({ ...prev, [index]: true }));
            resolve();
          };
          img.onerror = () => {
            console.warn(`Failed to preload image: ${url}`);
            setImageLoadStates((prev) => ({ ...prev, [index]: false }));
            reject(new Error(`Failed to load ${url}`));
          };
          img.src = url;
        });
      });

      // Load images and handle any failures gracefully
      try {
        await Promise.allSettled(imagePromises);
      } catch (error) {
        console.warn("Some images failed to preload:", error);
      }
    },
    [preloadedImages]
  );

  const clearPreloadedImages = useCallback(() => {
    setPreloadedImages({});
    setImageLoadStates({});
  }, []);

  const resetLoadStates = useCallback(() => {
    setImageLoadStates({});
  }, []);

  return {
    imageLoadStates,
    preloadedImages,
    preloadImages,
    clearPreloadedImages,
    resetLoadStates,
  };
};
