"use client"

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import MessageHistory from './components/MessageHistory';

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-surreal-gradient relative overflow-hidden">
      {/* Surrealist Background Images - similar to main page */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <Image
          src="/images/thekiss.jpg"
          alt=""
          width={1280}
          height={1285}
          loading='lazy'
          className="absolute top-40 right-0 w-96 h-96 object-cover rounded-full mix-blend-multiply filter blur-xs animate-float"
        />
        <Image
          src="/images/dali1.webp"
          alt=""
          width={320}
          height={320}
          loading='lazy'
          className="absolute bottom-0 -left-20 w-80 h-80 object-cover rounded-full mix-blend-multiply filter blur-xs animate-float"
          style={{ animationDelay: '-5s' }}
        />
      </div>

      {/* Floating Orbs */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-20 w-40 h-40 bg-dream-200 rounded-full mix-blend-multiply filter blur-xl animate-drift"></div>
        <div className="absolute top-40 right-20 w-60 h-60 bg-dream-300 rounded-full mix-blend-multiply filter blur-xl animate-drift" style={{ animationDelay: '-5s' }}></div>
        <div className="absolute bottom-20 left-1/2 w-40 h-40 bg-dream-400 rounded-full mix-blend-multiply filter blur-xl animate-drift" style={{ animationDelay: '-10s' }}></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="py-8 px-4 bg-gradient-to-r from-dream-900/10 to-dream-700/10 backdrop-blur-lg border-b border-dream-200">
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
        </header>

        {/* Main Content */}
        <main className="flex-1 container mx-auto px-4 py-12">
          <MessageHistory />
        </main>
      </div>
    </div>
  );
}