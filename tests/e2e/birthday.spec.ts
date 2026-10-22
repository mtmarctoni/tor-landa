import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import {
  installJournalFixtures,
  type JournalFixtureOptions,
} from "./journal.fixture";

// Existing client puzzle only; never persist or log the derived value.
const puzzle =
  process.env.JOURNAL_TEST_SECRET ??
  readFileSync("src/components/BirthdaySecretModal.tsx", "utf8").match(
    /const PASSWORD = "([^"]+)"/,
  )?.[1];
const entries = [2026, 2025].map((year) => ({
  week: 43,
  year,
  message: "Berlín y nuestros cuatro números",
}));
async function setup(page: Page, options: JournalFixtureOptions = {}) {
  await installJournalFixtures(page, {
    now: "2026-10-23T12:00:00+02:00",
    qualities: entries,
    storedWeek: { week: 43, year: 2025 },
    ...options,
  });
  await page.goto("/");
}
async function secret(page: Page, hint = "Berlín") {
  await page.getByRole("button", { name: hint, exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "El secreto de Landa",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: "Código secreto", exact: true }),
  ).toBeFocused();
  return dialog;
}
async function unlock(page: Page, hint = "Berlín") {
  test.skip(!puzzle, "Existing local puzzle value unavailable");
  const dialog = await secret(page, hint);
  await dialog
    .getByRole("textbox", { name: "Código secreto", exact: true })
    .fill(puzzle ?? "");
  await dialog.getByRole("button", { name: "Descubrir el secreto" }).click();
  const gallery = page.getByRole("dialog", {
    name: "Para ti, Landa",
    exact: true,
  });
  await expect(gallery).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  return gallery;
}

for (const [now, countdown] of [
  ["2026-09-01", false],
  ["2026-10-18", true],
] as const) {
  test(`countdown window ${now}`, async ({ page }) => {
    await setup(page, {
      now: `${now}T12:00:00+02:00`,
      storedWeek: { week: 43, year: 2026 },
    });
    await expect(page.getByTestId("week-context")).toContainText("2026");
    // Next's hidden hydration diff also contains countdown text. Assert the
    // actual app live status, not diagnostic copies in the dev portal.
    const status = page
      .getByRole("region", { name: "Seguimiento de cualidades por semana" })
      .getByRole("status")
      .filter({ hasText: /d[ií]as para el cumplea[nñ]os de Landa/ });
    await expect(status).toHaveCount(countdown ? 1 : 0);
    if (countdown) {
      await expect(status).toBeVisible();
      await expect(status).toHaveText("5 dias para el cumpleanos de Landa");
    }
  });
}
test("birthday gate and historical birthday preserve existing dates", async ({
  page,
}) => {
  await setup(page, {
    now: "2026-10-22T12:00:00+02:00",
    storedWeek: { week: 43, year: 2026 },
  });
  await expect(page.getByText("Vuelve el 23 de octubre")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Berlín", exact: true }),
  ).toHaveCount(0);
  await page.clock.setFixedTime(new Date("2026-10-23T12:00:00+02:00"));
  await page.reload();
  await expect(page.getByTestId("quality-message")).toHaveText(
    "Berlín y nuestros cuatro números",
  );
  await expect(
    page.getByRole("heading", { name: "¡Feliz Cumpleaños, Landa!" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Berlín", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "nuestros cuatro números", exact: true }),
  ).toHaveCount(0);
  await page.getByText("Detalles de la semana", { exact: true }).click();
  await page
    .getByRole("button", { name: "Semana 43 del 2025", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Berlín", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "nuestros cuatro números", exact: true }),
  ).toBeVisible();
});
test("incorrect then correct unlock transfers focus and repeated reopening returns to original hint", async ({
  page,
}) => {
  await setup(page);
  const dialog = await secret(page, "nuestros cuatro números");
  await dialog.getByRole("textbox").fill("incorrecto");
  await dialog.getByRole("button", { name: "Descubrir el secreto" }).click();
  await expect(dialog.getByRole("alert")).toContainText("no es esa");
  await expect(
    page.getByRole("dialog", { name: "Para ti, Landa" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "nuestros cuatro números", exact: true }),
  ).toBeFocused();
  for (let i = 0; i < 2; i++) {
    const gallery = await unlock(page, "nuestros cuatro números");
    await expect(
      gallery.getByRole("button", { name: "Cerrar", exact: true }),
    ).toBeFocused();
    await gallery.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "nuestros cuatro números",
        exact: true,
      }),
    ).toBeFocused();
  }
});
test("handoff ignores hint re-entry and restores original focus and scroll", async ({
  page,
}) => {
  test.skip(!puzzle, "Existing local puzzle value unavailable");
  await page.setViewportSize({
    width: test.info().project.name === "phone" ? 390 : 1440,
    height: 650,
  });
  await setup(page);
  const opener = page.getByRole("button", {
    name: "nuestros cuatro números",
    exact: true,
  });
  await opener.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "visible";
    window.scrollTo(0, 100);
    document.documentElement.dataset.birthdayMaxDialogs = "0";
    new MutationObserver(() => {
      document.documentElement.dataset.birthdayMaxDialogs = String(
        Math.max(
          Number(document.documentElement.dataset.birthdayMaxDialogs),
          document.querySelectorAll("dialog[open]").length,
        ),
      );
    }).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
  });
  const scroll = await page.evaluate(() => scrollY);
  expect(scroll).toBeGreaterThan(0);
  // Keep the deliberately chosen scroll position: Playwright's pointer click
  // can scroll before opening, which changes the position the dialog must save.
  await opener.evaluate((el: HTMLButtonElement) => {
    el.focus({ preventScroll: true });
    el.click();
  });
  const dialog = page.getByRole("dialog", {
    name: "El secreto de Landa",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: "Código secreto", exact: true }),
  ).toBeFocused();
  await dialog.getByRole("textbox").fill(puzzle ?? "");
  const now = new Date("2026-10-23T12:00:00+02:00");
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));
  await dialog
    .getByRole("button", { name: "Descubrir el secreto" })
    .evaluate((el: HTMLButtonElement) => el.click());
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(opener).toBeFocused();
  // Reactivate the actual original button while the 280ms transition is pending.
  await opener.evaluate((el: HTMLButtonElement) => el.click());
  await page.clock.runFor(280);
  const gallery = page.getByRole("dialog", {
    name: "Para ti, Landa",
    exact: true,
  });
  await expect(gallery).toBeVisible();
  expect(
    await page.evaluate(() =>
      Number(document.documentElement.dataset.birthdayMaxDialogs),
    ),
  ).toBeLessThanOrEqual(1);
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await gallery
    .getByRole("button", { name: "Cerrar", exact: true })
    .evaluate((el: HTMLButtonElement) => el.click());
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(
    await page.evaluate(() => [
      document.documentElement.style.overflow,
      document.body.style.overflow,
      scrollY,
    ]),
  ).toEqual(["auto", "visible", scroll]);
  await page.clock.resume();
  const reopened = await unlock(page, "nuestros cuatro números");
  await reopened.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(opener).toBeFocused();
});

for (const entry of [
  "keyboard AMOR",
  "footer AMOR",
  "footer surprise",
] as const) {
  for (const dismissEarly of [false, true]) {
    test(`pending handoff yields to ${entry}, dismissed ${dismissEarly ? "before" : "after"} deadline`, async ({
      page,
    }) => {
      test.skip(!puzzle, "Existing local puzzle value unavailable");
      await page.setViewportSize({
        width: test.info().project.name === "phone" ? 390 : 1440,
        height: 650,
      });
      await setup(page);
      const dialog = await secret(page);
      await dialog.getByRole("textbox").fill(puzzle ?? "");
      const now = new Date("2026-10-23T12:00:00+02:00");
      await page.clock.install({ time: now });
      await page.clock.pauseAt(new Date(now.getTime() + 1000));
      await dialog
        .getByRole("button", { name: "Descubrir el secreto" })
        .evaluate((el: HTMLButtonElement) => el.click());
      await expect(page.locator("dialog[open]")).toHaveCount(0);
      const opener = page.getByRole("button", {
        name:
          entry === "keyboard AMOR"
            ? "Berlín"
            : entry === "footer AMOR"
              ? "Abrir un momento especial"
              : "Abrir sorpresa",
        exact: true,
      });
      await opener.scrollIntoViewIfNeeded();
      await opener.focus();
      if (entry === "keyboard AMOR") {
        await page.evaluate(() => window.scrollTo(0, 100));
      }
      await page.evaluate(() => {
        document.documentElement.style.overflow = "auto";
        document.body.style.overflow = "visible";
        document.documentElement.dataset.handoffMaxDialogs = "0";
        new MutationObserver(() => {
          document.documentElement.dataset.handoffMaxDialogs = String(
            Math.max(
              Number(document.documentElement.dataset.handoffMaxDialogs),
              document.querySelectorAll("dialog[open]").length,
            ),
          );
        }).observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["open"],
        });
      });
      const scroll = await page.evaluate(() => scrollY);
      expect(scroll).toBeGreaterThan(0);
      if (entry === "keyboard AMOR") await page.keyboard.type("amor");
      else if (test.info().project.name === "phone")
        await opener.tap({ force: true });
      else await opener.click({ force: true });
      const surprise = page.getByRole("dialog", {
        name:
          entry === "footer surprise"
            ? "Sorpresa surrealista"
            : "Momento especial",
        exact: true,
      });
      await expect(surprise).toBeVisible();
      if (dismissEarly) {
        await page.keyboard.press("Escape");
        await expect(page.locator("dialog[open]")).toHaveCount(0);
      }
      await page.clock.runFor(280);
      // A newer user request cancels, rather than postpones, the old gallery.
      await expect(page.locator("dialog[open]")).toHaveCount(
        dismissEarly ? 0 : 1,
      );
      await expect(
        page.getByRole("dialog", { name: "Para ti, Landa", exact: true }),
      ).toHaveCount(0);
      if (!dismissEarly) {
        await expect(surprise).toBeVisible();
        await page.keyboard.press("Escape");
      }
      await expect(page.locator("dialog[open]")).toHaveCount(0);
      await expect(opener).toBeFocused();
      expect(
        await page.evaluate(() =>
          Number(document.documentElement.dataset.handoffMaxDialogs),
        ),
      ).toBeLessThanOrEqual(1);
      expect(
        await page.evaluate(() => [
          document.documentElement.style.overflow,
          document.body.style.overflow,
          scrollY,
        ]),
      ).toEqual(["auto", "visible", scroll]);
      await page.clock.runFor(1000);
      await expect(page.locator("dialog[open]")).toHaveCount(0);
      await page.clock.resume();
      const gallery = await unlock(page);
      await gallery
        .getByRole("button", { name: "Cerrar", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Berlín", exact: true }),
      ).toBeFocused();
    });
  }
}

test("pending handoff is harmless after navigation unmount and fresh return", async ({
  page,
}) => {
  test.skip(!puzzle, "Existing local puzzle value unavailable");
  await setup(page);
  const dialog = await secret(page);
  await dialog.getByRole("textbox").fill(puzzle ?? "");
  const now = new Date("2026-10-23T12:00:00+02:00");
  await page.clock.install({ time: now });
  await page.clock.pauseAt(new Date(now.getTime() + 1000));
  await dialog
    .getByRole("button", { name: "Descubrir el secreto" })
    .evaluate((el: HTMLButtonElement) => el.click());
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await page
    .getByRole("link", { name: "Historia completa", exact: true })
    .evaluate((el: HTMLAnchorElement) => el.click());
  await expect(page).toHaveURL(/\/history$/);
  await page.clock.runFor(500);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(
    await page.evaluate(() => [
      document.documentElement.style.overflow,
      document.body.style.overflow,
    ]),
  ).toEqual(["", ""]);
  await page.clock.resume();
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Berlín", exact: true }),
  ).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  const gallery = await unlock(page);
  await gallery.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Berlín", exact: true }),
  ).toBeFocused();
});

test("three attempts close and stale close timer cannot close a reopened secret", async ({
  page,
}) => {
  await setup(page);
  let dialog = await secret(page);
  for (let i = 0; i < 3; i++) {
    await dialog.getByRole("textbox").fill("incorrecto");
    await dialog.getByRole("button", { name: "Descubrir el secreto" }).click();
  }
  await expect(
    dialog.getByRole("button", { name: "Intentos agotados" }),
  ).toBeDisabled();
  await expect(dialog).not.toBeVisible({ timeout: 5000 });
  dialog = await secret(page);
  await expect(dialog.getByRole("textbox")).toBeEnabled();
  for (let i = 0; i < 3; i++) {
    await dialog.getByRole("textbox").fill("incorrecto");
    await dialog.getByRole("button", { name: "Descubrir el secreto" }).click();
  }
  await page.keyboard.press("Escape");
  dialog = await secret(page);
  await page.waitForTimeout(3200);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox")).toBeFocused();
});
test("ordinary dismissal preserves the existing partial attempt budget", async ({
  page,
}) => {
  await setup(page);
  let dialog = await secret(page);
  for (let i = 0; i < 2; i++) {
    await dialog.getByRole("textbox").fill("incorrecto");
    await dialog.getByRole("button", { name: "Descubrir el secreto" }).click();
  }
  await page.keyboard.press("Escape");
  dialog = await secret(page);
  await dialog.getByRole("textbox").fill("incorrecto");
  await dialog.getByRole("button", { name: "Descubrir el secreto" }).click();
  await expect(
    dialog.getByRole("button", { name: "Intentos agotados" }),
  ).toBeDisabled();
});

test("gallery captions and arrows wrap both ways", async ({ page }) => {
  await setup(page);
  const gallery = await unlock(page);
  await expect(
    gallery.getByText("Recuerdo de prueba A", { exact: true }),
  ).toBeVisible();
  for (const [name, caption] of [
    ["Foto siguiente", "B"],
    ["Foto siguiente", "A"],
    ["Foto anterior", "B"],
    ["Foto anterior", "A"],
  ]) {
    await gallery.getByRole("button", { name }).click();
    await expect(
      gallery.getByText(`Recuerdo de prueba ${caption}`, { exact: true }),
    ).toBeVisible();
  }
});
for (const error of [false, true]) {
  test(`fallback discloses three examples ${error ? "on error" : "when empty"}`, async ({
    page,
  }) => {
    await setup(page, { photos: [], photoStatus: error ? 500 : 200 });
    const gallery = await unlock(page);
    await expect(
      gallery.getByText("Mostrando imágenes de ejemplo", { exact: true }),
    ).toBeVisible();
    if (error)
      await expect(
        gallery
          .getByRole("status")
          .filter({ hasText: "No se pudieron cargar" }),
      ).toBeVisible();
    await expect(gallery.getByText("1 / 3", { exact: true })).toBeVisible();
    await expect(gallery.getByText("1 / 0", { exact: true })).toHaveCount(0);
    await gallery.getByRole("button", { name: "Foto anterior" }).click();
    await expect(gallery.getByText("3 / 3", { exact: true })).toBeVisible();
    await gallery.getByRole("button", { name: "Foto siguiente" }).click();
    await expect(gallery.getByText("1 / 3", { exact: true })).toBeVisible();
  });
}
test("pending dataset has no navigation and close works; late response does not contaminate reopen", async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/birthday-photos", async (route) => {
    await held;
    await route.fulfill({ json: { photos: [] } });
  });
  const gallery = await unlock(page);
  await expect(
    gallery.getByText("Cargando recuerdos...", { exact: true }),
  ).toBeVisible();
  await expect(
    gallery.getByRole("button", { name: /Foto (anterior|siguiente)/ }),
  ).toHaveCount(0);
  await gallery.getByRole("button", { name: "Cerrar", exact: true }).click();
  release();
  await page.unroute("**/api/birthday-photos");
  const reopened = await unlock(page);
  await expect(
    reopened.getByText("Recuerdo de prueba A", { exact: true }),
  ).toBeVisible();
});
test("slow images keep loading feedback and close reachable", async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/__fixtures/*.svg", async (route) => {
    await held;
    await route.fulfill({
      path: "tests/e2e/fixtures/photo-a.svg",
      contentType: "image/svg+xml",
    });
  });
  const gallery = await unlock(page);
  await expect(
    gallery.getByText("Cargando foto...", { exact: true }),
  ).toBeVisible();
  await gallery.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Berlín", exact: true }),
  ).toBeFocused();
  release();
});
test("optimized image stays in loading state until displayed image arrives", async ({
  page,
}) => {
  await setup(page, {
    photos: [{ url: "/__fixtures/photo-a.png", caption: "Recuerdo sintético" }],
  });
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/__fixtures/photo-a.png") {
      await route.fulfill({
        path: "tests/e2e/fixtures/photo-a.svg",
        contentType: "image/svg+xml",
      });
    } else if (
      url.pathname === "/_next/image" &&
      url.searchParams.get("url") === "/__fixtures/photo-a.png"
    ) {
      await held;
      await route.fulfill({
        path: "tests/e2e/fixtures/photo-a.svg",
        contentType: "image/svg+xml",
      });
    } else await route.fallback();
  });
  const gallery = await unlock(page);
  await expect(
    gallery.getByRole("img", { name: "Recuerdo 1", exact: true }),
  ).toHaveAttribute("data-preloaded", "true");
  await expect(
    gallery.getByText("Cargando foto...", { exact: true }),
  ).toBeVisible();
  release();
  await expect(
    gallery.getByText("Cargando foto...", { exact: true }),
  ).toHaveCount(0);
  await expect(
    gallery.getByRole("img", { name: "Recuerdo 1", exact: true }),
  ).toHaveCSS("opacity", "1");
});

test("failed individual image leaves caption, navigation and close usable", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/__fixtures/photo-a.svg", (route) => route.abort());
  const gallery = await unlock(page);
  await expect(
    gallery
      .getByRole("status")
      .filter({ hasText: "Esta foto no se pudo cargar" }),
  ).toBeVisible();
  await expect(
    gallery.getByText("Recuerdo de prueba A", { exact: true }),
  ).toBeVisible();
  await gallery.getByRole("button", { name: "Foto siguiente" }).click();
  await expect(
    gallery.getByText("Recuerdo de prueba B", { exact: true }),
  ).toBeVisible();
  await gallery.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Berlín", exact: true }),
  ).toBeFocused();
});

test("long captions scroll rather than clipping controls in short landscape", async ({
  page,
}) => {
  const caption = "Un recuerdo que no cabe en un marco. ".repeat(45);
  await page.setViewportSize({ width: 844, height: 390 });
  await setup(page, {
    photos: [
      { url: "/__fixtures/photo-a.svg", caption },
      { url: "/__fixtures/photo-b.svg", caption: "Otro recuerdo" },
    ],
  });
  const gallery = await unlock(page);
  const content = gallery.locator(".journal-dialog-content");
  expect(await content.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  expect(
    await content.evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBe(true);
  await content.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(
    gallery.getByText("Te quiero.", { exact: true }),
  ).toBeInViewport();
  await expect(
    gallery.getByRole("button", { name: "Cerrar", exact: true }),
  ).toBeInViewport();
  await gallery.getByRole("button", { name: "Foto siguiente" }).focus();
  await expect(
    gallery.getByRole("button", { name: "Foto siguiente" }),
  ).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(
    gallery.getByText("Otro recuerdo", { exact: true }),
  ).toBeVisible();
});

test("birthday worlds fit portrait and landscape with reduced motion and every palette", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  for (const time of ["day", "dawn", "dusk", "night"]) {
    await page.goto(`/?time=${time}`);
    await expect(page.locator("html")).toHaveAttribute("data-time", time);
    const dialog = await secret(page);
    expect(
      await dialog.evaluate((el) => getComputedStyle(el).backgroundColor),
    ).not.toBe("rgba(0, 0, 0, 0)");
    await expect(dialog.getByRole("textbox")).toBeInViewport();
    if (time === "day")
      await page.screenshot({
        path: `playwright-report/evidence/birthday-secret-${info.project.name}.png`,
      });
    await page.keyboard.press("Escape");
    const gallery = await unlock(page);
    await expect(
      gallery.getByRole("img", { name: "Recuerdo 1", exact: true }),
    ).toBeVisible();
    await expect(
      gallery.getByRole("img", { name: "Recuerdo 1", exact: true }),
    ).toHaveJSProperty("complete", true);
    await expect
      .poll(() =>
        gallery.evaluate((el) =>
          el
            .getAnimations({ subtree: true })
            .filter((a) => a.playState === "running")
            .map((a) => ({
              target: ((a.effect as KeyframeEffect)?.target as HTMLElement)
                ?.className,
              frames: (a.effect as KeyframeEffect)?.getKeyframes(),
            })),
        ),
      )
      .toEqual([]);
    await expect(
      gallery.getByRole("button", { name: "Foto siguiente" }),
    ).toBeInViewport();
    if (time === "day")
      await page.screenshot({
        path: `playwright-report/evidence/birthday-gallery-${info.project.name}.png`,
      });
    else
      await page.screenshot({
        path: `playwright-report/evidence/birthday-gallery-${info.project.name}-${time}.png`,
      });
    await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: 844, height: 390 });
  const gallery = await unlock(page);
  await expect(
    gallery.getByRole("button", { name: "Cerrar", exact: true }),
  ).toBeInViewport();
  await expect(
    gallery.getByRole("button", { name: "Foto siguiente" }),
  ).toBeInViewport();
  await expect(
    gallery.getByText("Recuerdo de prueba A", { exact: true }),
  ).toBeInViewport();
  expect(await gallery.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `playwright-report/evidence/birthday-gallery-landscape-${info.project.name}.png`,
  });
});
