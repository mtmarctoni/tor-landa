import type { Mischief } from "@/components/shoebox/useShoeboxMotion";

const MOON_LINES: Record<Mischief | "idle", string> = {
  idle: "Yo no he visto nada.",
  moon: "Vale, he sido yo. Un poco.",
  legs: "Las fotos salen a estirar las piernas.",
  stamp: "Yo tampoco he visto ese sello.",
  jars: "Los frascos dicen que dentro hay eco.",
};

const FISH_LINES: Record<Mischief | "idle", string> = {
  idle: "Esto no cabe en un sobre.",
  moon: "La luna disimula fatal.",
  legs: "Vuelven enseguida. Creo.",
  stamp: "Sellado. Sin más preguntas.",
  jars: "¡Silencio en los frascos!",
};

/**
 * Decorative moon and weary fish for the shoebox hero. It receives only
 * decorative flags (which reaction, which press), never memory data, and
 * every node is aria-hidden with pointer-events disabled in the stylesheet.
 * The two corners live in their own reserved grid cells, so no reaction can
 * cover a control or a memory.
 */
export default function ShoeboxScene({
  reaction,
  serial,
}: {
  reaction: Mischief | null;
  serial: number;
}) {
  const line = reaction ?? "idle";
  return (
    <>
      <div className="shoebox-moon-cell" aria-hidden="true">
        <div className="shoebox-moon" key={`moon-${serial}`}>
          <svg viewBox="0 0 160 160" aria-hidden="true" focusable="false">
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="#ffe582"
              stroke="#492752"
              strokeWidth="3"
            />
            <path d="M118 30Q150 80 112 136Q140 84 118 30Z" fill="#e7b967" />
            <ellipse
              className="shoebox-moon-blush"
              cx="58"
              cy="96"
              rx="13"
              ry="8"
              fill="#ef8e7f"
            />
            <ellipse
              className="shoebox-moon-blush"
              cx="108"
              cy="96"
              rx="11"
              ry="7"
              fill="#ef8e7f"
            />
            <path
              className="shoebox-moon-eyes"
              d="M50 70Q60 62 70 70M92 70Q102 62 112 70"
              fill="none"
              stroke="#492752"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M66 108Q81 116 96 106"
              fill="none"
              stroke="#492752"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className="shoebox-bubble shoebox-moon-bubble">{MOON_LINES[line]}</p>
      </div>
      <div className="shoebox-fish-cell" aria-hidden="true">
        <div className="shoebox-fish" key={`fish-${serial}`}>
          <svg viewBox="0 0 210 130" aria-hidden="true" focusable="false">
            <path
              d="M89 65Q32 -21 39 27Q4 1 28 39Q-3 23 23 56L77 84M111 64Q141 3 157 11L154 46L183 33L158 80"
              fill="#fff3cd"
              stroke="#492752"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path
              d="M56 72Q111 26 159 74L197 50L187 83L199 107L158 91Q103 132 56 72Z"
              fill="#fa967f"
              stroke="#492752"
              strokeWidth="3"
            />
            <ellipse
              cx="85"
              cy="73"
              rx="13"
              ry="17"
              fill="#fff9de"
              stroke="#492752"
              strokeWidth="2"
            />
            <path
              d="M72 64Q85 58 98 64"
              fill="none"
              stroke="#492752"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <ellipse cx="83" cy="78" rx="5" ry="7" fill="#492752" />
            <path
              d="M59 83L47 85M112 72L121 86L111 96M136 64L143 80L135 99"
              fill="none"
              stroke="#492752"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          {reaction === "stamp" && (
            <span className="shoebox-fish-stamp" key={`stamp-${serial}`}>
              Sin pruebas
            </span>
          )}
        </div>
        <p className="shoebox-bubble shoebox-fish-bubble">{FISH_LINES[line]}</p>
      </div>
    </>
  );
}
