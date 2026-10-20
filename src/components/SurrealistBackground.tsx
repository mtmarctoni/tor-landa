import Image from "next/image";

const paintings = [
  { name: "swans", src: "/images/dali1.webp" },
  { name: "clocks", src: "/images/dali2.webp" },
  { name: "kiss", src: "/images/thekiss.jpg" },
  { name: "cypresses", src: "/images/dream/van-gogh-cypresses.webp" },
];

/** Deterministic painting islands: full colour, no blending away the artwork. */
export default function SurrealistBackground() {
  return (
    <div
      className="dream-gallery"
      data-testid="journal-scene"
      aria-hidden="true"
    >
      <div className="dream-orbit dream-orbit-one" />
      <div className="dream-orbit dream-orbit-two" />
      {paintings.map(({ name, src }) => (
        <div
          className={`dream-painting dream-painting-${name}`}
          data-painting={name}
          data-dream-object={
            name === "swans" ? "eye" : name === "clocks" ? "melt" : undefined
          }
          key={name}
        >
          <Image
            src={src}
            alt=""
            fill
            sizes="(max-width: 767px) 180px, (max-width: 1100px) 240px, 380px"
            loading="eager"
          />
          {name === "swans" && (
            <>
              <svg
                className="dream-eyelids"
                aria-hidden="true"
                viewBox="0 0 350 275"
                preserveAspectRatio="none"
              >
                <defs>
                  <clipPath id="eye-opening" clipPathUnits="objectBoundingBox">
                    <path d="M.009 .502Q.486 -.087 .991 .502Q.5 1.164 .009 .502Z" />
                  </clipPath>
                  <linearGradient id="lid-paint" x2="0.3" y2="1">
                    <stop stopColor="#fff2c9" />
                    <stop offset=".45" stopColor="#de9d7a" />
                    <stop offset="1" stopColor="#8c415e" />
                  </linearGradient>
                </defs>
                <path
                  d="M3 138Q165 -75 347 138Q176 5 3 138Z"
                  fill="url(#lid-paint)"
                />
                <path
                  d="M3 138Q170 346 347 138Q175 290 3 138Z"
                  fill="url(#lid-paint)"
                />
                <path
                  d="M3 138Q170 -24 347 138Q175 320 3 138Z"
                  fill="none"
                  stroke="#ffe8ad"
                  strokeWidth="5"
                />
                <path
                  d="M58 77L43 43M115 45L109 13M178 35L181 4M239 52L254 22M294 89L320 61"
                  stroke="#683d52"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
              </svg>
              <span className="dream-eye-pupil" />
            </>
          )}
          {name === "clocks" && (
            <svg
              className="dream-melting-wax"
              aria-hidden="true"
              viewBox="0 0 340 150"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="wax-paint" x2=".8" y2="1">
                  <stop stopColor="#fff0b4" />
                  <stop offset=".45" stopColor="#eeb880" />
                  <stop offset="1" stopColor="#a75569" />
                </linearGradient>
              </defs>
              <path
                d="M4 3Q31 24 47 7Q64 1 67 24L70 97Q73 117 82 96L86 38Q91 19 100 34L109 127Q119 153 130 129L135 46Q139 27 153 40L162 70Q172 87 181 64L188 29Q197 12 206 29L214 106Q224 132 234 108L240 36Q244 12 258 26Q293 46 336 3Q259 28 174 13Q83 34 4 3Z"
                fill="url(#wax-paint)"
                stroke="#fff0c5"
                strokeWidth="3"
              />
              <path
                d="M77 44L78 92M119 58L121 123M225 47L225 102"
                stroke="#fff6d8"
                strokeWidth="4"
                strokeLinecap="round"
                opacity=".8"
              />
            </svg>
          )}
        </div>
      ))}
      <svg
        className="dream-stairs"
        aria-hidden="true"
        data-dream-object="stairs"
        viewBox="0 0 220 300"
      >
        <defs>
          <linearGradient id="stair-paint" x2=".8" y2="1">
            <stop stopColor="#fff8da" />
            <stop offset=".55" stopColor="#efb799" />
            <stop offset="1" stopColor="#9c6c87" />
          </linearGradient>
          <radialGradient id="cloud-paint" cx=".35" cy=".25" r=".8">
            <stop stopColor="#fffcef" />
            <stop offset=".6" stopColor="#f4d7c3" />
            <stop offset="1" stopColor="#86a9ba" />
          </radialGradient>
        </defs>
        <path
          d="M48 259L130 212V161L96 180V130L159 94V43L193 24V113L135 147V197L170 177V236L83 286Z"
          fill="#735f80"
          stroke="#5f5871"
          strokeWidth="2"
        />
        {Array.from({ length: 9 }, (_, i) => (
          <g key={i} transform={`translate(${48 + i * 9} ${252 - i * 17})`}>
            <path
              d="M0 0L34 20L79 -6L45 -26Z"
              fill="url(#stair-paint)"
              stroke="#fff1d1"
            />
            <path d="M0 0V17L34 37V20Z" fill="#c48183" />
            <path d="M34 20L79 -6V11L34 37Z" fill="#76718f" />
          </g>
        ))}
        <path d="M112 113L145 132L193 104L159 85Z" fill="#fff0c9" />
        <path
          d="M141 68C107 72 98 43 119 35C109 8 146 -4 161 16C180 -7 210 9 205 30C234 42 215 73 192 67C178 83 155 83 141 68Z"
          fill="url(#cloud-paint)"
        />
        <path
          d="M119 39Q139 26 150 42M166 22Q186 12 195 32"
          fill="none"
          stroke="#fff9e5"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </svg>
      <div className="dream-moon" data-dream-object="moon">
        <span className="dream-moon-orb" />
        <span className="dream-moon-ribbon" />
      </div>
      <span className="dream-spark dream-spark-one">✦</span>
      <span className="dream-spark dream-spark-two">✧</span>
      <span className="dream-spark dream-spark-three">✦</span>
    </div>
  );
}
