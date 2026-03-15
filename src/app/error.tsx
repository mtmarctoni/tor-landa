"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="bg-surreal-gradient min-h-screen p-6 text-dream-900">
        <main className="mx-auto flex min-h-[80vh] max-w-2xl items-center justify-center">
          <section className="surface-card w-full px-6 py-8 text-center">
            <h1 className="mb-3 text-3xl font-serif italic">El reloj ha derretido sus manecillas</h1>
            <p className="mb-6 text-dream-700">
              La página ha susurrado a los girasoles y todo se tornó inesperado. ¿Te atreves a intentarlo de nuevo en este bosque de espejos?
            </p>
            <button onClick={reset} className="control-pill bg-dream-200 text-dream-800 hover:bg-dream-300">
              Atravesar el espejo
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
