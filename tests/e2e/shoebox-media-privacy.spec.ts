import { type APIRequestContext, expect, test } from "@playwright/test";
import { SYNTHETIC_PASSWORD } from "../helpers/shoebox-auth";
import { expectPrivateHeaders } from "./shoebox.fixture";

// Real HTTP against the local server up to the upstream boundary. The server
// has synthetic config and cannot reach Notion, so every case here must be
// answered before any record fetch; authenticated byte serving is covered by
// the createMediaHandler unit tests with fake resolve/fetch/inspect.

const ID = "0f0f0f0f-0000-4000-8000-0000000000aa";
const MEDIA = `/api/shoebox/memories/${ID}/media`;
const FORGED = [
  "__Host-shoebox=eyJhbGciOiJIUzI1NiJ9.eyJ2IjoxfQ.Zm9yZ2Vk",
  "shoebox-dev=eyJhbGciOiJIUzI1NiJ9.eyJ2IjoxfQ.Zm9yZ2Vk",
];
const PROBES: Record<string, string>[] = [
  {},
  { Range: "bytes=0-1" },
  { Range: "bytes=0-1,4-5" },
  { "If-None-Match": "*" },
  { "If-Modified-Since": "Wed, 21 Oct 2015 07:28:00 GMT" },
];

/** Logs in through the real session API and returns the cookie pair. */
async function login(request: APIRequestContext, baseURL: string) {
  const response = await request.post("/api/shoebox/session", {
    headers: { Origin: new URL(baseURL).origin },
    data: { password: SYNTHETIC_PASSWORD },
  });
  expect(response.status()).toBe(200);
  const setCookie = response.headers()["set-cookie"] ?? "";
  const pair = setCookie.split(";")[0];
  expect(pair).toMatch(/^(__Host-shoebox|shoebox-dev)=/);
  return pair;
}

function expectNoMedia(headers: Record<string, string>): void {
  expect(headers["content-type"] ?? "").not.toMatch(/^(image|audio)\//);
  expect(headers["content-range"]).toBeUndefined();
  expect(headers.location).toBeUndefined();
  expect(headers.etag).toBeUndefined();
  expect(headers["access-control-allow-origin"]).toBeUndefined();
}

test.describe("media route without a valid session", () => {
  test("GET answers 401 JSON for missing and forged cookies, whatever the headers", async ({
    request,
  }) => {
    for (const cookie of [undefined, ...FORGED]) {
      for (const probe of PROBES) {
        const response = await request.get(MEDIA, {
          headers: { ...probe, ...(cookie ? { Cookie: cookie } : {}) },
          maxRedirects: 0,
        });
        const label = `${cookie ?? "no cookie"} ${JSON.stringify(probe)}`;
        expect(response.status(), label).toBe(401);
        expectPrivateHeaders(response.headers());
        expectNoMedia(response.headers());
        expect((await response.json()).error.code).toBe("UNAUTHORIZED");
      }
    }
  });

  test("HEAD answers 401 with no body, whatever the headers", async ({
    request,
  }) => {
    for (const cookie of [undefined, ...FORGED]) {
      for (const probe of PROBES) {
        const response = await request.head(MEDIA, {
          headers: { ...probe, ...(cookie ? { Cookie: cookie } : {}) },
          maxRedirects: 0,
        });
        expect(response.status()).toBe(401);
        expectPrivateHeaders(response.headers());
        expectNoMedia(response.headers());
        expect((await response.body()).byteLength).toBe(0);
      }
    }
  });

  test("a url= query has no proxy effect", async ({ request }) => {
    for (const query of [
      "?url=https://example.com/a.jpg",
      "?url=%2Fimages%2Fdali1.webp",
      "?url=http://169.254.169.254/latest/meta-data",
    ]) {
      const response = await request.get(`${MEDIA}${query}`, {
        maxRedirects: 0,
      });
      expect(response.status(), query).toBe(401);
      expectPrivateHeaders(response.headers());
      expectNoMedia(response.headers());
    }
  });

  test("other methods and OPTIONS get a private 405 without CORS", async ({
    request,
  }) => {
    for (const method of ["OPTIONS", "POST", "PUT", "PATCH", "DELETE"]) {
      const response = await request.fetch(MEDIA, {
        method,
        headers: {
          Origin: "https://evil.test",
          "Access-Control-Request-Method": "GET",
        },
      });
      expect(response.status(), method).toBe(405);
      expect(response.headers().allow).toBe("GET, HEAD");
      expectPrivateHeaders(response.headers());
      expectNoMedia(response.headers());
    }
  });
});

test.describe("media route with a valid session", () => {
  test("a url= query is refused with 400, never fetched", async ({
    request,
    baseURL,
  }) => {
    const cookie = await login(request, baseURL ?? "http://127.0.0.1:3100");
    for (const query of [
      "?url=https://example.com/a.jpg",
      "?url=http://127.0.0.1:3100/images/dali1.webp",
      "?w=64&q=75",
    ]) {
      for (const method of ["GET", "HEAD"]) {
        const response = await request.fetch(`${MEDIA}${query}`, {
          method,
          headers: { Cookie: cookie },
          maxRedirects: 0,
        });
        expect(response.status(), `${method} ${query}`).toBe(400);
        expectPrivateHeaders(response.headers());
        expectNoMedia(response.headers());
      }
    }
  });

  test("an invalid id is a private 404 before any record fetch", async ({
    request,
    baseURL,
  }) => {
    const cookie = await login(request, baseURL ?? "http://127.0.0.1:3100");
    const response = await request.get(
      "/api/shoebox/memories/not-a-uuid/media",
      {
        headers: { Cookie: cookie, Range: "bytes=0-1" },
      },
    );
    expect(response.status()).toBe(404);
    expectPrivateHeaders(response.headers());
    expectNoMedia(response.headers());
  });
});

test.describe("the image optimizer never serves private media", () => {
  // Exact refusals observed from Next 16.3.0-preview.6. A status range is not
  // enough: with localPatterns widened, the optimizer would call the media
  // route internally and still fail (401/503), so only the exact
  // pattern-refusal text proves the route was never reached.
  const NOT_ALLOWED = '"url" parameter is not allowed';
  const PROTOCOL_RELATIVE =
    '"url" parameter cannot be a protocol-relative URL (//)';
  const NOT_AN_IMAGE = "The requested resource isn't a valid image.";
  const ENCODED_TRAVERSAL = `/images/..%2fapi/shoebox/memories/${ID}/media`;

  function refusals(baseURL: string): [string, string][] {
    const { host, port } = new URL(baseURL);
    return [
      [MEDIA, NOT_ALLOWED],
      [`${MEDIA}?url=/images/dali1.webp`, NOT_ALLOWED],
      [`/images/../api/shoebox/memories/${ID}/media`, NOT_ALLOWED],
      [`/images/%2e%2e/api/shoebox/memories/${ID}/media`, NOT_ALLOWED],
      [`http://${host}${MEDIA}`, NOT_ALLOWED],
      [`http://localhost:${port}${MEDIA}`, NOT_ALLOWED],
      [`//${host}${MEDIA}`, PROTOCOL_RELATIVE],
    ];
  }

  async function optimize(
    request: APIRequestContext,
    target: string,
    cookie?: string,
  ) {
    return request.get(
      `/_next/image?url=${encodeURIComponent(target)}&w=64&q=75`,
      { headers: cookie ? { Cookie: cookie } : {}, maxRedirects: 0 },
    );
  }

  async function expectRefusal(
    request: APIRequestContext,
    target: string,
    message: string,
    cookie?: string,
  ) {
    const label = `${cookie ? "authed" : "anon"} ${target}`;
    const response = await optimize(request, target, cookie);
    expect(response.status(), label).toBe(400);
    expect(await response.text(), label).toBe(message);
    expectNoMedia(response.headers());
    expect(response.headers()["x-nextjs-cache"], label).toBeUndefined();
  }

  test("without a cookie, every private target gets the pattern refusal", async ({
    request,
    baseURL,
  }) => {
    for (const [target, message] of refusals(
      baseURL ?? "http://127.0.0.1:3100",
    )) {
      await expectRefusal(request, target, message);
    }
  });

  test("with a cookie, then without: the same refusal, never a cached authenticated result", async ({
    request,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://127.0.0.1:3100";
    const cookie = await login(request, origin);
    for (const [target, message] of refusals(origin)) {
      await expectRefusal(request, target, message, cookie);
      await expectRefusal(request, target, message);
    }
    // Public artwork still optimizes, so the refusals above are the policy.
    expect((await optimize(request, "/images/dali1.webp")).status()).toBe(200);
  });

  test("an encoded traversal under /images never reaches the media route", async ({
    request,
    baseURL,
  }) => {
    const cookie = await login(request, baseURL ?? "http://127.0.0.1:3100");
    // The optimizer resolves this path with the same router as a direct
    // request (fetchInternalImage -> handleRequest). Directly, it is Next's
    // HTML 404, not the media route's JSON (401 without, 400/404/503 with a
    // session), so the route handler is not what answers it.
    for (const headers of [{}, { Cookie: cookie }] as Record<
      string,
      string
    >[]) {
      const direct = await request.get(ENCODED_TRAVERSAL, {
        headers,
        maxRedirects: 0,
      });
      expect(direct.status()).toBe(404);
      expect(direct.headers()["content-type"]).toMatch(/^text\/html/);
      const body = await direct.text();
      expect(body).not.toContain('"error"');
      expect(body).not.toContain("UNAUTHORIZED");
      expect(direct.headers()["cache-control"]).not.toBe(
        "private, no-store, max-age=0",
      );
    }
    // Through the optimizer it is a public-path miss, answered exactly like
    // a missing public image, with or without the session cookie.
    for (const target of [ENCODED_TRAVERSAL, "/images/does-not-exist.webp"]) {
      await expectRefusal(request, target, NOT_AN_IMAGE);
      await expectRefusal(request, target, NOT_AN_IMAGE, cookie);
    }
  });
});
