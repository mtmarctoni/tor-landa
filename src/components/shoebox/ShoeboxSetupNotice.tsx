import Link from "next/link";

/** Public shell only: no missing-variable names or private data. */
export default function ShoeboxSetupNotice() {
  return (
    <main className="archive-page">
      <section aria-labelledby="shoebox-setup-title" className="archive-tools">
        <p className="journal-eyebrow">Ventanilla de asuntos imposibles</p>
        <h1 id="shoebox-setup-title">La caja todavía no está preparada</h1>
        <p>La cerradura está de ensayo. Vuelve un poquito más tarde.</p>
        <Link href="/" prefetch={false} className="archive-button">
          Volver al presente
        </Link>
      </section>
    </main>
  );
}
