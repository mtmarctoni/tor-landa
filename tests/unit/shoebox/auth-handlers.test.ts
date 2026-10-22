import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthHandlers } from "@/features/shoebox/server/auth-handlers";
import {
  getConfig,
  type ShoeboxConfig,
} from "@/features/shoebox/server/config";
import { ShoeboxError } from "@/features/shoebox/server/errors";
import { FAKE_APP_ORIGIN } from "../../helpers/safe-env";
import {
  makeVerifier,
  SYNTHETIC_PASSWORD,
  SYNTHETIC_PASSWORD_HASH,
} from "../../helpers/shoebox-auth";

const ORIGIN = FAKE_APP_ORIGIN;
const NOW = 1_800_000_000;
const WEEK = 604_800;

let errorLog: ReturnType<typeof vi.spyOn>;
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
  fetchSpy = vi.spyOn(globalThis, "fetch");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function handlers(overrides: Partial<ShoeboxConfig> = {}, now = NOW) {
  return createAuthHandlers({
    config: () => ({ ...getConfig(), ...overrides }),
    now: () => now,
  });
}

type Init = { headers?: Record<string, string | null>; body?: BodyInit | null };

function request(path: string, method: string, init: Init = {}): Request {
  const headers = new Headers({
    origin: ORIGIN,
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
  });
  for (const [name, value] of Object.entries(init.headers ?? {})) {
    if (value === null) headers.delete(name);
    else headers.set(name, value);
  }
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: init.body ?? null,
  });
}

function login(body: unknown, headers: Init["headers"] = {}): Request {
  return request("/api/shoebox/session", "POST", {
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function sessionGet(cookie?: string, headers: Init["headers"] = {}): Request {
  return request("/api/shoebox/session", "GET", {
    headers: { origin: null, ...(cookie ? { cookie } : {}), ...headers },
  });
}

function cookiePair(response: Response): string {
  return (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
}

function expectPrivate(response: Response) {
  expect(response.headers.get("cache-control")).toBe(
    "private, no-store, max-age=0",
  );
  expect(response.headers.get("cdn-cache-control")).toBe("no-store");
}

async function errorShape(response: Response) {
  const body = (await response.json()) as {
    error: { code: string; message: string; diagnosticId: string };
  };
  return {
    status: response.status,
    keys: Object.keys(body.error).sort(),
    code: body.error.code,
    message: body.error.message,
    cookie: response.headers.get("set-cookie"),
  };
}

describe("login", () => {
  it("succeeds only with the real password and sets the exact production cookie", async () => {
    const response = await handlers().login(
      login({ password: SYNTHETIC_PASSWORD }),
    );
    expect(response.status).toBe(200);
    expectPrivate(response);
    expect(await response.json()).toEqual({ expiresAt: NOW + WEEK });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(
      /^__Host-shoebox=[\w-]+\.[\w-]+\.[\w-]+; Path=\/; Max-Age=604800; HttpOnly; Secure; SameSite=Strict$/,
    );
    expect(cookie).not.toMatch(/Domain/i);

    const check = await handlers().getSession(sessionGet(cookiePair(response)));
    expect(check.status).toBe(200);
    expect(await check.json()).toEqual({ expiresAt: NOW + WEEK });
  });

  it("returns the same generic 401 regardless of verifier details", async () => {
    const shapes = [
      await errorShape(
        await handlers().login(login({ password: "incorrecta" })),
      ),
      await errorShape(
        await handlers({
          passwordHash: makeVerifier("otra", new Uint8Array(32).fill(1)),
        }).login(login({ password: "incorrecta" })),
      ),
      await errorShape(await handlers().login(login({ password: "" }))),
      await errorShape(
        await handlers().login(login({ password: `${SYNTHETIC_PASSWORD} ` })),
      ),
      await errorShape(
        await handlers().login(login({ password: "é".repeat(513) })),
      ),
    ];
    for (const shape of shapes) {
      expect(shape).toEqual(shapes[0]);
    }
    expect(shapes[0]).toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
      keys: ["code", "diagnosticId", "message"],
      cookie: null,
    });
  });

  it("enforces 1,024 password bytes even when the verifier matches", async () => {
    const max = "é".repeat(512);
    const over = `${max}a`;
    const ok = await handlers({ passwordHash: makeVerifier(max) }).login(
      login({ password: max }),
    );
    expect(ok.status).toBe(200);
    const tooLong = await handlers({ passwordHash: makeVerifier(over) }).login(
      login({ password: over }),
    );
    expect(tooLong.status).toBe(401);
  });

  it("accepts a 4,096-byte body and rejects 4,097 bytes with 413", async () => {
    const json = JSON.stringify({ password: SYNTHETIC_PASSWORD });
    const exact = json + " ".repeat(4_096 - Buffer.byteLength(json));
    expect(Buffer.byteLength(exact)).toBe(4_096);
    expect((await handlers().login(login(exact))).status).toBe(200);
    const over = await handlers().login(login(`${exact} `));
    expect(over.status).toBe(413);
    expect((await over.json()).error.code).toBe("TOO_LARGE");
  });

  it.each([
    ["invalid JSON", "{password:"],
    ["invalid UTF-8", new Uint8Array([0x7b, 0xff, 0x7d])],
    ["an array", "[]"],
    ["null", "null"],
    ["a non-string password", JSON.stringify({ password: 12345 })],
    ["a missing password", JSON.stringify({})],
    [
      "an extra field",
      JSON.stringify({ password: SYNTHETIC_PASSWORD, next: "/" }),
    ],
    ["an empty body", ""],
  ])("rejects %s with 400 and no cookie", async (_, body) => {
    const response = await handlers().login(
      request("/api/shoebox/session", "POST", { body }),
    );
    expect(response.status).toBe(400);
    expectPrivate(response);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each([
    ["a missing Origin", { origin: null }],
    ["a null Origin", { origin: "null" }],
    ["a foreign Origin", { origin: "https://evil.test" }],
    ["cross-site Fetch Metadata", { "sec-fetch-site": "cross-site" }],
    ["same-site Fetch Metadata", { "sec-fetch-site": "same-site" }],
  ])("rejects %s with 403 before any password work", async (_, headers) => {
    const response = await handlers().login(
      login({ password: SYNTHETIC_PASSWORD }, headers),
    );
    expect(response.status).toBe(403);
    expectPrivate(response);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("answers 503 when more than two password checks run at once", async () => {
    const auth = handlers();
    const responses = await Promise.all(
      ["a", "b", "c"].map((password) => auth.login(login({ password }))),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([401, 401, 503]);
    const busy = responses.find((r) => r.status === 503) as Response;
    expectPrivate(busy);
    expect((await busy.json()).error.code).toBe("UNAVAILABLE");
  });

  it.each([
    [
      "missing configuration",
      () => {
        throw new ShoeboxError("SETUP_REQUIRED", {
          detail: "SHOEBOX_PASSWORD_HASH",
        });
      },
    ],
    [
      "a malformed verifier",
      () => ({ ...getConfig(), passwordHash: "scrypt-v1$x$y" }),
    ],
    [
      "a weak session secret",
      () => ({ ...getConfig(), sessionSecret: "c2hvcnQ" }),
    ],
  ])("fails closed with 503 SETUP_REQUIRED for %s", async (_, config) => {
    const response = await createAuthHandlers({ config, now: () => NOW }).login(
      login({ password: SYNTHETIC_PASSWORD }),
    );
    expect(response.status).toBe(503);
    expectPrivate(response);
    expect((await response.json()).error.code).toBe("SETUP_REQUIRED");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("issues the secure cookie for production even on a loopback origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await handlers({
      appOrigin: "http://127.0.0.1:3100",
    }).login(
      login(
        { password: SYNTHETIC_PASSWORD },
        { origin: "http://127.0.0.1:3100" },
      ),
    );
    expect(response.headers.get("set-cookie")).toMatch(
      /^__Host-shoebox=.*; Secure; SameSite=Strict$/,
    );
  });

  it("issues the separate local cookie only in local development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");
    const local = { appOrigin: "http://127.0.0.1:3100" };
    const response = await handlers(local).login(
      login(
        { password: SYNTHETIC_PASSWORD },
        { origin: "http://127.0.0.1:3100" },
      ),
    );
    expect(response.headers.get("set-cookie")).toMatch(
      /^shoebox-dev=[\w.-]+; Path=\/; Max-Age=604800; HttpOnly; SameSite=Strict$/,
    );
    const check = await handlers(local).getSession(
      sessionGet(cookiePair(response)),
    );
    expect(check.status).toBe(200);
  });

  it("never logs the password or the verifier", async () => {
    await handlers().login(login({ password: "contraseña-canario" }));
    await handlers({ passwordHash: `${SYNTHETIC_PASSWORD_HASH}$` }).login(
      login({ password: "contraseña-canario" }),
    );
    const logged = errorLog.mock.calls.flat().map(String).join("\n");
    expect(logged).toContain("UNAUTHORIZED");
    expect(logged).toContain("SETUP_REQUIRED");
    expect(logged).not.toContain("contraseña-canario");
    expect(logged).not.toContain(SYNTHETIC_PASSWORD_HASH.split("$")[2]);
    expect(logged).not.toContain(SYNTHETIC_PASSWORD_HASH.split("$")[1]);
  });
});

describe("getSession", () => {
  async function loggedInCookie(): Promise<string> {
    return cookiePair(
      await handlers().login(login({ password: SYNTHETIC_PASSWORD })),
    );
  }

  it("returns 401 JSON, never a redirect, without a cookie", async () => {
    const response = await handlers().getSession(sessionGet());
    expect(response.status).toBe(401);
    expectPrivate(response);
    expect(response.headers.get("location")).toBeNull();
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 once the absolute expiry is reached, without refreshing", async () => {
    const cookie = await loggedInCookie();
    const before = await handlers({}, NOW + WEEK - 1).getSession(
      sessionGet(cookie),
    );
    expect(before.status).toBe(200);
    expect(before.headers.get("set-cookie")).toBeNull();
    const after = await handlers({}, NOW + WEEK).getSession(sessionGet(cookie));
    expect(after.status).toBe(401);
  });

  it("rejects a forged cookie and cross-site reads", async () => {
    const cookie = await loggedInCookie();
    expect((await handlers().getSession(sessionGet(`${cookie}x`))).status).toBe(
      401,
    );
    const crossSite = await handlers().getSession(
      sessionGet(cookie, { "sec-fetch-site": "cross-site" }),
    );
    expect(crossSite.status).toBe(403);
    expectPrivate(crossSite);
  });
});

describe("logout", () => {
  function logout(init: Init = {}): Request {
    return request("/api/shoebox/logout", "POST", init);
  }

  it("answers 204, clears the matching cookie and is idempotent", async () => {
    for (let i = 0; i < 2; i += 1) {
      const response = await handlers().logout(logout());
      expect(response.status).toBe(204);
      expectPrivate(response);
      expect(response.headers.get("set-cookie")).toBe(
        "__Host-shoebox=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict",
      );
      expect(await response.text()).toBe("");
    }
  });

  it("clears the local cookie in local development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");
    const response = await handlers({
      appOrigin: "http://localhost:3100",
    }).logout(logout({ headers: { origin: "http://localhost:3100" } }));
    expect(response.headers.get("set-cookie")).toBe(
      "shoebox-dev=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict",
    );
  });

  it.each([
    ["a missing Origin", { origin: null }],
    ["a foreign Origin", { origin: "https://evil.test" }],
    ["cross-site Fetch Metadata", { "sec-fetch-site": "cross-site" }],
  ])(
    "keeps the origin guard for %s even when logged out",
    async (_, headers) => {
      const response = await handlers().logout(logout({ headers }));
      expect(response.status).toBe(403);
      expectPrivate(response);
      expect(response.headers.get("set-cookie")).toBeNull();
    },
  );

  it("rejects a non-empty body", async () => {
    const response = await handlers().logout(logout({ body: "{}" }));
    expect(response.status).toBe(413);
  });
});

describe("unauthenticated requests", () => {
  it("never reach Notion or any other network service", async () => {
    await handlers().getSession(sessionGet());
    await handlers().login(login({ password: "incorrecta" }));
    await handlers().logout(request("/api/shoebox/logout", "POST"));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
