import { expect, test } from "@playwright/test";
import {
  expectPrivateHeaders,
  LOGIN_PATH,
  loginThroughUi,
  PRIVATE_MARKER,
  PRODUCTION_SERVER,
} from "./shoebox.fixture";

const WEEK = 604_800;

test("login distinguishes incomplete setup from a temporary outage", async ({
  page,
}) => {
  let code = "SETUP_REQUIRED";
  await page.route("**/api/shoebox/session", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 503,
      json: { error: { code, message: "sanitized" } },
    });
  });
  await page.goto(LOGIN_PATH);
  await page.getByLabel("Contraseña").fill("synthetic password");
  await page.getByRole("button", { name: "Abrir la caja" }).click();
  await expect(page.getByRole("status")).toContainText(
    "La caja todavía no está configurada",
  );
  await expect(page.getByLabel("Contraseña")).toHaveValue("");
  code = "UNAVAILABLE";
  await page.getByLabel("Contraseña").fill("synthetic password");
  await page.getByRole("button", { name: "Abrir la caja" }).click();
  await expect(page.getByRole("status")).toContainText(
    "no está disponible ahora mismo",
  );
});

test.describe("unauthenticated access", () => {
  test("the page redirects only to the fixed login path, privately", async ({
    request,
  }) => {
    for (const path of [
      "/shoebox",
      "/shoebox?next=https://evil.test",
      "/shoebox?redirect=%2F%2Fevil.test",
    ]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
      expect(response.headers().location, path).toBe(LOGIN_PATH);
      expectPrivateHeaders(response.headers(), { page: true });
      expect(await response.text()).not.toContain(PRIVATE_MARKER);
    }
  });

  test("an RSC/prefetch request carries no private content", async ({
    request,
  }) => {
    const response = await request.get("/shoebox?_rsc=probe", {
      headers: { RSC: "1", "Next-Router-Prefetch": "1" },
      maxRedirects: 0,
    });
    expectPrivateHeaders(response.headers());
    expect(await response.text()).not.toContain(PRIVATE_MARKER);
  });

  test("the session API answers 401 JSON instead of redirecting", async ({
    request,
  }) => {
    const response = await request.get("/api/shoebox/session", {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(401);
    expect(response.headers().location).toBeUndefined();
    expectPrivateHeaders(response.headers());
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
  });

  test("HEAD follows the GET auth path and returns no body", async ({
    request,
  }) => {
    const response = await request.head("/api/shoebox/session");
    expect(response.status()).toBe(401);
    expectPrivateHeaders(response.headers());
    expect((await response.body()).byteLength).toBe(0);
  });

  test("unexpected methods get a private 405 without CORS permissions", async ({
    request,
  }) => {
    const cases = [
      ["OPTIONS", "/api/shoebox/session", "GET, HEAD, POST"],
      ["PUT", "/api/shoebox/session", "GET, HEAD, POST"],
      ["DELETE", "/api/shoebox/session", "GET, HEAD, POST"],
      ["GET", "/api/shoebox/logout", "POST"],
      ["OPTIONS", "/api/shoebox/logout", "POST"],
    ] as const;
    for (const [method, path, allow] of cases) {
      const response = await request.fetch(path, {
        method,
        headers: { Origin: "https://evil.test" },
      });
      expect(response.status(), `${method} ${path}`).toBe(405);
      expect(response.headers().allow).toBe(allow);
      expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
      expectPrivateHeaders(response.headers());
    }
  });

  test("login and logout refuse missing or foreign origins", async ({
    request,
  }) => {
    for (const path of ["/api/shoebox/session", "/api/shoebox/logout"]) {
      for (const headers of [{}, { Origin: "https://evil.test" }] as Record<
        string,
        string
      >[]) {
        const response = await request.post(path, {
          headers,
          data: path.endsWith("session") ? { password: "x" } : undefined,
        });
        expect(response.status(), path).toBe(403);
        expect(response.headers()["set-cookie"]).toBeUndefined();
        expectPrivateHeaders(response.headers());
      }
    }
  });

  test("the image optimizer allows public artwork only", async ({
    request,
  }) => {
    const optimize = (url: string) =>
      request.get(`/_next/image?url=${encodeURIComponent(url)}&w=64&q=75`);
    expect((await optimize("/images/dali1.webp")).status()).toBe(200);
    for (const url of [
      "/api/shoebox/session",
      "/api/shoebox/memories/x/media",
      "/shoebox",
      "/images/dali1.webp?v=1",
    ]) {
      expect((await optimize(url)).status(), url).toBe(400);
    }
  });

  test("the login page is generic, private and noindex", async ({ page }) => {
    const response = await page.goto(LOGIN_PATH);
    expectPrivateHeaders(response?.headers() ?? {}, { page: true });
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow, noarchive",
    );
    await expect(
      page.getByRole("heading", { name: /Nuestra caja\s*imposible/ }),
    ).toBeVisible();
    await expect(page.getByText(PRIVATE_MARKER)).toHaveCount(0);
  });
});

test.describe("login and logout", () => {
  test("a wrong password keeps the box closed", async ({ page, context }) => {
    await loginThroughUi(page, "una contraseña incorrecta");
    await expect(page.getByRole("status")).toContainText(
      "Esa no es la contraseña",
    );
    await expect(page).toHaveURL(LOGIN_PATH);
    await expect(page.getByLabel("Contraseña")).toHaveValue("");
    await expect(page.getByLabel("Contraseña")).toBeFocused();
    expect(await context.cookies()).toEqual([]);
  });

  test("the right password opens the guarded page with a strict session cookie", async ({
    page,
    context,
  }) => {
    const before = Math.floor(Date.now() / 1000);
    await loginThroughUi(page);
    await expect(page).toHaveURL("/shoebox");
    await expect(page.getByText(PRIVATE_MARKER)).toBeVisible();

    const cookies = await context.cookies();
    expect(cookies).toHaveLength(1);
    const [cookie] = cookies;
    expect(cookie).toMatchObject({
      // `next dev` on loopback uses the local cookie; `next start` never does.
      name: PRODUCTION_SERVER ? "__Host-shoebox" : "shoebox-dev",
      path: "/",
      httpOnly: true,
      secure: PRODUCTION_SERVER,
      sameSite: "Strict",
    });
    expect(cookie?.domain).toBe("127.0.0.1");
    expect(cookie?.expires).toBeGreaterThanOrEqual(before + WEEK - 5);
    expect(cookie?.expires).toBeLessThanOrEqual(before + WEEK + 5);

    const page200 = await page.request.get("/shoebox");
    expect(page200.status()).toBe(200);
    expectPrivateHeaders(page200.headers(), { page: true });
    expect(await page200.text()).not.toContain(cookie?.value ?? "-");

    const session = await page.request.get("/api/shoebox/session");
    expect(session.status()).toBe(200);
    expectPrivateHeaders(session.headers());
    const { expiresAt } = await session.json();
    expect(expiresAt).toBeGreaterThanOrEqual(before + WEEK);
    expect(await session.text()).not.toContain(cookie?.value ?? "-");
  });

  test("logout clears the cookie and the page is guarded again", async ({
    page,
    context,
  }) => {
    await loginThroughUi(page);
    await expect(page.getByText(PRIVATE_MARKER)).toBeVisible();

    await page.getByRole("button", { name: "Cerrar la caja" }).click();
    await expect(page).toHaveURL(LOGIN_PATH);
    expect(await context.cookies()).toEqual([]);

    const session = await page.request.get("/api/shoebox/session");
    expect(session.status()).toBe(401);

    await page.goto("/shoebox");
    await expect(page).toHaveURL(LOGIN_PATH);
    await page.goBack();
    await expect(page.getByText(PRIVATE_MARKER)).toHaveCount(0);
  });
});
