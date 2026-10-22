import "server-only";
import { scrypt, timingSafeEqual } from "node:crypto";
import { MAX_PASSWORD_BYTES } from "../limits";
import {
  KEY_BYTES,
  MIN_SALT_BYTES,
  SCRYPT_OPTIONS,
} from "../password-parameters.mjs";
import { ShoeboxError } from "./errors";

// Fixed parameters: the verifier string never chooses its own cost.
const BASE64URL = /^[A-Za-z0-9_-]+$/;

/**
 * Per-instance resource guard so one instance never runs more than two
 * memory-hard jobs at once. It is not durable rate limiting (that is the WAF).
 */
const MAX_CONCURRENT_JOBS = 2;
let activeJobs = 0;

function setupError(): ShoeboxError {
  return new ShoeboxError("SETUP_REQUIRED", {
    detail: "SHOEBOX_PASSWORD_HASH",
  });
}

function decodeStrict(part: string | undefined): Buffer {
  if (part === undefined || !BASE64URL.test(part)) {
    throw setupError();
  }
  const bytes = Buffer.from(part, "base64url");
  if (bytes.toString("base64url") !== part) {
    throw setupError();
  }
  return bytes;
}

function parseVerifier(verifier: string): { salt: Buffer; key: Buffer } {
  const parts = verifier.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt-v1") {
    throw setupError();
  }
  const salt = decodeStrict(parts[1]);
  const key = decodeStrict(parts[2]);
  if (salt.byteLength < MIN_SALT_BYTES || key.byteLength !== KEY_BYTES) {
    throw setupError();
  }
  return { salt, key };
}

function derive(password: Buffer, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(new ShoeboxError("UNAVAILABLE"));
      else resolve(key);
    });
  });
}

/**
 * Verifies the exact password bytes (no trimming or Unicode normalization)
 * against a `scrypt-v1$<salt>$<key>` verifier. Malformed verifiers fail closed.
 */
export async function verifyPassword(
  password: string,
  verifier: string,
): Promise<boolean> {
  const { salt, key } = parseVerifier(verifier);
  const bytes = Buffer.from(password, "utf8");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PASSWORD_BYTES) {
    return false;
  }
  if (activeJobs >= MAX_CONCURRENT_JOBS) {
    throw new ShoeboxError("UNAVAILABLE", {
      retryAfterSeconds: 1,
      detail: "password_busy",
    });
  }
  activeJobs += 1;
  try {
    return timingSafeEqual(await derive(bytes, salt), key);
  } finally {
    activeJobs -= 1;
  }
}
