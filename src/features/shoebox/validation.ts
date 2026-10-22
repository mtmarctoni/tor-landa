import type {
  MemoryCorrection,
  MemoryFields,
  MemoryKind,
} from "@/types/shoebox";
import { MAX_CAPTION_CHARACTERS, MAX_TEXT_CHARACTERS } from "./limits";

/**
 * "shape" failures (unknown keys, wrong types) map to HTTP 400; "semantic"
 * failures (bad date, text/caption length) map to 422.
 */
export class ValidationError extends Error {
  readonly type: "shape" | "semantic";

  constructor(type: "shape" | "semantic") {
    super("invalid input");
    this.name = "ValidationError";
    this.type = type;
  }
}

const KINDS: readonly string[] = ["photo", "audio", "text"];
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new ValidationError("shape");
    }
  }
}

/** Unicode code points, not UTF-16 code units. */
export function codePointLength(value: string): number {
  let count = 0;
  for (const _ of value) {
    count += 1;
  }
  return count;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Strict calendar date, no timezone arithmetic, returned unchanged. */
export function readMemoryDate(value: unknown): string {
  if (typeof value !== "string") {
    throw new ValidationError("shape");
  }
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    throw new ValidationError("semantic");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    throw new ValidationError("semantic");
  }
  return value;
}

function readCaption(value: unknown): string {
  if (typeof value !== "string") {
    throw new ValidationError("shape");
  }
  if (codePointLength(value) > MAX_CAPTION_CHARACTERS) {
    throw new ValidationError("semantic");
  }
  return value;
}

function readText(value: unknown): string {
  if (typeof value !== "string") {
    throw new ValidationError("shape");
  }
  const length = codePointLength(value);
  // Whitespace-only is an empty note, as the composer treats it.
  if (value.trim() === "" || length > MAX_TEXT_CHARACTERS) {
    throw new ValidationError("semantic");
  }
  return value;
}

function readTextFor(
  kind: MemoryKind,
  value: Record<string, unknown>,
): { text?: string } {
  if (kind === "text") {
    return { text: readText(value.text) };
  }
  if ("text" in value) {
    throw new ValidationError("shape");
  }
  return {};
}

export function validateFields(value: unknown): MemoryFields {
  if (!isPlainObject(value)) {
    throw new ValidationError("shape");
  }
  assertExactKeys(value, ["kind", "text", "caption", "memoryDate"]);
  const kind = value.kind;
  if (typeof kind !== "string" || !KINDS.includes(kind)) {
    throw new ValidationError("shape");
  }
  const memoryKind = kind as MemoryKind;
  return {
    kind: memoryKind,
    ...readTextFor(memoryKind, value),
    caption: readCaption(value.caption),
    memoryDate: readMemoryDate(value.memoryDate),
  };
}

export function validateCorrection(
  value: unknown,
  kind: MemoryKind,
): MemoryCorrection {
  if (!isPlainObject(value)) {
    throw new ValidationError("shape");
  }
  assertExactKeys(value, ["text", "caption", "memoryDate"]);
  return {
    ...readTextFor(kind, value),
    caption: readCaption(value.caption),
    memoryDate: readMemoryDate(value.memoryDate),
  };
}
