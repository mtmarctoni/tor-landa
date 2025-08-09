import Image from 'next/image';

import Header from "./sections/Header";
import Footer from "./sections/Footer";
import QualityTracker from "./sections/QualityTracker";
import { QualityProvider } from "../context/QualityContext";

export default function Home() {
  return (
    <QualityProvider>
      <div className="min-h-screen bg-surreal-gradient relative overflow-hidden">
        {/* Surrealist Background Images */}
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
          <Image
            src="/images/dali2.webp"
            alt=""
            width={512}
            height={512}
            loading='lazy'
            className="absolute top-1/2 left-1/4 w-128 h-128 object-cover rounded-full mix-blend-multiply filter blur-xs animate-float"
            style={{ animationDelay: '-10s' }}
          />
        </div>

        {/* Floating Orbs */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-20 w-40 h-40 bg-dream-200 rounded-full mix-blend-multiply filter blur-xl animate-drift"></div>
          <div className="absolute top-40 right-20 w-60 h-60 bg-dream-300 rounded-full mix-blend-multiply filter blur-xl animate-drift" style={{ animationDelay: '-5s' }}></div>
          <div className="absolute bottom-20 left-1/2 w-40 h-40 bg-dream-400 rounded-full mix-blend-multiply filter blur-xl animate-drift" style={{ animationDelay: '-10s' }}></div>
        </div>

        <div className="relative z-10 flex flex-col min-h-screen">
          <Header />
          <main className="flex-1 container mx-auto px-4 py-12">
            <QualityTracker />
          </main>
          <Footer />
        </div>
      </div>
    </QualityProvider>
  );
}
