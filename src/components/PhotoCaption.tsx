import type { Photo } from "@/types";

export default function PhotoCaption({
  photo,
  currentIndex,
}: {
  photo: Photo;
  currentIndex: number;
}) {
  return (
    <div
      className="birthday-caption"
      aria-live="polite"
      aria-atomic="true"
      key={currentIndex}
    >
      <p>{photo.caption || "Un momento especial"}</p>
    </div>
  );
}
