import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import EasterEggKeyboardListener from "@/components/EasterEggKeyboardListener";
import SurrealistBackground from "@/components/SurrealistBackground";
import { QualityProvider } from "@/context/QualityContext";
import { TimeShiftProvider } from "@/context/TimeShiftContext";
import Footer from "@/sections/Footer";
import Header from "@/sections/Header";

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
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} time-body antialiased`}
      >
        <QualityProvider>
          <TimeShiftProvider>
            <div className="time-gradient relative isolate min-h-screen overflow-hidden">
              <SurrealistBackground />
              <div className="relative z-10 flex min-h-screen flex-col">
                <Header />
                {children}
                <Footer />
              </div>
            </div>
            <EasterEggKeyboardListener />
          </TimeShiftProvider>
        </QualityProvider>
      </body>
    </html>
  );
}
