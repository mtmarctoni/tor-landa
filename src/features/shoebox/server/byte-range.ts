import "server-only";
import { ShoeboxError } from "./errors";

export type ByteRange = { start: number; end: number };

/** One `bytes` range: closed `a-b`, open-ended `a-` or suffix `-n`. */
const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/i;
/** Longer digit runs are refused before Number() can lose precision. */
const MAX_DIGITS = 15;

export function rangeNotSatisfiable(): ShoeboxError {
  return new ShoeboxError("INVALID_INPUT", { status: 416, detail: "range" });
}

function readNumber(digits: string): number {
  if (digits.length > MAX_DIGITS) throw rangeNotSatisfiable();
  return Number(digits);
}

/**
 * Returns null for no Range header (serve the whole body). Malformed,
 * multiple and unsatisfiable ranges all throw a 416, never pass upstream.
 * An end past the last byte, or a suffix longer than the body, is clamped.
 */
export function parseByteRange(
  header: string | null,
  total: number,
): ByteRange | null {
  if (header === null) return null;
  const match = SINGLE_RANGE.exec(header.trim());
  if (!match || total <= 0) throw rangeNotSatisfiable();
  const [, first, last] = match;

  if (first === "") {
    if (last === "") throw rangeNotSatisfiable();
    const suffix = readNumber(last);
    if (suffix === 0) throw rangeNotSatisfiable();
    return { start: Math.max(0, total - suffix), end: total - 1 };
  }

  const start = readNumber(first);
  if (start >= total) throw rangeNotSatisfiable();
  if (last === "") return { start, end: total - 1 };
  const end = readNumber(last);
  if (end < start) throw rangeNotSatisfiable();
  return { start, end: Math.min(end, total - 1) };
}
