import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "@/features/shoebox/server/config";
import { ShoeboxError } from "@/features/shoebox/server/errors";
import {
  assertMutationOrigin,
  assertSameOriginRead,
  privateJson,
  toErrorResponse,
} from "@/features/shoebox/server/http";
import { ValidationError } from "@/features/shoebox/validation";
import { FAKE_APP_ORIGIN } from "../../helpers/safe-env";

const ORIGIN = FAKE_APP_ORIGIN;

describe("privateJson", () => {
  it("marks every response private and uncacheable", async () => {
    const response = privateJson({ ok: true }, 201);
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("CDN-Cache-Control")).toBe("no-store");
    expect(response.headers.get("Vercel-CDN-Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe(
      "same-origin",
    );
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("defaults to 200 and always carries no-store", () => {
    const response = privateJson({});
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});

describe("assertMutationOrigin", () => {
  it("accepts the configured origin", () => {
    expect(() =>
      assertMutationOrigin(new Headers({ origin: ORIGIN }), ORIGIN),
    ).not.toThrow();
    expect(() =>
      assertMutationOrigin(
        new Headers({ origin: ORIGIN, "sec-fetch-site": "same-origin" }),
        `${ORIGIN}/ignored/path`,
      ),
    ).not.toThrow();
  });

  it("rejects missing, null, empty and foreign origins", () => {
    for (const headers of [
      new Headers(),
      new Headers({ origin: "null" }),
      new Headers({ origin: "" }),
      new Headers({ origin: "https://evil.test" }),
      new Headers({ origin: "http://shoebox.test" }),
      new Headers({ origin: "https://shoebox.test:8443" }),
      new Headers({ origin: "https://sub.shoebox.test" }),
    ]) {
      expect(() => assertMutationOrigin(headers, ORIGIN)).toThrow(ShoeboxError);
    }
  });

  it("does not trust Host or forwarded headers", () => {
    const headers = new Headers({
      host: "shoebox.test",
      "x-forwarded-host": "shoebox.test",
      origin: "https://evil.test",
    });
    expect(() => assertMutationOrigin(headers, ORIGIN)).toThrow(ShoeboxError);
  });

  it("rejects cross-site Fetch Metadata even with a matching origin", () => {
    for (const site of ["cross-site", "same-site", "none"]) {
      expect(() =>
        assertMutationOrigin(
          new Headers({ origin: ORIGIN, "sec-fetch-site": site }),
          ORIGIN,
        ),
      ).toThrow(ShoeboxError);
    }
  });
});

describe("assertSameOriginRead", () => {
  it("allows ordinary same-origin media GETs that carry no Origin", () => {
    expect(() => assertSameOriginRead(new Headers())).not.toThrow();
    expect(() =>
      assertSameOriginRead(new Headers({ "sec-fetch-site": "same-origin" })),
    ).not.toThrow();
  });

  it("denies cross-site and same-site reads", () => {
    for (const site of ["cross-site", "same-site"]) {
      expect(() =>
        assertSameOriginRead(new Headers({ "sec-fetch-site": site })),
      ).toThrow(ShoeboxError);
    }
  });
});

describe("toErrorResponse", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  const CANARY = "https://www.notion.so/secret?token=SECRET-CANARY note-canary";

  it("never leaks raw error details", async () => {
    const response = toErrorResponse(new Error(CANARY));
    const text = await response.text();
    expect(response.status).toBe(503);
    expect(text).not.toContain("SECRET-CANARY");
    expect(text).not.toContain("notion.so");
    expect(text).not.toContain("note-canary");
    const body = JSON.parse(text);
    expect(body.error.code).toBe("UNAVAILABLE");
    expect(body.error.diagnosticId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("uses fixed Spanish messages and fresh diagnostic ids", async () => {
    const a = await toErrorResponse(new ShoeboxError("FORBIDDEN")).json();
    const b = await toErrorResponse(new ShoeboxError("FORBIDDEN")).json();
    expect(a.error.code).toBe("FORBIDDEN");
    expect(a.error.message).toBe("Esta petición no está permitida.");
    expect(a.error.diagnosticId).not.toBe(b.error.diagnosticId);
  });

  it("maps validation shape errors to 400 and semantic ones to 422", () => {
    expect(toErrorResponse(new ValidationError("shape")).status).toBe(400);
    expect(toErrorResponse(new ValidationError("semantic")).status).toBe(422);
  });

  it("maps size errors to 413 and reports retry hints", async () => {
    expect(toErrorResponse(new ShoeboxError("TOO_LARGE")).status).toBe(413);
    const limited = toErrorResponse(
      new ShoeboxError("RATE_LIMITED", { retryAfterSeconds: 30 }),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("30");
    expect((await limited.json()).error.retryAfterSeconds).toBe(30);
  });
});

describe("server diagnostics log", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs code and diagnosticId without leaking error content", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const canary = "https://www.notion.so/x?token=SECRET-CANARY note-canary";
    const error = new Error(canary);
    error.stack = `${canary}\n at secret`;
    const response = toErrorResponse(error);
    const { diagnosticId } = (await response.json()).error;
    expect(spy).toHaveBeenCalledTimes(1);
    const logged = spy.mock.calls.flat().map(String).join(" ");
    expect(logged).toContain(diagnosticId);
    expect(logged).toContain("UNAVAILABLE");
    for (const leak of [
      "SECRET-CANARY",
      "notion.so",
      "note-canary",
      "secret",
    ]) {
      expect(logged).not.toContain(leak);
    }
  });

  it("names only the missing setup variable", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const saved = process.env.SHOEBOX_SESSION_SECRET;
    try {
      delete process.env.SHOEBOX_SESSION_SECRET;
      try {
        getConfig();
      } catch (error) {
        toErrorResponse(error);
      }
    } finally {
      process.env.SHOEBOX_SESSION_SECRET = saved;
    }
    const logged = String(spy.mock.calls[0]?.[0]);
    expect(logged).toContain("SETUP_REQUIRED");
    expect(logged).toContain("SHOEBOX_SESSION_SECRET");
    expect(logged).not.toContain("test-session-secret");
  });
});

describe("getConfig", () => {
  it("reads the five server variables lazily and normalizes the origin", () => {
    const config = getConfig();
    expect(config.appOrigin).toBe(ORIGIN);
    expect(config.notionDbId).toBe("test-shoebox-db");
  });

  it("requires setup when a variable is missing or the origin is unsafe", () => {
    const saved = { ...process.env };
    try {
      delete process.env.SHOEBOX_SESSION_SECRET;
      expect(() => getConfig()).toThrow(ShoeboxError);
      process.env.SHOEBOX_SESSION_SECRET = saved.SHOEBOX_SESSION_SECRET;
      process.env.SHOEBOX_APP_ORIGIN = "http://example.com";
      expect(() => getConfig()).toThrow(ShoeboxError);
      process.env.SHOEBOX_APP_ORIGIN = "http://127.0.0.1:3100";
      expect(getConfig().appOrigin).toBe("http://127.0.0.1:3100");
    } finally {
      process.env.SHOEBOX_SESSION_SECRET = saved.SHOEBOX_SESSION_SECRET;
      process.env.SHOEBOX_APP_ORIGIN = saved.SHOEBOX_APP_ORIGIN;
    }
  });
});

describe("offline test guard", () => {
  it("blocks non-loopback outbound transport", async () => {
    await expect(fetch("https://example.com/")).rejects.toThrow(
      "outbound network blocked",
    );
    await expect(
      fetch(new Request("https://api.notion.com/v1/users")),
    ).rejects.toThrow("outbound network blocked");
  });
});
