export default function GalleryLoading({
  photosCount,
  loadedCount,
}: {
  photosCount: number;
  loadedCount: number;
}) {
  return (
    <div role="status" className="birthday-gallery-loading">
      <span className="birthday-loading-portal" aria-hidden="true" />
      <p>Cargando recuerdos...</p>
      {photosCount > 0 && (
        <p>
          {loadedCount} / {photosCount}
        </p>
      )}
    </div>
  );
}
