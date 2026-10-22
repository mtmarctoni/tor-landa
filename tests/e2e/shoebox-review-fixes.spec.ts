import { expect, type Page, type Route, test } from "@playwright/test";
import { SYNTHETIC_PASSWORD } from "../helpers/shoebox-auth";
import { parseCreate } from "./shoebox.fixture";
import {
  openArchive,
  scraps,
  syntheticMemory,
} from "./shoebox-archive.fixture";

const composer = (page: Page) =>
  page.getByRole("dialog", { name: "Algo nuevo para la caja" });
async function draft(page: Page) {
  await page.getByRole("button", { name: "Meter algo en la caja" }).click();
  await page.getByRole("radio", { name: "Texto", exact: true }).check();
  await page.locator("#composer-text").fill("borrador privado sintético");
}
async function visibility(page: Page, value: string) {
  await page.evaluate((state) => {
    Object.defineProperty(document, "visibilityState", {
      value: state,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, value);
}

test("actual day and night dialogs and close controls are opaque; thin photo target is 44px", async ({
  page,
}) => {
  await openArchive(page, [
    syntheticMemory(1, "photo", { width: 2000, height: 20 }),
  ]);
  // Serve a genuinely extreme wide/short image (later routes win), then reload
  // so the browser decodes it and sizes the button from its real ratio.
  await page.route(/\/api\/shoebox\/memories\/[0-9a-f-]{36}\/media$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 20" width="2000" height="20"><rect width="2000" height="20" fill="#4a8f88"/></svg>',
    }),
  );
  await page.reload();
  const photo = page.locator(".scrap-photo");
  await expect(photo.locator("img")).toBeVisible();
  await expect
    .poll(() =>
      photo
        .locator("img")
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth),
    )
    .toBe(2000);
  const box = await photo.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(box?.width).toBeGreaterThanOrEqual(44);
  for (const night of [false, true]) {
    await page.evaluate(
      (value) =>
        document.documentElement.setAttribute(
          "data-time",
          value ? "night" : "day",
        ),
      night,
    );
    await page.getByRole("button", { name: "Meter algo en la caja" }).click();
    for (const target of [
      composer(page),
      composer(page).getByRole("button", { name: "Cerrar", exact: true }),
    ]) {
      const color = await target.evaluate(
        (node) => getComputedStyle(node).backgroundColor,
      );
      expect(color).not.toBe("rgba(0, 0, 0, 0)");
      expect(color).toMatch(/^rgb\(/);
    }
    await composer(page)
      .getByRole("button", { name: "Cerrar", exact: true })
      .click();
  }
});

for (const kind of ["composer", "correction"] as const) {
  test(`failed check releases ${kind} modal ownership and permits explicit retry without private draft`, async ({
    page,
  }) => {
    await openArchive(page, [syntheticMemory(1)]);
    if (kind === "composer") await draft(page);
    else
      await scraps(page)
        .first()
        .getByRole("button", { name: "Corregir" })
        .click();
    await page.route("**/api/shoebox/session", (route) => route.abort());
    await visibility(page, "hidden");
    await visibility(page, "visible");
    const retry = page.getByRole("button", { name: "Comprobar otra vez" });
    await expect(retry).toBeVisible();
    await retry.focus();
    await expect(retry).toBeFocused();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    if (kind === "composer")
      await expect(page.locator("#composer-text")).not.toBeVisible();
    await page.unroute("**/api/shoebox/session");
    if (kind === "composer") await retry.press("Enter");
    else await retry.click();
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    if (kind === "composer")
      await expect(page.locator("#composer-text")).toHaveValue(
        "borrador privado sintético",
      );
  });
}

for (const expiry of [false, true]) {
  test(`held successful create after ${expiry ? "expiry and reauthentication" : "pagehide"} is recoverable`, async ({
    page,
  }) => {
    await openArchive(page, []);
    let held: Route | undefined;
    await page.route(/\/api\/shoebox\/memories$/, (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      held = route;
    });
    await draft(page);
    await composer(page)
      .getByRole("button", { name: "Guardar en la caja", exact: true })
      .click();
    await expect.poll(() => Boolean(held)).toBe(true);
    if (expiry) {
      await page.route("**/api/shoebox/session", (route) =>
        route.request().method() === "GET"
          ? route.fulfill({
              status: 401,
              json: {
                error: {
                  code: "UNAUTHORIZED",
                  message: "x",
                  diagnosticId: "d",
                },
              },
            })
          : route.fallback(),
      );
      await visibility(page, "hidden");
      await visibility(page, "visible");
      await expect(
        composer(page).getByRole("heading", { name: "La sesión caducó" }),
      ).toBeVisible();
      await page.unroute("**/api/shoebox/session");
      await composer(page).getByLabel("Contraseña").fill(SYNTHETIC_PASSWORD);
      await composer(page).getByRole("button", { name: /abrir/i }).click();
    } else {
      await page.evaluate(() => {
        window.dispatchEvent(new Event("pagehide"));
        window.dispatchEvent(
          new PageTransitionEvent("pageshow", { persisted: true }),
        );
      });
    }
    if (!held) throw new Error("Expected held create");
    await held
      .fulfill({
        status: 201,
        json: { memory: syntheticMemory(9), replayed: false },
      })
      .catch(() => {});
    await expect(
      composer(page).getByRole("button", { name: "Comprobar de nuevo" }),
    ).toBeVisible();
    await expect(
      composer(page).getByText("Guardando en la caja…", { exact: false }),
    ).toHaveCount(0);
    await expect(page.locator("#composer-text")).toHaveValue(
      "borrador privado sintético",
    );
  });
}

test("cancelled possibly-inflight create remains locked across retry 503 and keeps its ID", async ({
  page,
}) => {
  await openArchive(page, []);
  const ids: unknown[] = [];
  await page.route(/\/api\/shoebox\/memories$/, (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.fallback();
    ids.push(
      parseCreate(
        request.postDataBuffer() ?? Buffer.alloc(0),
        request.headers()["content-type"],
      ).metadata.requestId,
    );
    if (ids.length === 1) return;
    return route.fulfill({
      status: 503,
      json: { error: { code: "UNAVAILABLE", message: "x", diagnosticId: "d" } },
    });
  });
  await page.route("**/api/shoebox/requests/*", (route) =>
    route.fulfill({ json: { state: "not_found" } }),
  );
  await draft(page);
  await composer(page)
    .getByRole("button", { name: "Guardar en la caja", exact: true })
    .click();
  await expect.poll(() => ids.length).toBe(1);
  await composer(page).getByRole("button", { name: "Cancelar envío" }).click();
  await composer(page)
    .getByRole("button", { name: "Reintentar", exact: true })
    .click();
  await expect.poll(() => ids.length).toBe(2);
  await expect(
    composer(page).getByRole("button", { name: "Comprobar de nuevo" }),
  ).toBeVisible();
  await expect(page.locator("#composer-text")).toBeDisabled();
  expect(ids[1]).toBe(ids[0]);
});

test("conflict cannot resave same ID; ambiguous offers a read-only recheck", async ({
  page,
}) => {
  await openArchive(page, []);
  let creates = 0;
  let checks = 0;
  await page.route(/\/api\/shoebox\/memories$/, (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    creates += 1;
    return route.fulfill({
      status: 409,
      json: {
        error: { code: "REQUEST_CONFLICT", message: "x", diagnosticId: "d" },
      },
    });
  });
  await page.route("**/api/shoebox/requests/*", (route) => {
    checks += 1;
    return route.fulfill({
      json:
        checks === 1
          ? { state: "found", memory: syntheticMemory(9) }
          : { state: "ambiguous" },
    });
  });
  await draft(page);
  const save = composer(page).getByRole("button", {
    name: "Guardar en la caja",
    exact: true,
  });
  await save.click();
  await expect(
    composer(page).getByRole("button", { name: "Guardar como recuerdo nuevo" }),
  ).toBeVisible();
  await expect(save).toBeDisabled();
  await composer(page)
    .getByRole("button", { name: "Guardar como recuerdo nuevo" })
    .click();
  const recheck = composer(page).getByRole("button", {
    name: "Comprobar de nuevo",
  });
  await expect(recheck).toBeVisible();
  await recheck.click();
  await expect.poll(() => checks).toBe(3);
  expect(creates).toBe(2);
});

for (const remove of [false, true]) {
  test(`old deferred refresh cannot undo confirmed ${remove ? "DELETE" : "PATCH"}`, async ({
    page,
  }) => {
    const original = syntheticMemory(1);
    const api = await openArchive(page, [original]);
    // The initial load must finish first, or the hold would swallow it.
    await expect(scraps(page)).toHaveCount(1);
    api.listReplies.push("hold");
    await page.getByRole("button", { name: "Volver al principio" }).click();
    await expect.poll(() => api.held.length).toBe(1);
    if (remove) {
      await scraps(page)
        .first()
        .getByRole("button", { name: "Retirar de la caja" })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Sí, retirarlo", exact: true })
        .click();
      await expect(scraps(page)).toHaveCount(0);
    } else {
      await scraps(page)
        .first()
        .getByRole("button", { name: "Corregir" })
        .click();
      await page
        .getByRole("dialog")
        .locator("textarea")
        .first()
        .fill("corrección confirmada");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: /Guardar/ })
        .click();
      await expect(scraps(page).first()).toContainText("corrección confirmada");
    }
    await api.held[0]
      .fulfill({ json: { items: [original], nextCursor: null } })
      .catch(() => {});
    await expect(page.getByText("Buscando otra tanda…")).toHaveCount(0);
    if (remove) await expect(scraps(page)).toHaveCount(0);
    else
      await expect(scraps(page).first()).toContainText("corrección confirmada");
  });
}
