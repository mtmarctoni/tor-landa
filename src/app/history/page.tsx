import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import MessageHistory from "@/components/MessageHistory";

export default function HistoryPage() {
  return (
    <main className="archive-page">
      <section className="archive-intro" aria-labelledby="archive-title">
        <Link href="/" className="archive-return archive-button">
          <ArrowLeft aria-hidden="true" size={20} />
          Volver al presente
        </Link>
        <div className="archive-title-scene">
          <div className="archive-orbit" aria-hidden="true">
            <span className="archive-door" />
            <span className="archive-orbit-moon" />
          </div>
          <div className="archive-title-cloud">
            <p className="journal-eyebrow">El tiempo también sabe flotar</p>
            <h1 id="archive-title">
              Archipiélago
              <br />
              <em>de recuerdos</em>
            </h1>
            <p>Cada semana, una isla. Cada palabra, un lugar al que volver.</p>
          </div>
        </div>
      </section>
      <MessageHistory />
    </main>
  );
}
