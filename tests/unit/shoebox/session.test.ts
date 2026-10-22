import { SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "@/features/shoebox/server/config";
import { ShoeboxError } from "@/features/shoebox/server/errors";
import {
  clearedSessionCookie,
  issueSession,
  requireRequestSession,
  requireShoeboxSession,
  sessionCookie,
  sessionCookieName,
  verifySession,
} from "@/features/shoebox/server/session";
import { FAKE_APP_ORIGIN } from "../../helpers/safe-env";
import {
  OTHER_SESSION_SECRET,
  SYNTHETIC_SESSION_SECRET,
} from "../../helpers/shoebox-auth";

const cookieJar = vi.hoisted(() => ({
  value: undefined as string | undefined,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "__Host-shoebox" && cookieJar.value !== undefined
        ? { name, value: cookieJar.value }
        : undefined,
  }),
}));

const NOW = 1_800_000_000;
const WEEK = 604_800;

function key(secret = SYNTHETIC_SESSION_SECRET): Uint8Array {
  return new Uint8Array(Buffer.from(secret, "base64url"));
}

type Forge = {
  alg?: string;
  secret?: string;
  issuer?: string;
  audience?: string;
  iat?: number;
  exp?: number;
  payload?: Record<string, unknown>;
};

async function forge(options: Forge = {}): Promise<string> {
  const iat = options.iat ?? NOW;
  return new SignJWT(
    options.payload ?? { v: 1, jti: "5b1d7f3c-8a2e-4c11-9d3e-0f1e2d3c4b5a" },
  )
    .setProtectedHeader({ alg: options.alg ?? "HS256", typ: "JWT" })
    .setIssuer(options.issuer ?? "tor-landa:shoebox")
    .setAudience(options.audience ?? "shoebox")
    .setIssuedAt(iat)
    .setExpirationTime(options.exp ?? iat + WEEK)
    .sign(key(options.secret));
}

afterEach(() => {
  vi.unstubAllEnvs();
  cookieJar.value = undefined;
});

describe("issueSession / verifySession", () => {
  it("issues a seven-day absolute session that expires exactly at issuedAt+604,800", async () => {
    const { token, session } = await issueSession(NOW);
    expect(session.issuedAt).toBe(NOW);
    expect(session.expiresAt - session.issuedAt).toBe(604_800);
    expect(session.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(await verifySession(token, session.issuedAt)).toEqual(session);
    expect(await verifySession(token, session.expiresAt - 1)).toEqual(session);
    expect(await verifySession(token, session.expiresAt)).toBeNull();
    expect(await verifySession(`${token}x`, session.issuedAt)).toBeNull();
  });

  it("uses a fresh random id per session", async () => {
    const a = await issueSession(NOW);
    const b = await issueSession(NOW);
    expect(a.session.id).not.toBe(b.session.id);
  });

  it("signs HS256 with the fixed issuer, audience and version", async () => {
    const { token } = await issueSession(NOW);
    const [header, payload] = token
      .split(".")
      .slice(0, 2)
      .map((part) => JSON.parse(Buffer.from(part, "base64url").toString()));
    expect(header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(payload).toEqual({
      v: 1,
      jti: expect.any(String),
      iss: "tor-landa:shoebox",
      aud: "shoebox",
      iat: NOW,
      exp: NOW + WEEK,
    });
  });

  it("accepts a correctly forged-by-us token (sanity check for the cases below)", async () => {
    expect(await verifySession(await forge(), NOW)).not.toBeNull();
  });

  it.each([
    ["absent", async () => undefined],
    ["empty", async () => ""],
    ["garbage", async () => "not.a.token"],
    [
      "unsigned (alg none)",
      async () => {
        const [, payload] = (await forge()).split(".");
        const header = Buffer.from('{"alg":"none","typ":"JWT"}').toString(
          "base64url",
        );
        return `${header}.${payload}.`;
      },
    ],
    [
      "signed with another secret",
      () => forge({ secret: OTHER_SESSION_SECRET }),
    ],
    ["HS512", () => forge({ alg: "HS512" })],
    ["HS384", () => forge({ alg: "HS384" })],
    ["wrong audience", () => forge({ audience: "someone-else" })],
    ["wrong issuer", () => forge({ issuer: "tor-landa:other" })],
    ["iat in the future", () => forge({ iat: NOW + 1 })],
    ["lifetime above seven days", () => forge({ exp: NOW + WEEK + 1 })],
    ["non-positive lifetime", () => forge({ exp: NOW })],
    [
      "version 2",
      () =>
        forge({
          payload: { v: 2, jti: "5b1d7f3c-8a2e-4c11-9d3e-0f1e2d3c4b5a" },
        }),
    ],
    [
      "string version",
      () =>
        forge({
          payload: { v: "1", jti: "5b1d7f3c-8a2e-4c11-9d3e-0f1e2d3c4b5a" },
        }),
    ],
    [
      "missing version",
      () => forge({ payload: { jti: "5b1d7f3c-8a2e-4c11-9d3e-0f1e2d3c4b5a" } }),
    ],
    ["malformed id", () => forge({ payload: { v: 1, jti: "abc" } })],
    ["missing id", () => forge({ payload: { v: 1 } })],
    ["fractional iat", () => forge({ iat: NOW - 0.5, exp: NOW + 1000 })],
  ])("rejects a %s token", async (_, make) => {
    expect(await verifySession(await make(), NOW)).toBeNull();
  });

  it("rejects a token over 2,048 bytes before verifying it", async () => {
    const padded = await forge({
      payload: {
        v: 1,
        jti: "5b1d7f3c-8a2e-4c11-9d3e-0f1e2d3c4b5a",
        pad: "a".repeat(2_000),
      },
    });
    expect(padded.length).toBeGreaterThan(2_048);
    expect(await verifySession(padded, NOW)).toBeNull();
  });

  it("invalidates every session when the secret is rotated", async () => {
    const { token } = await issueSession(NOW);
    vi.stubEnv("SHOEBOX_SESSION_SECRET", OTHER_SESSION_SECRET);
    expect(await verifySession(token, NOW)).toBeNull();
  });

  it.each([
    ["too short (31 bytes)", Buffer.alloc(31, 9).toString("base64url")],
    ["not base64url", "!".repeat(48)],
    ["padded", `${SYNTHETIC_SESSION_SECRET}=`],
  ])(
    "fails closed with SETUP_REQUIRED when the secret is %s",
    async (_, secret) => {
      vi.stubEnv("SHOEBOX_SESSION_SECRET", secret);
      await expect(issueSession(NOW)).rejects.toMatchObject({
        code: "SETUP_REQUIRED",
        detail: "SHOEBOX_SESSION_SECRET",
      });
      await expect(verifySession("x", NOW)).rejects.toMatchObject({
        code: "SETUP_REQUIRED",
      });
    },
  );
});

describe("session cookies", () => {
  it("uses the exact production flags with a matching max-age", async () => {
    const { token, session } = await issueSession(NOW);
    expect(sessionCookie(token, session, getConfig())).toBe(
      `__Host-shoebox=${token}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Strict`,
    );
    expect(clearedSessionCookie(getConfig())).toBe(
      "__Host-shoebox=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict",
    );
  });

  it("uses the local cookie only for development on a loopback origin outside Vercel", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SHOEBOX_APP_ORIGIN", "http://127.0.0.1:3100");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");
    expect(sessionCookieName(getConfig())).toBe("shoebox-dev");
    expect(clearedSessionCookie(getConfig())).toBe(
      "shoebox-dev=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict",
    );
  });

  it.each([
    [
      "production on loopback",
      { NODE_ENV: "production", SHOEBOX_APP_ORIGIN: "http://localhost:3000" },
    ],
    [
      "test on loopback",
      { NODE_ENV: "test", SHOEBOX_APP_ORIGIN: "http://localhost:3000" },
    ],
    [
      "development on https",
      { NODE_ENV: "development", SHOEBOX_APP_ORIGIN: "https://shoebox.test" },
    ],
    [
      "development on https localhost",
      { NODE_ENV: "development", SHOEBOX_APP_ORIGIN: "https://localhost:3000" },
    ],
    [
      "development on a Vercel deployment",
      {
        NODE_ENV: "development",
        SHOEBOX_APP_ORIGIN: "http://localhost:3000",
        VERCEL: "1",
      },
    ],
    [
      "development with a Vercel environment",
      {
        NODE_ENV: "development",
        SHOEBOX_APP_ORIGIN: "http://localhost:3000",
        VERCEL_ENV: "preview",
      },
    ],
  ])("never issues the local cookie for %s", (_, env) => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");
    for (const [name, value] of Object.entries(env)) {
      vi.stubEnv(name, value);
    }
    expect(sessionCookieName(getConfig())).toBe("__Host-shoebox");
  });
});

describe("requireRequestSession", () => {
  function request(cookie?: string): Request {
    return new Request(`${FAKE_APP_ORIGIN}/api/shoebox/session`, {
      headers: cookie === undefined ? {} : { cookie },
    });
  }

  it("returns the session from the production cookie", async () => {
    const { token, session } = await issueSession(NOW);
    expect(
      await requireRequestSession(request(`a=b; __Host-shoebox=${token}`), NOW),
    ).toEqual(session);
  });

  it("does not accept the local cookie name outside local development", async () => {
    const { token } = await issueSession(NOW);
    await expect(
      requireRequestSession(request(`shoebox-dev=${token}`), NOW),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it.each([
    ["no cookie", undefined],
    ["forged cookie", "__Host-shoebox=abc.def.ghi"],
  ])("throws UNAUTHORIZED for %s", async (_, cookie) => {
    await expect(
      requireRequestSession(request(cookie), NOW),
    ).rejects.toBeInstanceOf(ShoeboxError);
    await expect(
      requireRequestSession(request(cookie), NOW),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });
});

describe("requireShoeboxSession", () => {
  it("reads the cookie with await cookies() and verifies it", async () => {
    const { token } = await issueSession(Math.floor(Date.now() / 1000));
    cookieJar.value = token;
    const session = await requireShoeboxSession();
    expect(session.expiresAt - session.issuedAt).toBe(WEEK);
  });

  it("throws UNAUTHORIZED without a valid cookie", async () => {
    await expect(requireShoeboxSession()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    cookieJar.value = "forged";
    await expect(requireShoeboxSession()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
