import type React from "react";

const LoadingQuality: React.FC = () => (
  <div className="journal-status" aria-busy="true">
    <span className="journal-eyebrow">Entre páginas</span>
    <h2>Cargando el mensaje…</h2>
    <p>
      Si puedes leer esto, tu internet es más lento que una tortuga filosofando.
      <br />
      ¡Pero tranquilo, el mensaje siempre llega!
    </p>
  </div>
);

export default LoadingQuality;
