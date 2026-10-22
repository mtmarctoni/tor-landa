// Synthetic, test-only credentials. They are derived from fixed fake inputs
// here so no real password, verifier or session secret ever enters a test.
import { createHash, scryptSync } from "node:crypto";

export const SYNTHETIC_PASSWORD = "caja sintética de prueba";

const SCRYPT_OPTIONS = { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** Builds a `scrypt-v1$<salt>$<key>` verifier exactly as the server expects. */
export function makeVerifier(
  password: string,
  salt: Uint8Array = new Uint8Array(16).fill(7),
): string {
  const key = scryptSync(password, salt, 64, SCRYPT_OPTIONS);
  return `scrypt-v1$${Buffer.from(salt).toString("base64url")}$${key.toString("base64url")}`;
}

export const SYNTHETIC_PASSWORD_HASH = makeVerifier(SYNTHETIC_PASSWORD);

/** 32 bytes, base64url, derived from a fixed fake label. */
export const SYNTHETIC_SESSION_SECRET = createHash("sha256")
  .update("tor-landa synthetic shoebox session secret")
  .digest("base64url");

export const OTHER_SESSION_SECRET = createHash("sha256")
  .update("tor-landa another synthetic secret")
  .digest("base64url");
