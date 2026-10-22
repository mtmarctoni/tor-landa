import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";
import {
  SYNTHETIC_PASSWORD,
  SYNTHETIC_SESSION_SECRET,
} from "../helpers/shoebox-auth";
import { expectPrivateHeaders, PRODUCTION_SERVER } from "./shoebox.fixture";

const ID = "0f0f0f0f-0000-4000-8000-000000000001";
const ROOT = "/api/shoebox";
const paths = [
  "memories",
  `memories/${ID}`,
  `requests/${ID}`,
  `memories/${ID}/media`,
];
const canaries = [
  "test-notion-key",
  SYNTHETIC_SESSION_SECRET,
  "synthetic-private-note",
  "https://file.notion.so/",
];

test("real HTTP rejects absent, forged and correctly signed expired sessions on every read/write surface", async ({
  request,
  baseURL,
}) => {
  const expired = await new SignJWT({ v: 1 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("tor-landa:shoebox")
    .setAudience("shoebox")
    .setJti(ID)
    .setIssuedAt(1_700_000_000)
    .setExpirationTime(1_700_604_800)
    .sign(Buffer.from(SYNTHETIC_SESSION_SECRET, "base64url"));
  const cookieName = PRODUCTION_SERVER ? "__Host-shoebox" : "shoebox-dev";
  for (const token of [undefined, "forged", expired]) {
    for (const path of paths) {
      const methods =
        path === "memories"
          ? ["GET", "HEAD", "POST"]
          : path === `memories/${ID}`
            ? ["GET", "HEAD", "PATCH", "DELETE"]
            : ["GET", "HEAD"];
      for (const method of methods) {
        const response = await request.fetch(`${ROOT}/${path}`, {
          method,
          headers: {
            Origin: new URL(baseURL ?? "http://127.0.0.1:3100").origin,
            "Sec-Fetch-Site": "same-origin",
            ...(token ? { Cookie: `${cookieName}=${token}` } : {}),
          },
        });
        expect(response.status(), `${method} ${path}`).toBe(401);
        expectPrivateHeaders(response.headers());
        for (const value of canaries)
          expect(await response.text()).not.toContain(value);
      }
    }
    const page = await request.get("/shoebox", {
      headers: token ? { Cookie: `${cookieName}=${token}` } : {},
      maxRedirects: 0,
    });
    expect(page.status()).toBe(307);
    expect(page.headers().location).toBe("/shoebox/login");
    expectPrivateHeaders(page.headers(), { page: true });
  }
});

test("authenticated cross-site reads/mutations fail before upstream and all method/error roots are private", async ({
  request,
  baseURL,
}) => {
  const login = await request.post(`${ROOT}/session`, {
    headers: { Origin: new URL(baseURL ?? "http://127.0.0.1:3100").origin },
    data: { password: SYNTHETIC_PASSWORD },
  });
  expect(login.status()).toBe(200);
  const Cookie = login.headers()["set-cookie"].split(";")[0];
  for (const path of paths) {
    for (const method of [
      "GET",
      "HEAD",
      ...(path === "memories"
        ? ["POST"]
        : path === `memories/${ID}`
          ? ["PATCH", "DELETE"]
          : []),
    ]) {
      const response = await request.fetch(`${ROOT}/${path}`, {
        method,
        headers: {
          Cookie,
          Origin: "https://foreign.invalid",
          "Sec-Fetch-Site": "cross-site",
        },
      });
      expect(response.status(), `${method} ${path}`).toBe(403);
      expectPrivateHeaders(response.headers());
    }
  }
  for (const path of [
    ROOT,
    `${ROOT}/missing`,
    ...paths.map((path) => `${ROOT}/${path}`),
  ]) {
    const response = await request.fetch(path, { method: "OPTIONS" });
    expect(response.status()).toBe(
      path === ROOT || path.endsWith("/missing") ? 404 : 405,
    );
    if (response.status() === 404) {
      // Next's HTML not-found handler adds stricter cache directives.
      expect(response.headers()["cache-control"]).toBe(
        PRODUCTION_SERVER
          ? "private, no-cache, no-store, max-age=0, must-revalidate"
          : "no-cache, must-revalidate",
      );
      expectPrivateHeaders({
        ...response.headers(),
        "cache-control": "private, no-store, max-age=0",
      });
    } else expectPrivateHeaders(response.headers());
    expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
  }
});

test("login aliases cannot verify passwords or issue cookies", async ({
  request,
  baseURL,
}) => {
  for (const path of [
    `${ROOT}/session/`,
    "/api/Shoebox/session",
    `${ROOT}/Session`,
    `${ROOT}/%73ession`,
    `${ROOT}//session`,
  ]) {
    const response = await request.post(path, {
      headers: { Origin: new URL(baseURL ?? "http://127.0.0.1:3100").origin },
      data: { password: SYNTHETIC_PASSWORD },
      maxRedirects: 0,
    });
    expect([404, 308], path).toContain(response.status());
    expect(response.headers()["set-cookie"]).toBeUndefined();
    if (response.status() === 308)
      expect(response.headers().location).toBe(`${ROOT}/session`);
  }
});

test("production upload executes actual worker and returns safe offline upstream error for a valid JPEG", async ({
  request,
  baseURL,
}) => {
  const login = await request.post(`${ROOT}/session`, {
    headers: { Origin: new URL(baseURL ?? "http://127.0.0.1:3100").origin },
    data: { password: SYNTHETIC_PASSWORD },
  });
  expect(login.status()).toBe(200);
  const Cookie = login.headers()["set-cookie"].split(";")[0];
  const { readFileSync } = await import("node:fs");
  const response = await request.post(`${ROOT}/memories`, {
    headers: {
      Origin: new URL(baseURL ?? "http://127.0.0.1:3100").origin,
      Cookie,
    },
    multipart: {
      metadata: JSON.stringify({
        requestId: ID,
        kind: "photo",
        caption: "",
        memoryDate: "2026-10-21",
      }),
      file: {
        name: "synthetic.jpg",
        mimeType: "image/jpeg",
        buffer: readFileSync(
          "tests/fixtures/shoebox/photo-exif-orientation-gps.jpg",
        ),
      },
    },
  });
  expect(response.status()).toBe(503);
  expectPrivateHeaders(response.headers());
  const body = await response.text();
  for (const value of canaries) expect(body).not.toContain(value);
  expect(JSON.parse(body).error.code).toBe("UNAVAILABLE");
  // These must fail in the actual production worker before any SDK request;
  // a broken worker that merely returned503 cannot satisfy these assertions.
  for (const [fixture, status, code] of [
    ["hidden-audio-video.webm", 415, "UNSUPPORTED_MEDIA"],
    ["audio-webm-opus-61s-no-duration.webm", 422, "INVALID_INPUT"],
  ] as const) {
    const rejected = await request.post(`${ROOT}/memories`, {
      headers: {
        Origin: new URL(baseURL ?? "http://127.0.0.1:3100").origin,
        Cookie,
      },
      multipart: {
        metadata: JSON.stringify({
          requestId: ID,
          kind: "audio",
          caption: "",
          memoryDate: "2026-10-21",
        }),
        file: {
          name: "synthetic.webm",
          mimeType: "audio/webm",
          buffer: readFileSync(`tests/fixtures/shoebox/${fixture}`),
        },
      },
    });
    expect(rejected.status()).toBe(status);
    expectPrivateHeaders(rejected.headers());
    expect((await rejected.json()).error.code).toBe(code);
  }
});

test("existing remote optimizer hosts cannot yield private bytes from a known synthetic target", async ({
  request,
  baseURL,
}) => {
  const login = await request.post(`${ROOT}/session`, {
    headers: { Origin: new URL(baseURL ?? "http://127.0.0.1:3100").origin },
    data: { password: SYNTHETIC_PASSWORD },
  });
  expect(login.status()).toBe(200);
  const Cookie = login.headers()["set-cookie"].split(";")[0];
  const target =
    "https://prod-files-secure.s3.us-west-2.amazonaws.com/synthetic-shoebox-canary.jpg";
  for (const headers of [{}, { Cookie }, {}] as Record<string, string>[]) {
    const response = await request.get(
      `/_next/image?url=${encodeURIComponent(target)}&w=64&q=75`,
      { headers },
    );
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.headers()["content-type"] ?? "").not.toMatch(
      /^(image|audio)\//,
    );
    const body = await response.text();
    for (const value of canaries) expect(body).not.toContain(value);
    expect(response.headers().location).toBeUndefined();
  }
});
