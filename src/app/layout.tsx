import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Header from "@/sections/Header";
import Footer from "@/sections/Footer";
import SurrealistBackground from "@/components/SurrealistBackground";
import EasterEggKeyboardListener from "@/components/EasterEggKeyboardListener";
import { QualityProvider } from "@/context/QualityContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cualidades de Landa",
  description: "Capturando momentos en el paisaje onírico del tiempo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <QualityProvider>
          <div className="relative isolate min-h-screen overflow-hidden bg-surreal-gradient">
            <SurrealistBackground />
            <div className="relative z-10 flex min-h-screen flex-col">
              <Header />
              {children}
              <Footer />
            </div>
          </div>
          <EasterEggKeyboardListener />
        </QualityProvider>
      </body>
    </html>
  );
}
