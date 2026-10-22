import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { installJournalFixtures } from "./journal.fixture";

const longText =
  "Ánimo, imaginación y cariño.\n\n" +
  "Una memoria imposible. ".repeat(65) +
  "x".repeat(240);
const puzzle =
  process.env.JOURNAL_TEST_SECRET ??
  readFileSync("src/components/BirthdaySecretModal.tsx", "utf8").match(
    /const PASSWORD = "([^"]+)"/,
  )?.[1];

interface BrowserDiagnostic {
  route: string;
  kind: "console" | "pageerror";
  message: string;
  location: unknown;
}
const knownHomeCalendarMismatch = readFileSync(
  "tests/e2e/fixtures/home-calendar-hydration.txt",
  "utf8",
).trimEnd();
function isKnownHomeCalendarMismatch(error: BrowserDiagnostic) {
  return (
    error.route === "/?time=day" &&
    error.kind === "pageerror" &&
    error.message
      .replace(
        /^- {29}(?:[1-9]|[1-4]\d|5[0-3])$/m,
        "-                             <server-calendar-week>",
      )
      .trimEnd() === knownHomeCalendarMismatch
  );
}

async function targets(root: Locator) {
  const controls = root.locator(
    "button:visible, a[href]:visible, summary:visible, input:visible, select:visible",
  );
  expect(await controls.count()).toBeGreaterThan(0);
  for (const control of await controls.all()) {
    const box = await control.boundingBox();
    expect(box, (await control.textContent()) ?? "control").not.toBeNull();
    expect(
      box?.width,
      (await control.textContent()) ?? "width",
    ).toBeGreaterThanOrEqual(44);
    expect(
      box?.height,
      (await control.textContent()) ?? "height",
    ).toBeGreaterThanOrEqual(44);
  }
}

async function semantics(page: Page) {
  expect(
    await page
      .locator(
        "main button button, main button a, main a button, main a a, dialog button button, dialog a button",
      )
      .count(),
  ).toBe(0);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
}

// Checks resolved rendered surfaces, not merely the hex token declarations.
async function contrast(root: Locator) {
  const results = await root.evaluate((root) => {
    const rgb = (color: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas color support unavailable");
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data).map((v) => v / 255);
    };
    const luminance = (c: number[]) =>
      c
        .slice(0, 3)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        "h2, p, label, button, span, input[placeholder]",
      ),
    )
      .filter(
        (el) =>
          el.getClientRects().length &&
          (el.textContent?.trim() || el.getAttribute("placeholder")) &&
          !el.closest('[aria-hidden="true"]') &&
          !el.matches(":disabled"),
      )
      .map((el) => {
        const style = getComputedStyle(
          el,
          el.matches("input[placeholder]") ? "::placeholder" : null,
        );
        let ancestor: HTMLElement | null = el;
        let bg = [0, 0, 0, 0];
        while (ancestor) {
          const c = rgb(getComputedStyle(ancestor).backgroundColor);
          bg = [0, 1, 2]
            .map((i) => bg[i] * bg[3] + c[i] * c[3] * (1 - bg[3]))
            .concat(bg[3] + c[3] * (1 - bg[3]));
          if (bg[3] >= 0.999) break;
          ancestor = ancestor.parentElement;
        }
        const fg = rgb(style.color);
        const alpha = fg[3] * Number(style.opacity);
        const composited = fg
          .slice(0, 3)
          .map((channel, i) => channel * alpha + bg[i] * (1 - alpha));
        const a = luminance(composited),
          b = luminance(bg);
        return {
          text: (el.getAttribute("placeholder") ?? el.textContent)?.slice(
            0,
            60,
          ),
          opaque: bg[3],
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          minimum:
            parseFloat(style.fontSize) >= 24 ||
            (parseFloat(style.fontSize) >= 18.66 &&
              parseFloat(style.fontWeight) >= 700)
              ? 3
              : 4.5,
        };
      });
  });
  expect(results.length).toBeGreaterThan(0);
  for (const result of results) {
    expect(result.opaque, JSON.stringify(result)).toBeGreaterThanOrEqual(0.999);
    expect(result.ratio, JSON.stringify(result)).toBeGreaterThanOrEqual(
      result.minimum,
    );
  }
}

for (const [width, height] of [
  [320, 844],
  [390, 844],
  [430, 844],
  [768, 844],
  [1440, 1000],
  [844, 390],
]) {
  test(`both routes reflow long Spanish and unbroken text at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installJournalFixtures(page, {
      qualities: [{ week: 25, year: 2026, message: longText }],
    });
    for (const route of ["/", "/history"]) {
      await page.goto(route);
      await expect(page.getByText(longText, { exact: true })).toBeVisible();
      if (route === "/") {
        const summary = page.getByText("Detalles de la semana", {
          exact: true,
        });
        await summary.focus();
        await page.keyboard.press("Enter");
        await expect(
          page.getByRole("button", { name: "Recargar datos", exact: true }),
        ).toBeVisible();
        await page.keyboard.press("Space");
        await expect(
          page.getByRole("button", { name: "Recargar datos", exact: true }),
        ).toBeHidden();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await targets(page.locator("main"));
      await semantics(page);
      const boxes = await page
        .locator("main button:visible")
        .evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return [r.x, r.y, r.width, r.height];
          }),
        );
      await page.waitForTimeout(250);
      expect(
        await page.locator("main button:visible").evaluateAll((els) =>
          els.map((el) => {
            const r = el.getBoundingClientRect();
            return [r.x, r.y, r.width, r.height];
          }),
        ),
      ).toEqual(boxes);
    }
  });
}

test("four dialogs in four themes have solid readable surfaces, inert backgrounds and stable reduced motion", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  if (!puzzle)
    throw new Error("Existing local puzzle unavailable; no bypass allowed");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installJournalFixtures(page, {
    now: "2026-10-23T12:00:00+02:00",
    storedWeek: { week: 43, year: 2025 },
    qualities: [
      { week: 43, year: 2025, message: "Berlín y nuestros cuatro números" },
    ],
  });
  for (const time of ["dawn", "day", "dusk", "night"]) {
    await page.goto(`/?time=${time}`);
    await expect(
      page.getByRole("button", { name: "Berlín", exact: true }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-time", time);
    await page.evaluate(() => document.fonts.ready);
    for (const [trigger, title] of [
      ["Abrir sorpresa", "Sorpresa surrealista"],
      ["Abrir un momento especial", "Momento especial"],
      ["Berlín", "El secreto de Landa"],
      ["Berlín", "Para ti, Landa"],
    ]) {
      const opener = page.getByRole("button", { name: trigger, exact: true });
      await opener.scrollIntoViewIfNeeded();
      const scroll = await page.evaluate(() => scrollY);
      const week = await page.getByTestId("week-context").textContent();
      await opener.click();
      if (title === "Para ti, Landa") {
        const secret = page.getByRole("dialog", {
          name: "El secreto de Landa",
          exact: true,
        });
        await secret.getByRole("textbox").fill(puzzle);
        await secret
          .getByRole("button", { name: "Descubrir el secreto" })
          .click();
      }
      const dialog = page.getByRole("dialog", { name: title, exact: true });
      await expect(dialog).toBeVisible();
      await expect(page.locator("dialog[open]")).toHaveCount(1);
      await expect(
        dialog.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      const close = dialog.getByRole("button", { name: "Cerrar", exact: true });
      await expect(close).toBeInViewport();
      await targets(dialog);
      await contrast(dialog);
      await semantics(page);
      if (title === "El secreto de Landa")
        await expect(dialog.getByRole("textbox")).toBeFocused();
      else await expect(close).toBeFocused();
      for (const key of [
        "Tab",
        "Tab",
        "Shift+Tab",
        "ArrowLeft",
        "ArrowRight",
      ]) {
        await page.keyboard.press(key);
        expect(
          await dialog.evaluate(
            (el) =>
              el.contains(document.activeElement) ||
              (!document.hasFocus() &&
                document.activeElement === document.body),
          ),
        ).toBe(true);
        await expect(page.getByTestId("week-context")).toHaveText(week ?? "");
      }
      await page.keyboard.type("amor");
      await expect(page.locator("dialog[open]")).toHaveCount(1);
      expect(
        await page.evaluate(
          () => getComputedStyle(document.documentElement).overflow,
        ),
      ).toBe("hidden");
      const bounds = await dialog.boundingBox();
      const message = await page.getByTestId("quality-message").boundingBox();
      const scene = await page.getByTestId("journal-scene").boundingBox();
      await page.waitForTimeout(400);
      expect(await dialog.boundingBox()).toEqual(bounds);
      expect(await page.getByTestId("quality-message").boundingBox()).toEqual(
        message,
      );
      expect(await page.getByTestId("journal-scene").boundingBox()).toEqual(
        scene,
      );
      expect(
        await dialog.evaluate(
          (el) =>
            el
              .getAnimations({ subtree: true })
              .filter((a) => a.playState === "running").length,
        ),
      ).toBe(0);
      if (
        time === "day" &&
        ["El secreto de Landa", "Para ti, Landa"].includes(title)
      ) {
        if (title === "Para ti, Landa")
          await expect(
            dialog.getByRole("img", { name: "Recuerdo 1", exact: true }),
          ).toHaveJSProperty("complete", true);
        await page.screenshot({
          path: `playwright-report/evidence/task-7-${title === "Para ti, Landa" ? "gallery" : "secret"}-${info.project.name}.png`,
        });
      }
      await page.keyboard.press("Escape");
      await expect(page.locator("dialog[open]")).toHaveCount(0);
      await expect(opener).toBeFocused();
      expect(await page.evaluate(() => scrollY)).toBe(scroll);
    }
  }
});

test("failed decorative assets preserve both routes and keyboard navigation", async ({
  page,
}) => {
  await installJournalFixtures(page);
  let failures = 0;
  await page.route(/\/(images\/|_next\/image)/, (route) => {
    failures++;
    return route.abort();
  });
  await page.goto("/");
  await expect(page.getByTestId("quality-message")).toBeVisible();
  await page
    .getByRole("button", { name: "Semana anterior", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("week-context")).toContainText("Semana 24");
  await page
    .getByRole("link", { name: "Historia completa", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(4);
  await page
    .getByRole("textbox", { name: "Buscar en mensajes" })
    .fill("paciencia");
  await expect(page.getByRole("article")).toHaveCount(1);
  expect(failures).toBeGreaterThan(0);
});

test("reduced motion does not introduce layout transitions when archive loading resolves", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installJournalFixtures(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/quality", async (route) => {
    await held;
    await route.fulfill({
      json: {
        qualities: [
          { week: 25, year: 2026, message: "Una memoria sintética." },
        ],
      },
    });
  });
  await page.goto("/history");
  await expect(page.getByRole("status")).toContainText("Reuniendo recuerdos");
  release();
  await expect(page.getByRole("article")).toHaveCount(1);
  expect(
    await page
      .locator(".archive-collection")
      .evaluate((el) => getComputedStyle(el).transitionProperty),
  ).toBe("none");
  const before = await page.getByRole("article").boundingBox();
  await page.waitForTimeout(650);
  expect(await page.getByRole("article").boundingBox()).toEqual(before);
});

test("normal-motion archive loading keeps tools and first collection anchored", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await installJournalFixtures(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/quality", async (route) => {
    await held;
    await route.fulfill({
      json: { qualities: [{ week: 25, year: 2026, message: longText }] },
    });
  });
  await page.goto("/history");
  await expect(page.getByRole("status")).toContainText("Reuniendo recuerdos");
  await page.evaluate(() => document.fonts.ready);
  const loading = await page
    .locator(".archive-collection, .archive-state")
    .first()
    .boundingBox();
  const tools = (await page.locator(".archive-tools").count())
    ? await page.locator(".archive-tools").boundingBox()
    : null;
  const collection = (await page.locator(".archive-islands").count())
    ? await page.locator(".archive-islands").boundingBox()
    : null;
  release();
  await expect(page.getByRole("article")).toHaveCount(1);
  const loadedTools = await page.locator(".archive-tools").boundingBox();
  const loadedCollection = await page.locator(".archive-islands").boundingBox();
  await writeFile(
    `playwright-report/evidence/task-7-loading-${info.project.name}.json`,
    JSON.stringify(
      { loading, tools, collection, loadedTools, loadedCollection },
      null,
      2,
    ),
  );
  expect(tools, "toolbar must exist during the held response").not.toBeNull();
  expect(
    collection,
    "initial collection footprint must exist while loading",
  ).not.toBeNull();
  for (const key of ["x", "y", "width"] as const) {
    expect(
      Math.abs((tools?.[key] ?? -10000) - (loadedTools?.[key] ?? 0)),
    ).toBeLessThan(1);
    expect(
      Math.abs((collection?.[key] ?? -10000) - (loadedCollection?.[key] ?? 0)),
    ).toBeLessThan(1);
  }
  await expect(page.getByRole("article").locator("p")).toHaveText(longText);
  expect(
    await page
      .getByRole("article")
      .locator("p")
      .evaluate((el) => el.scrollHeight <= el.clientHeight),
  ).toBe(true);
});

test("current synthetic footprint, console and final route screenshots", async ({
  page,
}, info) => {
  const consoleErrors: BrowserDiagnostic[] = [];
  const route = () => {
    const url = new URL(page.url());
    return url.pathname + url.search;
  };
  page.on("console", (msg) => {
    if (msg.type() === "error")
      consoleErrors.push({
        route: route(),
        kind: "console",
        message: msg.text(),
        location: msg.location(),
      });
  });
  page.on("pageerror", (error) =>
    consoleErrors.push({
      route: route(),
      kind: "pageerror",
      message: error.message,
      location: error.stack,
    }),
  );
  await installJournalFixtures(page);
  const network = await page.context().newCDPSession(page);
  await network.send("Network.enable");
  const requests = new Map<
    string,
    { path: string; type: string; encodedBytes: number }
  >();
  network.on("Network.requestWillBeSent", (event) => {
    requests.set(event.requestId, {
      path: new URL(event.request.url).pathname,
      type: event.type ?? "Other",
      encodedBytes: 0,
    });
  });
  network.on("Network.loadingFinished", (event) => {
    const request = requests.get(event.requestId);
    if (request) request.encodedBytes = event.encodedDataLength;
  });
  await page.addInitScript(() => {
    const shifts: number[] = [];
    Object.assign(window, { journalLayoutShifts: shifts });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          hadRecentInput: boolean;
          value: number;
        };
        if (!shift.hadRecentInput) shifts.push(shift.value);
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  const routes = [];
  for (const route of ["/", "/history"]) {
    requests.clear();
    await page.goto(`${route}?time=day`);
    if (route === "/")
      await expect(page.getByTestId("quality-message")).toBeVisible();
    else await expect(page.getByRole("article")).toHaveCount(4);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1800);
    await page.screenshot({
      path: `playwright-report/evidence/task-7-${route === "/" ? "home" : "history"}-${info.project.name}.png`,
      fullPage: true,
      animations: "disabled",
    });
    routes.push({
      network: Array.from(requests.values()),
      browser: await page.evaluate(() => ({
        route: location.pathname,
        resources: performance.getEntriesByType("resource").map((e) => {
          const r = e as PerformanceResourceTiming;
          return {
            path: new URL(r.name).pathname,
            type: r.initiatorType,
            bytes: r.transferSize,
            decoded: r.decodedBodySize,
          };
        }),
        layoutShiftSum: (
          window as unknown as { journalLayoutShifts: number[] }
        ).journalLayoutShifts.reduce((a, b) => a + b, 0),
      })),
    });
  }
  await writeFile(
    `playwright-report/evidence/task-7-footprint-${info.project.name}.json`,
    JSON.stringify({ routes, consoleErrors }, null, 2),
  );
  // Exact synthetic home week-context mismatch only; archive/unrelated hydration fails.
  expect(
    consoleErrors.filter(isKnownHomeCalendarMismatch).length,
  ).toBeLessThanOrEqual(1);
  const unexpected = consoleErrors.filter(
    (error) => !isKnownHomeCalendarMismatch(error),
  );
  expect(unexpected).toEqual([]);
});

test("console exception is limited to one exact home calendar diagnostic", () => {
  const known: BrowserDiagnostic = {
    route: "/?time=day",
    kind: "pageerror",
    message: knownHomeCalendarMismatch.replace("<server-calendar-week>", "43"),
    location: "raw stack retained separately",
  };
  expect(isKnownHomeCalendarMismatch(known)).toBe(true);
  expect(
    isKnownHomeCalendarMismatch({ ...known, route: "/history?time=day" }),
  ).toBe(false);
  expect(isKnownHomeCalendarMismatch({ ...known, kind: "console" })).toBe(
    false,
  );
  expect(
    isKnownHomeCalendarMismatch({
      ...known,
      message: known.message.replace(
        'data-testid="week-context"',
        'data-testid="quality-message"',
      ),
    }),
  ).toBe(false);
  expect(
    isKnownHomeCalendarMismatch({
      ...known,
      message: "Hydration failed: unrelated mismatch",
    }),
  ).toBe(false);
});
