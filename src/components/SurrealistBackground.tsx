import Image from "next/image";

export default function SurrealistBackground() {
  return (
    <>
      {/* Surrealist Background Images */}
      <div className="pointer-events-none absolute inset-0 opacity-14 sm:opacity-20">
        <Image
          src="/images/thekiss.jpg"
          alt=""
          width={1280}
          height={1285}
          loading="lazy"
          className="absolute right-[-5rem] top-32 h-56 w-56 rounded-full object-cover mix-blend-multiply blur-sm sm:right-0 sm:top-40 sm:h-96 sm:w-96 sm:blur-xs sm:animate-float"
        />
        <Image
          src="/images/dali1.webp"
          alt=""
          width={320}
          height={320}
          loading="lazy"
          className="absolute -left-16 bottom-24 h-44 w-44 rounded-full object-cover mix-blend-multiply blur-sm sm:-left-20 sm:bottom-0 sm:h-80 sm:w-80 sm:blur-xs sm:animate-float"
          style={{ animationDelay: "-5s" }}
        />
        <Image
          src="/images/dali2.webp"
          alt=""
          width={512}
          height={512}
          loading="lazy"
          className="absolute left-1/2 top-[48%] hidden h-[22rem] w-[22rem] -translate-x-1/2 rounded-full object-cover mix-blend-multiply blur-sm sm:left-1/4 sm:top-1/2 sm:block sm:h-128 sm:w-128 sm:translate-x-0 sm:blur-xs sm:animate-float"
          style={{ animationDelay: "-10s" }}
        />
      </div>

      {/* Floating Orbs */}
      <div className="absolute inset-0 opacity-24 sm:opacity-30">
        <div className="absolute left-0 top-24 h-28 w-28 rounded-full bg-dream-200 blur-2xl sm:left-20 sm:top-20 sm:h-40 sm:w-40 sm:animate-drift"></div>
        <div
          className="absolute right-2 top-44 h-36 w-36 rounded-full bg-dream-300 blur-2xl sm:right-20 sm:top-40 sm:h-60 sm:w-60 sm:animate-drift"
          style={{ animationDelay: "-5s" }}
        ></div>
        <div
          className="absolute bottom-28 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full bg-dream-400 blur-2xl sm:bottom-20 sm:h-40 sm:w-40 sm:animate-drift"
          style={{ animationDelay: "-10s" }}
        ></div>
      </div>
    </>
  );
}
