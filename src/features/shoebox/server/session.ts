import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { MAX_SESSION_TOKEN_BYTES, SESSION_LIFETIME_SECONDS } from "../limits";
import { getConfig, type ShoeboxConfig } from "./config";
import { ShoeboxError } from "./errors";

/** Epoch seconds. Server-only: the browser only ever receives `expiresAt`. */
export type Session = { id: string; issuedAt: number; expiresAt: number };

const ALGORITHM = "HS256";
const ISSUER = "tor-landa:shoebox";
const AUDIENCE = "shoebox";
const VERSION = 1;
const MIN_SECRET_BYTES = 32;

const SECURE_COOKIE = "__Host-shoebox";
const LOCAL_COOKIE = "shoebox-dev";
const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function epochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Decodes the independent random secret; never derived from the password. */
export function sessionKey(config: ShoeboxConfig): Uint8Array {
  const raw = config.sessionSecret;
  const bytes = /^[A-Za-z0-9_-]+$/.test(raw)
    ? Buffer.from(raw, "base64url")
    : Buffer.alloc(0);
  if (
    bytes.byteLength < MIN_SECRET_BYTES ||
    bytes.toString("base64url") !== raw
  ) {
    throw new ShoeboxError("SETUP_REQUIRED", {
      detail: "SHOEBOX_SESSION_SECRET",
    });
  }
  return new Uint8Array(bytes);
}

/**
 * The non-Secure local cookie exists only for `next dev` on a configured
 * loopback http origin outside any Vercel deployment. Everything else,
 * including production builds and tests, uses the `__Host-` cookie.
 */
function isLocalDevelopment(config: ShoeboxConfig): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  if (process.env.VERCEL || process.env.VERCEL_ENV) return false;
  const origin = new URL(config.appOrigin);
  return (
    origin.protocol === "http:" && LOOPBACK_HOSTS.includes(origin.hostname)
  );
}

export function sessionCookieName(config: ShoeboxConfig): string {
  return isLocalDevelopment(config) ? LOCAL_COOKIE : SECURE_COOKIE;
}

function cookieAttributes(config: ShoeboxConfig, maxAge: number): string {
  const secure = isLocalDevelopment(config) ? "" : "; Secure";
  return `Path=/; Max-Age=${maxAge}; HttpOnly${secure}; SameSite=Strict`;
}

/** Set-Cookie value whose Max-Age matches the signed absolute expiry. */
export function sessionCookie(
  token: string,
  session: Session,
  config: ShoeboxConfig,
): string {
  const maxAge = session.expiresAt - session.issuedAt;
  return `${sessionCookieName(config)}=${token}; ${cookieAttributes(config, maxAge)}`;
}

export function clearedSessionCookie(config: ShoeboxConfig): string {
  return `${sessionCookieName(config)}=; ${cookieAttributes(config, 0)}`;
}

export async function issueSession(
  nowSeconds: number = epochSeconds(),
  config: ShoeboxConfig = getConfig(),
): Promise<{ token: string; session: Session }> {
  const key = sessionKey(config);
  const session: Session = {
    id: crypto.randomUUID(),
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + SESSION_LIFETIME_SECONDS,
  };
  const token = await new SignJWT({ v: VERSION })
    .setProtectedHeader({ alg: ALGORITHM, typ: "JWT" })
    .setJti(session.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(session.issuedAt)
    .setExpirationTime(session.expiresAt)
    .sign(key);
  return { token, session };
}

/** Returns the session, or null for any absent, forged or expired token. */
export async function verifySession(
  token: string | undefined,
  nowSeconds: number = epochSeconds(),
  config: ShoeboxConfig = getConfig(),
): Promise<Session | null> {
  const key = sessionKey(config);
  if (
    !token ||
    new TextEncoder().encode(token).byteLength > MAX_SESSION_TOKEN_BYTES
  ) {
    return null;
  }
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, key, {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: new Date(nowSeconds * 1000),
      clockTolerance: 0,
      requiredClaims: ["jti", "iat", "exp"],
    }));
  } catch {
    return null;
  }
  const { v, jti, iat, exp, aud } = payload;
  if (
    v !== VERSION ||
    aud !== AUDIENCE ||
    typeof jti !== "string" ||
    !UUID_PATTERN.test(jti) ||
    !Number.isSafeInteger(iat) ||
    !Number.isSafeInteger(exp)
  ) {
    return null;
  }
  const issuedAt = iat as number;
  const expiresAt = exp as number;
  const lifetime = expiresAt - issuedAt;
  if (
    issuedAt > nowSeconds ||
    nowSeconds >= expiresAt ||
    lifetime <= 0 ||
    lifetime > SESSION_LIFETIME_SECONDS
  ) {
    return null;
  }
  return { id: jti, issuedAt, expiresAt };
}

function readCookie(header: string | null, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index !== -1 && part.slice(0, index).trim() === name) {
      return part.slice(index + 1).trim();
    }
  }
  return undefined;
}

/** Authenticates a Route Handler request on its own; never trusts the page. */
export async function requireRequestSession(
  request: Request,
  nowSeconds: number = epochSeconds(),
  config: ShoeboxConfig = getConfig(),
): Promise<Session> {
  const token = readCookie(
    request.headers.get("cookie"),
    sessionCookieName(config),
  );
  const session = await verifySession(token, nowSeconds, config);
  if (!session) {
    throw new ShoeboxError("UNAUTHORIZED");
  }
  return session;
}

/** Server Component guard: reads the request cookie with `await cookies()`. */
export async function requireShoeboxSession(): Promise<Session> {
  const config = getConfig();
  const store = await cookies();
  const token = store.get(sessionCookieName(config))?.value;
  const session = await verifySession(token, epochSeconds(), config);
  if (!session) {
    throw new ShoeboxError("UNAUTHORIZED");
  }
  return session;
}
