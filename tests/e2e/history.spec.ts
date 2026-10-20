import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { installJournalFixtures } from "./journal.fixture";

test("archive search, year and order compose", async ({ page }) => {
  await installJournalFixtures(page);
  await page.goto("/history");
  await page.getByRole("textbox", { name: "Buscar en mensajes" }).fill("Tu");
  await page
    .getByRole("combobox", { name: "Año", exact: true })
    .selectOption("2026");
  await expect(page.getByRole("status")).toContainText("3 de 4 cualidades");
  expect(
    await page
      .getByRole("article")
      .evaluateAll((articles) =>
        articles.map((article) => article.getAttribute("aria-label")),
      ),
  ).toEqual(["Semana 26 del 2026", "Semana 25 del 2026", "Semana 24 del 2026"]);
  await page.getByRole("button", { name: "Reciente", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Antiguo", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .getByRole("article")
      .evaluateAll((articles) =>
        articles.map((article) => article.getAttribute("aria-label")),
      ),
  ).toEqual(["Semana 24 del 2026", "Semana 25 del 2026", "Semana 26 del 2026"]);
  await page.getByRole("textbox", { name: "Buscar en mensajes" }).fill("");
  await expect(page.getByRole("status")).toContainText("3 de 4 cualidades");
  await page
    .getByRole("combobox", { name: "Año", exact: true })
    .selectOption("2025");
  await expect(page.getByRole("status")).toContainText("1 de 4 cualidades");
  await expect(page.getByRole("article")).toHaveAttribute(
    "aria-label",
    "Semana 52 del 2025",
  );
  await page
    .getByRole("button", { name: "Limpiar filtros", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("4 de 4 cualidades");
  await expect(page.getByRole("article")).toHaveCount(4);
  await expect(
    page.getByRole("link", { name: "Volver al presente" }),
  ).toHaveAttribute("href", "/");
});

test("exports contain only filtered entries", async ({ page }) => {
  await installJournalFixtures(page);
  await page.goto("/history");
  await page
    .getByRole("textbox", { name: "Buscar en mensajes" })
    .fill("imaginación");
  const [jsonDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "JSON", exact: true }).click(),
  ]);
  const jsonPath = await jsonDownload.path();
  if (!jsonPath) throw new Error("Missing JSON download");
  expect(JSON.parse(await readFile(jsonPath, "utf8"))).toEqual([
    {
      week: 25,
      year: 2026,
      message: "Tu imaginación abre puertas imposibles.",
    },
  ]);
  const [txtDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "TXT", exact: true }).click(),
  ]);
  const txtPath = await txtDownload.path();
  if (!txtPath) throw new Error("Missing TXT download");
  const text = await readFile(txtPath, "utf8");
  expect(text).toContain("Semana 25, 2026");
  expect(text).toContain("Tu imaginación abre puertas imposibles.");
  for (const excluded of [
    "Tu paciencia transforma los días.",
    "Tu alegría cambia el paisaje.",
    "Un recuerdo de otro año.",
  ])
    expect(text).not.toContain(excluded);
});

test("empty archive has its own state and recovery", async ({ page }) => {
  await installJournalFixtures(page, { qualities: [] });
  await page.goto("/history");
  await expect(
    page.getByRole("heading", { name: "Todavía no hay recuerdos" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Volver a cargar" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.route("**/api/quality", (route) =>
    route.fulfill({
      json: {
        qualities: [{ week: 25, year: 2026, message: "El primer recuerdo." }],
      },
    }),
  );
  await page.getByRole("button", { name: "Volver a cargar" }).click();
  await expect(page.getByRole("article")).toContainText("El primer recuerdo.");
});

test("failed archive can retry without reloading the page", async ({
  page,
}) => {
  await installJournalFixtures(page, { qualityStatus: 500 });
  await page.goto("/history");
  await expect(
    page.getByRole("heading", { name: "No se pudo cargar la historia" }),
  ).toBeVisible();
  await page.route("**/api/quality", (route) =>
    route.fulfill({
      json: {
        qualities: [
          { week: 25, year: 2026, message: "Un recuerdo recuperado." },
        ],
      },
    }),
  );
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(
    page.getByRole("article", { name: "Semana 25 del 2026" }),
  ).toContainText("Un recuerdo recuperado.");
});

test("no search match is distinct and clearing filters recovers", async ({
  page,
}) => {
  await installJournalFixtures(page);
  await page.goto("/history");
  await page
    .getByRole("textbox", { name: "Buscar en mensajes" })
    .fill("inexistente");
  await expect(
    page.getByRole("heading", { name: "Ningún recuerdo coincide" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Limpiar filtros", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(4);
});

test("long memory islands and controls remain readable at 320px", async ({
  page,
}) => {
  const message =
    "Tu imaginación abre puertas imposibles.\n\n" +
    "Una memoria larga. ".repeat(90) +
    "x".repeat(240);
  await page.setViewportSize({ width: 320, height: 844 });
  await installJournalFixtures(page, {
    qualities: [{ week: 25, year: 2026, message }],
  });
  await page.goto("/history");
  const article = page.getByRole("article", { name: "Semana 25 del 2026" });
  await expect(article.locator("p")).toHaveText(message);
  expect(
    await article.locator("p").evaluate((el) => {
      const style = getComputedStyle(el);
      return (
        style.whiteSpace === "pre-wrap" &&
        Number.parseFloat(style.fontSize) >= 16 &&
        el.scrollWidth <= el.clientWidth
      );
    }),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const control of [
    page.getByRole("textbox"),
    page.getByRole("combobox"),
    page.getByRole("button", { name: "Reciente", exact: true }),
    page.getByRole("button", { name: "JSON", exact: true }),
    page.getByRole("button", { name: "TXT", exact: true }),
  ]) {
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    if (bounds) {
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test("archive theme and long-content evidence", async ({ page }, testInfo) => {
  const message =
    "Tu imaginación abre puertas imposibles.\n\n" +
    "Tu paciencia transforma el paisaje incluso cuando las palabras siguen creciendo. ".repeat(
      16,
    );
  await installJournalFixtures(page, {
    qualities: [
      { week: 26, year: 2026, message: "Tu alegría cambia el paisaje." },
      { week: 25, year: 2026, message },
      { week: 24, year: 2026, message: "Tu paciencia transforma los días." },
    ],
  });
  for (const time of ["day", "dawn", "dusk", "night"]) {
    await page.goto(`/history?time=${time}`);
    await expect(page.getByRole("article")).toHaveCount(3);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("article").nth(1).locator("p")).toHaveText(
      message,
    );
    expect(
      await page
        .getByRole("article")
        .nth(1)
        .locator("p")
        .evaluate((el) => {
          const style = getComputedStyle(el);
          return (
            style.whiteSpace === "pre-wrap" &&
            el.scrollWidth <= el.clientWidth &&
            el.scrollHeight <= el.clientHeight
          );
        }),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `playwright-report/evidence/history-${testInfo.project.name}-${time}.png`,
      fullPage: true,
      animations: "disabled",
    });
    if (time === "day")
      await page.screenshot({
        path: `playwright-report/evidence/history-${testInfo.project.name}.png`,
        fullPage: true,
        animations: "disabled",
      });
  }
});

test("reduced-motion archive has stable islands and keyboard tools", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installJournalFixtures(page);
  await page.goto("/history");
  const article = page.getByRole("article").first();
  await expect(article).toBeVisible();
  expect(
    await article.evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  const before = await article.boundingBox();
  await page.waitForTimeout(650);
  expect(await article.boundingBox()).toEqual(before);
  const search = page.getByRole("textbox", { name: "Buscar en mensajes" });
  await search.focus();
  await page.keyboard.type("imaginación");
  await expect(page.getByRole("status")).toContainText("1 de 4 cualidades");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("combobox", { name: "Año", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Reciente", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Antiguo", exact: true }),
  ).toBeFocused();
  expect(
    await page
      .getByRole("button", { name: "Antiguo", exact: true })
      .evaluate((el) => getComputedStyle(el).outlineStyle),
  ).not.toBe("none");
});
