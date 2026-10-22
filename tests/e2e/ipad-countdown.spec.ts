import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import {
  installJournalFixtures,
  type JournalFixtureOptions,
} from "./journal.fixture";

declare global {
  interface Window {
    ipadProbe: {
      timers: Record<string, number>;
      listeners: number;
      setHidden: (hidden: boolean) => void;
    };
  }
}
const reveal = Date.parse("2026-10-22T22:00:00Z");
const inline = Date.parse("2026-10-23T22:00:00Z");
const target = Date.parse("2026-11-26T23:00:00Z");
const birthdayEntries = [2026, 2025].map((year) => ({
  week: 43,
  year,
  message: "Berlín y nuestros cuatro números",
}));

async function setup(
  page: Page,
  now: number,
  options: JournalFixtureOptions = {},
) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install({ time: now - 60_000 });
  await installJournalFixtures(page, {
    now: new Date(now - 60_000).toISOString(),
    qualities: birthdayEntries,
    storedWeek: { week: 43, year: 2026 },
    ...options,
  });
  await page.clock.setSystemTime(now - 60_000);
  await page.addInitScript(() => {
    let hidden = false;
    const timers: Record<string, number> = {};
    const probe = {
      timers,
      listeners: 0,
      setHidden(value: boolean) {
        hidden = value;
        document.dispatchEvent(new Event("visibilitychange"));
      },
    };
    window.ipadProbe = probe;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });
    const schedule = window.setTimeout.bind(window);
    const clear = window.clearTimeout.bind(window);
    window.setTimeout = ((
      handler: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ) => {
      if (
        typeof handler !== "function" ||
        !handler.toString().includes("refreshIpadCountdown")
      )
        return schedule(handler, delay, ...args);
      const id = schedule(() => {
        delete timers[id];
        handler(...args);
      }, delay);
      timers[id] = delay ?? 0;
      return id;
    }) as typeof window.setTimeout;
    window.clearTimeout = (id) => {
      if (id !== undefined) delete timers[String(id)];
      clear(id);
    };
    const add = EventTarget.prototype.addEventListener;
    const remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (
      type,
      callback,
      options,
    ) {
      if (
        typeof callback === "function" &&
        callback.toString().includes("refreshIpadCountdown")
      )
        probe.listeners++;
      add.call(this, type, callback, options);
    };
    EventTarget.prototype.removeEventListener = function (
      type,
      callback,
      options,
    ) {
      if (
        typeof callback === "function" &&
        callback.toString().includes("refreshIpadCountdown")
      )
        probe.listeners--;
      remove.call(this, type, callback, options);
    };
  });
  await page.goto("/?time=day");
  await expect(page.getByTestId("week-context")).toContainText("2026");
  await page.clock.pauseAt(now);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
}
const feature = (page: Page) => page.getByTestId("ipad-countdown");
const certificate = (page: Page) =>
  page.getByRole("region", {
    name: "Departamento de Promesas Pendientes",
    exact: true,
  });
const dialog = (page: Page) =>
  page.getByRole("dialog", {
    name: "Departamento de Promesas Pendientes",
    exact: true,
  });
async function refreshAt(page: Page, now: number) {
  await page.clock.setSystemTime(now);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
}
async function open(page: Page) {
  await page.getByRole("button", { name: "¿Y mi iPad?", exact: true }).click();
  await expect(dialog(page)).toBeVisible();
}

test("release boundary reveals only a user-opened surprise; repeated keyboard access restores focus", async ({
  page,
}) => {
  await setup(page, reveal - 1);
  await expect(feature(page)).toHaveCount(0);
  await page.clock.runFor(1);
  const trigger = page.getByRole("button", {
    name: "¿Y mi iPad?",
    exact: true,
  });
  await expect(trigger).toBeVisible();
  await expect(certificate(page)).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(dialog(page)).toBeVisible();
    await expect(
      dialog(page).getByRole("button", { name: "Cerrar", exact: true }),
    ).toBeFocused();
    await expect(dialog(page)).toContainText("Tu iPad no se ha perdido.");
    const targetSize = await dialog(page)
      .getByRole("button", { name: "Cerrar", exact: true })
      .boundingBox();
    expect(targetSize?.width).toBeGreaterThanOrEqual(44);
    expect(targetSize?.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Semana siguiente", exact: true }),
    ).not.toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  }
});

test("midnight closes an open reveal and restores focus to the inline feature", async ({
  page,
}) => {
  await setup(page, inline - 1);
  await open(page);
  await page.clock.runFor(1);
  await expect(dialog(page)).not.toBeVisible();
  await expect(page.getByRole("button", { name: "¿Y mi iPad?" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("heading", { name: "La promesa del iPad", exact: true }),
  ).toBeFocused();
  await expect(certificate(page)).toBeVisible();
  await page.clock.runFor(3000);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("midnight without a reveal never steals existing focus", async ({
  page,
}) => {
  await setup(page, inline - 1);
  const next = page.getByRole("button", {
    name: "Semana siguiente",
    exact: true,
  });
  await next.focus();
  await page.clock.runFor(1);
  await expect(certificate(page)).toBeVisible();
  await expect(next).toBeFocused();
});

test("inline promise survives historical/current/random week navigation", async ({
  page,
}) => {
  await setup(page, inline);
  await expect(certificate(page)).toBeVisible();
  const initial = await feature(page)
    .locator("[data-ipad-timer]")
    .textContent();
  for (const name of [
    "Semana anterior",
    "Semana siguiente",
    "Volver al presente",
    "Semana aleatoria",
  ]) {
    const button = page.getByRole("button", { name, exact: true });
    if (await button.isEnabled()) await button.click();
    await expect(certificate(page)).toHaveCount(1);
    expect(await feature(page).locator("[data-ipad-timer]").textContent()).toBe(
      initial,
    );
  }
  await page.getByText("Detalles de la semana", { exact: true }).click();
  await page
    .getByRole("button", { name: "Semana 43 del 2025", exact: true })
    .click();
  await expect(certificate(page)).toHaveCount(1);
  await expect(page.getByTestId("week-context")).toContainText("2025");
});

for (const qualityStatus of [200, 500]) {
  test(`inline promise is independent of missing/error quality ${qualityStatus}`, async ({
    page,
  }) => {
    await setup(page, inline, { qualities: [], qualityStatus });
    await expect(certificate(page)).toBeVisible();
  });
}

test("exact target settles once and later days never roll over", async ({
  page,
}) => {
  await setup(page, target - 1);
  await expect(feature(page).locator("[data-ipad-timer]")).toContainText(
    "0 días, 0 horas y 1 minuto",
  );
  await page.clock.runFor(1);
  await expect(certificate(page)).toContainText("Hoy toca buscar tu iPad.");
  await expect(feature(page).locator("[data-ipad-timer]")).toHaveCount(0);
  await expect(feature(page).getByRole("status")).toHaveText(
    "Se abre el plazo de cumplir la promesa.",
  );
  await refreshAt(page, Date.parse("2026-11-27T23:00:00Z"));
  await expect(certificate(page)).toContainText("Ya podemos buscar tu iPad.");
  await refreshAt(page, Date.parse("2027-11-01T12:00:00Z"));
  await expect(feature(page).locator("[data-ipad-timer]")).toHaveCount(0);
  await expect(certificate(page)).toContainText("Ya podemos buscar tu iPad.");
});

test("background/resume and clock jumps recompute without drift", async ({
  page,
}) => {
  await setup(page, target - 6 * 3_600_000);
  await expect(feature(page).locator("[data-ipad-timer]")).toContainText(
    "6 horas",
  );
  await refreshAt(page, target - 3_600_000);
  await expect(feature(page).locator("[data-ipad-timer]")).toContainText(
    "1 hora",
  );
  await page.evaluate(() => window.ipadProbe.setHidden(true));
  expect(
    await page.evaluate(() => Object.keys(window.ipadProbe.timers).length),
  ).toBe(0);
  await page.clock.setSystemTime(target + 10_000);
  await page.evaluate(() => window.ipadProbe.setHidden(false));
  await expect(certificate(page)).toContainText("Hoy toca buscar tu iPad.");
});

test("clock has one timer, no closed-modal ticker and no resources after client navigation", async ({
  page,
}) => {
  await setup(page, reveal + 3_600_000);
  await expect(page.getByRole("button", { name: "¿Y mi iPad?" })).toBeVisible();
  const delays = () =>
    page.evaluate(() => Object.values(window.ipadProbe.timers));
  expect(await delays()).toEqual([82_800_000]);
  await open(page);
  expect(await delays()).toEqual([60_000]);
  await page.keyboard.press("Escape");
  expect(await delays()).toEqual([82_800_000]);
  expect(await page.evaluate(() => window.ipadProbe.listeners)).toBe(2);
  await page
    .getByRole("link", { name: "Historia completa", exact: true })
    .click();
  await expect(page).toHaveURL(/\/history/);
  await expect.poll(delays).toEqual([]);
  expect(await page.evaluate(() => window.ipadProbe.listeners)).toBe(0);
});

for (const timezoneId of [
  "Europe/Madrid",
  "UTC",
  "America/New_York",
  "Asia/Tokyo",
]) {
  test(`Palma instant is independent of device zone ${timezoneId}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ timezoneId });
    const page = await context.newPage();
    try {
      await setup(page, reveal + 30 * 60_000);
      await expect(
        page.getByRole("button", { name: "¿Y mi iPad?" }),
      ).toBeVisible();
      if (timezoneId === "America/New_York" || timezoneId === "UTC") {
        await expect(
          page.getByText("Vuelve el 23 de octubre", { exact: true }),
        ).toBeVisible();
      } else
        await expect(
          page.getByRole("button", { name: "Berlín", exact: true }),
        ).toBeVisible();
      await open(page);
      await expect(certificate(page)).toContainText(
        "35 días, 0 horas y 30 minutos",
      );
    } finally {
      await context.close();
    }
  });
}

test("new iPad dialog cancels obsolete gallery handoff even after immediate dismissal", async ({
  page,
}) => {
  await setup(page, reveal + 12 * 3_600_000);
  const puzzle = readFileSync(
    "src/components/BirthdaySecretModal.tsx",
    "utf8",
  ).match(/const PASSWORD = "([^"]+)"/)?.[1];
  if (!puzzle) throw new Error("Existing local puzzle declaration unavailable");
  await page.getByRole("button", { name: "Berlín", exact: true }).click();
  const secret = page.getByRole("dialog", {
    name: "El secreto de Landa",
    exact: true,
  });
  await secret.getByRole("textbox").fill(puzzle);
  await secret
    .getByRole("button", { name: "Descubrir el secreto", exact: true })
    .click();
  await open(page);
  await page.keyboard.press("Escape");
  await page.clock.runFor(500);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "Para ti, Landa", exact: true }),
  ).not.toBeVisible();
});

test("certificate is readable at narrow/landscape widths and across palettes without reduced-motion animation", async ({
  page,
}) => {
  await setup(page, reveal + 12 * 3_600_000);
  for (const width of [320, 390, 1440, 844]) {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
    await open(page);
    await expect(
      dialog(page).getByRole("button", { name: "Cerrar", exact: true }),
    ).toBeInViewport();
    expect(
      await dialog(page).evaluate(
        (node) => node.scrollWidth <= node.clientWidth,
      ),
    ).toBe(true);
    expect(
      await dialog(page).evaluate(
        (node) =>
          node
            .getAnimations({ subtree: true })
            .filter((a) => a.playState === "running").length,
      ),
    ).toBe(0);
    await page.keyboard.press("Escape");
  }
  await refreshAt(page, inline);
  for (const time of ["day", "dawn", "dusk", "night"]) {
    await page.evaluate(
      (time) => document.documentElement.setAttribute("data-time", time),
      time,
    );
    const colors = await certificate(page)
      .locator(".ipad-promise-paper")
      .evaluate((node) => ({
        ink: getComputedStyle(node).color,
        paper: getComputedStyle(node).backgroundColor,
      }));
    expect(colors.ink).not.toBe(colors.paper);
    expect(colors.paper).not.toBe("rgba(0, 0, 0, 0)");
    const luminance = (color: string) => {
      const components = color
        .match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number);
      if (components?.length !== 3)
        throw new Error(`Unexpected computed color: ${color}`);
      return components
        .map((n) => {
          const s = n / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        })
        .reduce((total, n, i) => total + n * [0.2126, 0.7152, 0.0722][i], 0);
    };
    const ink = luminance(colors.ink);
    const paper = luminance(colors.paper);
    expect(
      (Math.max(ink, paper) + 0.05) / (Math.min(ink, paper) + 0.05),
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test("normal flourish never hides text and stops when reduced motion changes", async ({
  page,
}) => {
  await setup(page, reveal + 12 * 3_600_000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page);
  await expect(
    certificate(page).getByRole("heading", {
      name: "Tu iPad no se ha perdido.",
      exact: true,
    }),
  ).toBeVisible();
  const close = dialog(page).getByRole("button", {
    name: "Cerrar",
    exact: true,
  });
  const before = await close.boundingBox();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await dialog(page).evaluate(
      (node) =>
        node
          .getAnimations({ subtree: true })
          .filter((a) => a.playState === "running").length,
    ),
  ).toBe(0);
  expect(await close.boundingBox()).toEqual(before);
});

test("new feature adds no hydration diagnostic to the known historical-calendar baseline", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await setup(page, Date.parse("2026-06-15T12:00:00+02:00"), {
    storedWeek: { week: 25, year: 2026 },
  });
  const known = readFileSync(
    "tests/e2e/fixtures/home-calendar-hydration.txt",
    "utf8",
  ).trimEnd();
  const normalized = errors.map((message) =>
    message
      .replace(
        /^- {29}(?:[1-9]|[1-4]\d|5[0-3])$/m,
        "-                             <server-calendar-week>",
      )
      .trimEnd(),
  );
  expect(normalized.length).toBeLessThanOrEqual(1);
  for (const message of normalized) expect(message).toBe(known);
  await expect(feature(page)).toHaveCount(0);
});

test("actual illustrated flourish has bounded motion and stable controls; save synthetic evidence", async ({
  page,
}, info) => {
  await setup(page, reveal + 12 * 3_600_000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page);
  const close = dialog(page).getByRole("button", {
    name: "Cerrar",
    exact: true,
  });
  const box = await close.boundingBox();
  const transforms: string[] = [];
  for (const frame of [0, 350, 700]) {
    const transform = await certificate(page)
      .locator(".ipad-promise-clock")
      .evaluate((node, frame) => {
        const animation = node.getAnimations()[0];
        if (!animation) throw new Error("Expected a real clock flourish");
        animation.pause();
        animation.currentTime = frame;
        return getComputedStyle(node).transform;
      }, frame);
    transforms.push(transform);
    await expect(
      certificate(page).getByRole("heading", {
        name: "Tu iPad no se ha perdido.",
        exact: true,
      }),
    ).toBeVisible();
    expect(await close.boundingBox()).toEqual(box);
    await page.screenshot({
      path: `playwright-report/ipad-countdown/reveal-${info.project.name}-${frame}.png`,
    });
  }
  expect(new Set(transforms).size).toBe(3);
  await page.keyboard.press("Escape");
  await refreshAt(page, inline);
  await feature(page).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `playwright-report/ipad-countdown/compact-${info.project.name}.png`,
    fullPage: true,
  });
  await refreshAt(page, target);
  await page.screenshot({
    path: `playwright-report/ipad-countdown/shopping-${info.project.name}.png`,
    fullPage: true,
  });
});
