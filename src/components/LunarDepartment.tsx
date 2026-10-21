"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

const replies = [
  "Te bajaría la luna, pero pesa. Te traje una patata con aspiraciones.",
  "La patata dice que sí. También está enamorada de ti. Hay competencia.",
  "Houston, tenemos un flechazo. Y cero presupuesto para una nave.",
];

/** A tiny, local joke: no timers, global listeners, storage or message state. */
export default function LunarDepartment({
  randomCue = 0,
}: {
  randomCue?: number;
}) {
  const pathname = usePathname();
  const [reply, setReply] = useState(-1);
  // The shared masthead also frames the archive. Keep its existing tools/status
  // semantics intact: the lunar performance belongs to the home reading scene.
  if (pathname !== "/") return null;
  return (
    <div className="lunar-department">
      <div
        className={`laboratory-cast postal-moon-pose moon-pose-${randomCue}`}
        aria-hidden="true"
      >
        <svg
          aria-hidden="true"
          className={`laboratory-moon ${reply >= 0 ? "is-smitten" : ""}`}
          data-laboratory-character="blushing-moon"
          viewBox="0 0 200 190"
        >
          <path
            d="M56 112Q10 143 26 157M138 114Q178 133 175 155"
            fill="none"
            stroke="#3d294f"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M127 8C70 -4 22 37 29 89C35 146 110 163 151 117C103 134 66 94 89 56C97 42 114 33 134 34Z"
            fill="#ffe67c"
            stroke="#492752"
            strokeWidth="3"
          />
          <ellipse cx="56" cy="97" rx="16" ry="9" fill="#f596a8" />
          <ellipse cx="114" cy="105" rx="13" ry="8" fill="#f596a8" />
          <path
            d="M51 73Q58 63 64 75M98 81Q106 72 111 84M71 97Q77 115 91 101"
            fill="none"
            stroke="#492752"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            className="moon-heart"
            d="M150 34C136 17 117 37 150 59C184 37 165 16 150 34Z"
            fill="#d72d67"
            stroke="#492752"
            strokeWidth="2"
          />
          {randomCue > 0 && (
            <path
              className="postal-jealous-brow"
              d="M45 61L68 70M95 74L118 65"
              fill="none"
              stroke="#492752"
              strokeWidth="6"
              strokeLinecap="round"
            />
          )}
          {reply >= 0 && (
            <g data-laboratory-gift="potato">
              <path
                d="M146 141C148 119 183 119 189 140C204 170 172 185 154 174C144 168 139 156 146 141Z"
                fill="#d9a16c"
                stroke="#492752"
                strokeWidth="3"
              />
              <path
                d="M159 145L160 148M177 144L178 147M162 160Q169 166 177 158"
                fill="none"
                stroke="#492752"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </g>
          )}
        </svg>
      </div>
      <button
        type="button"
        className="lunar-request"
        onClick={() => setReply((current) => (current + 1) % replies.length)}
      >
        Pedirle la luna <span aria-hidden="true">↗</span>
      </button>
      <p
        role="status"
        aria-label="Respuesta de la luna"
        aria-live="polite"
        aria-atomic="true"
        className="lunar-reply"
      >
        {randomCue > 0 && reply < 0
          ? "¿Otro recuerdo? Yo también tengo cráteres preciosos, Landa."
          : reply < 0
            ? "Yo te bajaba el cielo. El pez se adelantó."
            : replies[reply]}
      </p>
    </div>
  );
}
