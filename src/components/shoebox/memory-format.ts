import type { MemorySummary } from "@/types/shoebox";

const DATE = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "3 de febrero de 2001" for a date-only YYYY-MM-DD value. */
export function spanishDate(memoryDate: string): string {
  return DATE.format(new Date(`${memoryDate}T00:00:00Z`));
}

function excerpt(value: string, max = 80): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** A short human label that identifies one memory (for confirmations). */
export function memoryLabel(memory: MemorySummary): string {
  const kind =
    memory.kind === "photo"
      ? "La foto"
      : memory.kind === "audio"
        ? "El audio"
        : "La nota";
  const what =
    memory.kind === "text"
      ? `«${excerpt(memory.text)}»`
      : memory.caption
        ? `«${excerpt(memory.caption)}»`
        : "sin pie";
  return `${kind} ${what}, del ${spanishDate(memory.memoryDate)}`;
}

/** Status line after a successful save (kept from Task 8). */
export function savedMessage(memory: MemorySummary): string {
  const label =
    memory.kind === "text"
      ? memory.text
      : memory.caption || (memory.kind === "photo" ? "una foto" : "un audio");
  return `Guardado en la caja: «${excerpt(label)}».`;
}

const STAMPS = [
  "Prueba",
  "Confidencial",
  "Sin explicación",
  "Certificado",
  "Frágil",
  "Urgente, más o menos",
] as const;

export type ScrapLook = {
  /** Paper tilt in degrees; small, so long notes stay inside their paper. */
  tilt: number;
  tape: "left" | "middle" | "right";
  tone: 0 | 1 | 2;
  shape: 0 | 1 | 2;
  stamp: string;
  legs: boolean;
};

/**
 * Deterministic decoration from the record identity (FNV-1a), never random:
 * the same memory always looks the same, on the server and the client.
 */
export function scrapLook(id: string): ScrapLook {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const pick = (shift: number, size: number) => (hash >>> shift) % size;
  const tilts = [-1.6, -1.1, -0.6, 0.6, 1.1, 1.6];
  return {
    tilt: tilts[pick(0, tilts.length)] ?? 0.6,
    tape: (["left", "middle", "right"] as const)[pick(5, 3)] ?? "middle",
    tone: pick(9, 3) as ScrapLook["tone"],
    shape: pick(13, 3) as ScrapLook["shape"],
    stamp: STAMPS[pick(17, STAMPS.length)] ?? "Prueba",
    legs: pick(23, 2) === 0,
  };
}
