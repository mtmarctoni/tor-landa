import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";
import "@/components/love-laboratory.css";

import MotionPreferences from "@/components/MotionPreferences";
import SurrealistBackground from "@/components/SurrealistBackground";
import { QualityProvider } from "@/context/QualityContext";
import { TimeShiftProvider } from "@/context/TimeShiftContext";
import Footer from "@/sections/Footer";
import Header from "@/sections/Header";

const readingFont = DM_Sans({
  variable: "--font-journal-sans",
  subsets: ["latin"],
  display: "swap",
});

const displayFont = Cormorant_Garamond({
  variable: "--font-journal-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
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
        className={`${readingFont.variable} ${displayFont.variable} time-body antialiased`}
      >
        <MotionPreferences>
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
            </TimeShiftProvider>
          </QualityProvider>
        </MotionPreferences>
      </body>
    </html>
  );
}
