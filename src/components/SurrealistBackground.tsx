"use client";

import Image from "next/image";
import { useMemo } from "react";
import { useTimeShift } from "@/context/TimeShiftContext";

const ORB_CONFIGS = {
  dawn: {
    orb1: "bg-amber-300",
    orb2: "bg-orange-400",
    orb3: "bg-yellow-300",
    imageBlend: "mix-blend-soft-light",
    imageOpacity: "opacity-20 sm:opacity-25",
    orbOpacity: "opacity-30 sm:opacity-40",
  },
  day: {
    orb1: "bg-dream-200",
    orb2: "bg-dream-300",
    orb3: "bg-dream-400",
    imageBlend: "mix-blend-multiply",
    imageOpacity: "opacity-14 sm:opacity-20",
    orbOpacity: "opacity-24 sm:opacity-30",
  },
  dusk: {
    orb1: "bg-violet-500",
    orb2: "bg-purple-400",
    orb3: "bg-fuchsia-400",
    imageBlend: "mix-blend-soft-light",
    imageOpacity: "opacity-10 sm:opacity-16",
    orbOpacity: "opacity-28 sm:opacity-35",
  },
  night: {
    orb1: "bg-blue-900",
    orb2: "bg-indigo-800",
    orb3: "bg-violet-900",
    imageBlend: "mix-blend-soft-light",
    imageOpacity: "opacity-6 sm:opacity-10",
    orbOpacity: "opacity-20 sm:opacity-25",
  },
} as const;

function generateStars(count: number) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    const x = Math.round(Math.random() * 100);
    const y = Math.round(Math.random() * 100);
    const duration = 2 + Math.round(Math.random() * 4);
    const delay = Math.round(Math.random() * 5);
    stars.push({ x, y, duration, delay, id: i });
  }
  return stars;
}

export default function SurrealistBackground() {
  const { period } = useTimeShift();
  const config = ORB_CONFIGS[period];

  const stars = useMemo(() => generateStars(80), []);

  return (
    <>
      {/* Dawn glow overlay */}
      <div className="time-dawn-glow" />

      {/* Night stars */}
      <div className="time-stars">
        {stars.map((star) => (
          <div
            key={star.id}
            className="time-star"
            style={
              {
                left: `${star.x}%`,
                top: `${star.y}%`,
                "--tw-duration": `${star.duration}s`,
                "--tw-delay": `${star.delay}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Surrealist Background Images */}
      <div
        className={`pointer-events-none absolute inset-0 ${config.imageOpacity} transition-opacity duration-[2s]`}
      >
        <Image
          src="/images/thekiss.jpg"
          alt=""
          width={1280}
          height={1285}
          loading="lazy"
          className={`absolute right-[-5rem] top-32 h-56 w-56 rounded-full object-cover blur-sm sm:right-0 sm:top-40 sm:h-96 sm:w-96 sm:blur-xs sm:animate-float ${config.imageBlend}`}
        />
        <Image
          src="/images/dali1.webp"
          alt=""
          width={320}
          height={320}
          loading="lazy"
          className={`absolute -left-16 bottom-24 h-44 w-44 rounded-full object-cover blur-sm sm:-left-20 sm:bottom-0 sm:h-80 sm:w-80 sm:blur-xs sm:animate-float ${config.imageBlend}`}
          style={{ animationDelay: "-5s" }}
        />
        <Image
          src="/images/dali2.webp"
          alt=""
          width={512}
          height={512}
          loading="lazy"
          className={`absolute left-1/2 top-[48%] hidden h-[22rem] w-[22rem] -translate-x-1/2 rounded-full object-cover blur-sm sm:left-1/4 sm:top-1/2 sm:block sm:h-128 sm:w-128 sm:translate-x-0 sm:blur-xs sm:animate-float ${config.imageBlend}`}
          style={{ animationDelay: "-10s" }}
        />
      </div>

      {/* Floating Orbs */}
      <div
        className={`absolute inset-0 ${config.orbOpacity} transition-opacity duration-[2s]`}
      >
        <div
          className={`absolute left-0 top-24 h-28 w-28 rounded-full blur-2xl sm:left-20 sm:top-20 sm:h-40 sm:w-40 sm:animate-drift ${config.orb1}`}
        />
        <div
          className={`absolute right-2 top-44 h-36 w-36 rounded-full blur-2xl sm:right-20 sm:top-40 sm:h-60 sm:w-60 sm:animate-drift ${config.orb2}`}
          style={{ animationDelay: "-5s" }}
        />
        <div
          className={`absolute bottom-28 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full blur-2xl sm:bottom-20 sm:h-40 sm:w-40 sm:animate-drift ${config.orb3}`}
          style={{ animationDelay: "-10s" }}
        />
      </div>
    </>
  );
}
