import { describe, expect, it } from "vitest";
import { ShoeboxError } from "@/features/shoebox/server/errors";
import { verifyPassword } from "@/features/shoebox/server/password";
import {
  makeVerifier,
  SYNTHETIC_PASSWORD,
  SYNTHETIC_PASSWORD_HASH,
} from "../../helpers/shoebox-auth";

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof ShoeboxError ? error.code : "non-shoebox-error";
  }
  return undefined;
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");

describe("verifyPassword", () => {
  it("accepts the right password through real scrypt verification", async () => {
    expect(
      await verifyPassword(SYNTHETIC_PASSWORD, SYNTHETIC_PASSWORD_HASH),
    ).toBe(true);
  });

  it("rejects a wrong password", async () => {
    expect(await verifyPassword("otra cosa", SYNTHETIC_PASSWORD_HASH)).toBe(
      false,
    );
  });

  it("does not trim or normalize the password", async () => {
    const composed = "café sintético";
    const verifier = makeVerifier(composed);
    expect(await verifyPassword(composed, verifier)).toBe(true);
    expect(await verifyPassword("café sintético", verifier)).toBe(false);
    expect(await verifyPassword(` ${composed}`, verifier)).toBe(false);
    expect(await verifyPassword(`${composed} `, verifier)).toBe(false);
  });

  it("allows 1,024 UTF-8 bytes and rejects 1,025 without scrypt work", async () => {
    // "é" is two UTF-8 bytes: 512 of them are exactly 1,024 bytes.
    const max = "é".repeat(512);
    expect(await verifyPassword(max, makeVerifier(max))).toBe(true);
    const over = `${max}a`;
    expect(await verifyPassword(over, makeVerifier(over))).toBe(false);
  });

  it("rejects an empty password", async () => {
    expect(await verifyPassword("", makeVerifier(""))).toBe(false);
  });

  it("accepts any salt of at least 16 bytes", async () => {
    const verifier = makeVerifier("x", new Uint8Array(32).fill(3));
    expect(await verifyPassword("x", verifier)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["unknown scheme", SYNTHETIC_PASSWORD_HASH.replace("scrypt-v1", "scrypt")],
    [
      "future scheme",
      SYNTHETIC_PASSWORD_HASH.replace("scrypt-v1", "scrypt-v2"),
    ],
    ["extra cost segment", SYNTHETIC_PASSWORD_HASH.replace("$", "$16384$")],
    ["cost parameters", `scrypt-v1$N=1024,r=1,p=1$${b64(new Uint8Array(64))}`],
    ["missing key", `scrypt-v1$${b64(new Uint8Array(16))}`],
    [
      "short salt",
      `scrypt-v1$${b64(new Uint8Array(15))}$${b64(new Uint8Array(64))}`,
    ],
    [
      "short key",
      `scrypt-v1$${b64(new Uint8Array(16))}$${b64(new Uint8Array(32))}`,
    ],
    [
      "long key",
      `scrypt-v1$${b64(new Uint8Array(16))}$${b64(new Uint8Array(65))}`,
    ],
    ["padded base64", `${SYNTHETIC_PASSWORD_HASH}=`],
    [
      "standard base64",
      `scrypt-v1$++++++++++++++++++++++$${b64(new Uint8Array(64))}`,
    ],
  ])(
    "fails closed with SETUP_REQUIRED for a %s verifier",
    async (_, verifier) => {
      expect(await codeOf(verifyPassword(SYNTHETIC_PASSWORD, verifier))).toBe(
        "SETUP_REQUIRED",
      );
    },
  );

  it("names only the variable, never the verifier, in the setup error", async () => {
    try {
      await verifyPassword(SYNTHETIC_PASSWORD, "scrypt-v1$bad");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ShoeboxError);
      const shoebox = error as ShoeboxError;
      expect(shoebox.detail).toBe("SHOEBOX_PASSWORD_HASH");
      expect(`${shoebox.message} ${shoebox.stack}`).not.toContain("bad");
      expect(`${shoebox.message}`).not.toContain(SYNTHETIC_PASSWORD);
    }
  });

  it("caps concurrent scrypt jobs at two per instance with a 503", async () => {
    const jobs = [
      verifyPassword("uno", SYNTHETIC_PASSWORD_HASH),
      verifyPassword("dos", SYNTHETIC_PASSWORD_HASH),
      verifyPassword("tres", SYNTHETIC_PASSWORD_HASH),
    ];
    const results = await Promise.allSettled(jobs);
    expect(results[0]).toEqual({ status: "fulfilled", value: false });
    expect(results[1]).toEqual({ status: "fulfilled", value: false });
    expect(results[2]?.status).toBe("rejected");
    const reason = (results[2] as PromiseRejectedResult).reason as ShoeboxError;
    expect(reason.code).toBe("UNAVAILABLE");
    expect(reason.status).toBe(503);

    // Slots are released afterwards, including after failures.
    expect(
      await verifyPassword(SYNTHETIC_PASSWORD, SYNTHETIC_PASSWORD_HASH),
    ).toBe(true);
  });
});
