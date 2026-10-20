import { expect, test } from "@playwright/test";
import { installJournalFixtures } from "./journal.fixture";

for (const width of [320, 390, 430, 768, 1440]) {
  test(`long journal message remains readable at ${width}px`, async ({
    page,
  }) => {
    const message =
      "Ánimo, imaginación y cariño.\n\n" +
      "Una nota larga. ".repeat(100) +
      "x".repeat(240);
    await page.setViewportSize({ width, height: 844 });
    await installJournalFixtures(page, {
      qualities: [{ week: 25, year: 2026, message }],
    });
    await page.goto("/");
    await expect(page.getByTestId("quality-message")).toHaveText(message);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page.getByTestId("quality-message").evaluate((el) => {
        const style = getComputedStyle(el);
        return (
          Number.parseFloat(style.fontSize) >= 16 &&
          style.whiteSpace === "pre-wrap" &&
          el.scrollWidth <= el.clientWidth + 1
        );
      }),
    ).toBe(true);
    if (width === 390)
      await page.screenshot({
        path: `playwright-report/evidence/task-2-long-${test.info().project.name}.png`,
        fullPage: true,
      });
  });
}

test("all four vivid themes retain legible cloud text", async ({ page }) => {
  await installJournalFixtures(page);
  for (const route of ["/", "/history"]) {
    const palettes = new Set<string>();
    for (const time of ["dawn", "day", "dusk", "night"]) {
      await page.goto(`${route}?time=${time}`);
      await expect(page.locator("html")).toHaveAttribute("data-time", time);
      const palette = await page.locator("html").evaluate((el) => {
        const style = getComputedStyle(el);
        const luminance = (hex: string) => {
          const rgb = (hex.trim().replace("#", "").match(/../g) ?? [])
            .map((value) => Number.parseInt(value, 16) / 255)
            .map((c) =>
              c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
            );
          return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
        };
        const cloud = style.getPropertyValue("--dream-cloud");
        return {
          surface: style.getPropertyValue("--journal-surface"),
          ratios: ["--journal-ink", "--journal-muted", "--journal-accent"].map(
            (token) => {
              const a = luminance(cloud),
                b = luminance(style.getPropertyValue(token));
              return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            },
          ),
        };
      });
      palettes.add(palette.surface);
      for (const ratio of palette.ratios)
        expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    expect(palettes.size).toBe(4);
  }
});

test("reduced motion leaves a stable readable message", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installJournalFixtures(page);
  await page.goto("/");
  const message = page.getByTestId("quality-message");
  await expect(message).toBeVisible();
  await page.waitForTimeout(700);
  const first = await message.boundingBox();
  await page.waitForTimeout(300);
  const second = await message.boundingBox();
  if (!first || !second) throw new Error("Message has no readable bounds");
  for (const key of ["x", "y", "width", "height"] as const)
    expect(Math.abs(first[key] - second[key])).toBeLessThan(1);
  expect(
    await message.evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  expect(
    await message.evaluate((el) => {
      const article = el.closest('article, [role="article"]');
      return article ? getComputedStyle(article).animationName : "missing";
    }),
  ).toBe("none");
});

test("art failure does not hide the message", async ({ page }) => {
  await installJournalFixtures(page);
  await page.route("**/images/**", (route) => route.abort());
  await page.route("**/_next/image?**", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByTestId("quality-message")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Semana anterior", exact: true }),
  ).toBeVisible();
});

test("decorative layers cannot obscure or intercept the reading area", async ({
  page,
}, testInfo) => {
  await installJournalFixtures(page);
  for (const time of ["day", "dawn", "dusk", "night"]) {
    await page.goto(`/?time=${time}`);
    const message = page.getByTestId("quality-message");
    await expect(message).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1600);
    const scene = page.getByTestId("journal-scene");
    await expect(scene).toHaveAttribute("aria-hidden", "true");
    expect(
      await scene.evaluate((el) => getComputedStyle(el).pointerEvents),
    ).toBe("none");
    const text = await message.boundingBox();
    if (!text) throw new Error("Message has no bounds");
    const protectedText = await message.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(
        r.x + r.width / 2,
        r.y + Math.min(r.height / 2, 20),
      );
      const cloud = document.querySelector(".dream-message-shell");
      return {
        hit: hit === el || el.contains(hit),
        cloud: cloud && getComputedStyle(cloud).backgroundColor,
      };
    });
    expect(protectedText.hit).toBe(true);
    expect(protectedText.cloud).not.toBe("rgba(0, 0, 0, 0)");
    await expect(scene.locator("[data-painting]")).toHaveCount(4);
    await page.screenshot({
      path: `playwright-report/evidence/task-2-${testInfo.project.name}-${time}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Semana anterior", exact: true })
    .focus();
  await page.screenshot({
    path: `playwright-report/evidence/task-2-${testInfo.project.name}-focus.png`,
    fullPage: true,
  });
});
