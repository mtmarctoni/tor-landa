import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { installJournalFixtures } from "./journal.fixture";

for (const reduced of [false, true]) {
  test(`lunar nonsense is accessible and bounded (${reduced ? "reduced" : "normal"})`, async ({
    page,
  }, info) => {
    await page.emulateMedia({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await installJournalFixtures(page);
    await page.goto("/?time=day");
    await expect(page.getByTestId("quality-message")).toBeVisible();
    for (const character of ["blushing-moon", "flying-fish", "painting-legs"]) {
      await expect(
        page.locator(`[data-laboratory-character='${character}']`).first(),
      ).toBeVisible();
    }
    const request = page.getByRole("button", { name: "Pedirle la luna" });
    await request.focus();
    if (info.project.name === "phone") await request.tap();
    else await page.keyboard.press("Enter");
    const reply = page.getByRole("status", { name: "Respuesta de la luna" });
    await expect(reply).toContainText("patata");
    await expect(page.locator("[data-laboratory-gift]")).toHaveCount(1);
    await expect(request).toBeFocused();
    for (let repeat = 0; repeat < 8; repeat++) await request.click();
    await expect(page.locator("[data-laboratory-gift]")).toHaveCount(1);
    await expect(reply).not.toBeEmpty();
    await expect(page.getByTestId("quality-message")).toHaveText(
      "Tu imaginación abre puertas imposibles.",
    );
    if (reduced)
      expect(
        await page
          .locator(".laboratory-cast")
          .evaluate((n) => n.getAnimations({ subtree: true }).length),
      ).toBe(0);
    await mkdir("playwright-report/post-office", { recursive: true });
    for (const theme of ["day", "night"]) {
      await page.goto(`/?time=${theme}`);
      await expect(page.getByTestId("quality-message")).toBeVisible();
      await page.waitForTimeout(1200);
      await expect(page.locator("html")).toHaveAttribute("data-time", theme);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `playwright-report/post-office/${info.project.name}-${theme}-${reduced ? "reduced" : "normal"}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 320, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

  test(`postal assistant shares the letter and controls stay still (${reduced ? "reduced" : "normal"})`, async ({
    page,
  }, info) => {
    await page.emulateMedia({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await installJournalFixtures(page);
    await page.goto("/?time=day");
    const scene = page.getByTestId("post-office");
    const message = scene.getByTestId("quality-message");
    await expect(message).toBeVisible();
    expect((await message.boundingBox())?.y).toBeLessThan(500);
    await expect(scene.locator(".postal-cup")).toBeVisible();
    await expect(page.getByTestId("gravity-theatre")).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    const action = page.getByRole("button", {
      name: "Semana aleatoria",
      exact: true,
    });
    const before = await action.boundingBox();
    const beforeScroll = await page.evaluate(() => scrollY);
    if (!before) throw new Error("Postal control must remain visible");
    expect(before.height).toBeGreaterThanOrEqual(44);
    expect(before.width).toBeGreaterThanOrEqual(44);
    await action.focus();
    if (info.project.name === "phone") await action.tap();
    else await page.keyboard.press("Space");
    await expect(scene.locator(".postal-jealous-brow")).toBeVisible();
    await expect(action).toBeFocused();
    const count = await scene.locator("*").count();
    for (let i = 0; i < 20; i++) await action.click();
    expect(await scene.locator("*").count()).toBe(count);
    // Random memories can have different text lengths; return to the same letter.
    const present = page.getByRole("button", { name: "Volver al presente" });
    if (await present.isEnabled()) await present.click();
    const after = await action.boundingBox();
    expect(after?.width).toBe(before.width);
    expect(after?.height).toBe(before.height);
    expect(after?.x).toBe(before.x);
    expect((after?.y ?? 0) + (await page.evaluate(() => scrollY))).toBe(
      before.y + beforeScroll,
    );
    await expect(message).toHaveText("Tu imaginación abre puertas imposibles.");
    await page.getByRole("button", { name: "Pedirle la luna" }).click();
    await expect(
      page.getByRole("status", { name: "Respuesta de la luna" }),
    ).toContainText("patata");
    if (reduced) {
      for (const selector of [
        ".laboratory-header",
        "[data-testid='journal-scene']",
        ".laboratory-legs",
        ".postal-scene",
      ]) {
        for (const node of await page.locator(selector).all())
          expect(
            await node.evaluate(
              (n) => n.getAnimations({ subtree: true }).length,
            ),
          ).toBe(0);
      }
    }
    await page.screenshot({
      path: `playwright-report/post-office/${info.project.name}-random-${reduced ? "reduced" : "normal"}.png`,
      fullPage: true,
    });
  });
}

test("long letter at 320px has unobstructed space inside its envelope", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const text = "Tu imaginación abre puertas imposibles. ".repeat(35);
  await installJournalFixtures(page, {
    qualities: [{ week: 25, year: 2026, message: text }],
  });
  await page.goto("/");
  const message = page.getByTestId("quality-message");
  await expect(message).toHaveText(text.trim());
  const letter = await message.boundingBox();
  const cup = await page.locator(".postal-cup").boundingBox();
  if (!letter || !cup)
    throw new Error("Letter and assistant must remain visible");
  expect(cup.y).toBeGreaterThan(letter.y + letter.height);
  for (const button of await page
    .getByRole("navigation", { name: "Navegar entre semanas" })
    .getByRole("button")
    .all()) {
    const box = await button.boundingBox();
    if (!box) throw new Error("Navigation must remain visible");
    expect(box.y).toBeGreaterThan(cup.y + cup.height);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(message).toHaveText(text.trim());
});

test("dialog typing and arrows cannot activate the outside postal scene", async ({
  page,
}) => {
  await installJournalFixtures(page, {
    now: "2026-10-23T12:00:00+02:00",
    storedWeek: { week: 43, year: 2025 },
    qualities: [
      { week: 43, year: 2025, message: "Berlín y nuestros cuatro números" },
    ],
  });
  await page.goto("/");
  const scene = page.getByTestId("post-office");
  await expect(scene.getByTestId("quality-message")).toBeVisible();
  const before = await scene
    .locator(".postal-moon-pose")
    .evaluate((n) => getComputedStyle(n).transform);
  await page
    .getByRole("button", { name: "nuestros cuatro números", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "El secreto de Landa",
    exact: true,
  });
  const field = dialog.getByRole("textbox", {
    name: "Código secreto",
    exact: true,
  });
  await expect(field).toBeFocused();
  await field.pressSequentially("gravedad y patata");
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowLeft");
  await expect(field).toBeFocused();
  expect(
    await scene
      .locator(".postal-moon-pose")
      .evaluate((n) => getComputedStyle(n).transform),
  ).toBe(before);
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "nuestros cuatro números", exact: true }),
  ).toBeFocused();
  await expect(scene.getByTestId("quality-message")).toHaveText(
    "Berlín y nuestros cuatro números",
  );
});
