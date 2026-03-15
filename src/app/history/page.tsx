import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import MessageHistory from '@/components/MessageHistory';

export default function HistoryPage() {
  return (
    <main className="container mx-auto flex-1 px-4 py-8 sm:py-12">
      <section className="mb-8 rounded-2xl border border-dream-200 bg-white/55 px-4 py-4 backdrop-blur-lg sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-3 rounded-full bg-dream-200 px-4 py-2 text-dream-800 shadow transition-colors hover:bg-dream-300"
          >
            <ArrowLeft size={20} />
            Volver al presente
          </Link>
          <h1 className="text-3xl font-serif italic tracking-tight text-dream-800 sm:text-4xl">
            Historia de Cualidades
          </h1>
        </div>
      </section>
      <MessageHistory />
    </main>
  );
}
