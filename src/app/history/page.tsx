"use client"

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import MessageHistory from '@/components/MessageHistory';

export default function HistoryPage() {
  return (
    <>
      <main className="flex-1 container mx-auto px-4 py-12">
        {/* Custom header for history page */}
        <section className="pb-8 px-4  backdrop-blur-lg">
          <div className="container mx-auto flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-3 px-4 py-2 bg-dream-200 text-dream-800 rounded-full shadow hover:bg-dream-300 transition-colors"
            >
              <ArrowLeft size={20} />
              Volver al presente
            </Link>
            <h1 className="text-3xl md:text-4xl font-serif text-dream-800 tracking-tight italic">
              Historia de Cualidades
            </h1>
            <div className="w-32"></div> {/* Spacer for centering */}
          </div>
        </section>
        <MessageHistory />
      </main>
    </>
  );
}