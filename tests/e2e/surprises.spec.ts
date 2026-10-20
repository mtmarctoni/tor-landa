import { expect, test } from "@playwright/test";
import { installJournalFixtures } from "./journal.fixture";

test("footer surprise traps focus and restores the opener", async ({
  page,
}) => {
  // Ensure both layouts have real document scrolling, not a zero-offset assertion.
  await page.setViewportSize({
    width: test.info().project.name === "phone" ? 390 : 1440,
    height: 650,
  });
  await installJournalFixtures(page, { storedWeek: { week: 24, year: 2026 } });
  await page.goto("/");
  await expect(page.getByTestId("week-context")).toContainText(
    "Semana 24 / 2026",
  );
  const week = await page.getByTestId("week-context").textContent();
  const opener = page.getByRole("button", {
    name: "Abrir sorpresa",
    exact: true,
  });
  await opener.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "visible";
  });
  const scroll = await page.evaluate(() => scrollY);
  expect(scroll).toBeGreaterThan(0);
  const target = await opener.boundingBox();
  await page.waitForTimeout(350);
  expect(await opener.boundingBox()).toEqual(target);
  expect(target?.height).toBeGreaterThanOrEqual(44);
  expect(target?.width).toBeGreaterThanOrEqual(44);
  if (test.info().project.name === "phone") await opener.tap();
  else await opener.click();
  const dialog = page.getByRole("dialog", {
    name: "Sorpresa surrealista",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Cerrar", exact: true }),
  ).toBeFocused();
  for (const key of [
    "Tab",
    "Tab",
    "Tab",
    "Tab",
    "Shift+Tab",
    "Shift+Tab",
    "Shift+Tab",
    "Shift+Tab",
  ]) {
    await page.keyboard.press(key);
    // Native Chromium can visit browser chrome (body becomes active, document
    // loses focus); that is not an inert background element receiving focus.
    expect(
      await dialog.evaluate(
        (el) =>
          el.contains(document.activeElement) ||
          (!document.hasFocus() && document.activeElement === document.body),
      ),
    ).toBe(true);
  }
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).focus();
  expect(
    await page.evaluate(() => [
      getComputedStyle(document.documentElement).overflow,
      getComputedStyle(document.body).overflow,
    ]),
  ).toEqual(["hidden", "hidden"]);
  await page.mouse.move(5, 5);
  await page.mouse.wheel(0, -700);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await page
    .getByRole("button", {
      name: "Semana anterior",
      exact: true,
      includeHidden: true,
    })
    .evaluate((el: HTMLElement) => el.focus());
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(
    await page.evaluate(() => [
      document.documentElement.style.overflow,
      document.body.style.overflow,
    ]),
  ).toEqual(["auto", "visible"]);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await opener.click();
  await page.keyboard.press("ArrowLeft");
  // Check each direction independently: opposite navigation must not cancel a bug.
  await expect(page.getByTestId("week-context")).toHaveText(week ?? "");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.type("amor");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.getByTestId("week-context")).toHaveText(week ?? "");
  await page.mouse.wheel(0, -500);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(scroll);
});

test("AMOR works by keyboard and touch", async ({ page }) => {
  await installJournalFixtures(page);
  await page.goto("/");
  await expect(page.getByTestId("quality-message")).toHaveText(
    "Tu imaginación abre puertas imposibles.",
  );
  await page.keyboard.type("amor");
  const dialog = page.getByRole("dialog", {
    name: "Momento especial",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    "A veces lo mejor aparece cuando menos te lo esperas.",
  );
  await page.keyboard.press("Escape");
  const trigger = page.getByRole("button", {
    name: "Abrir un momento especial",
    exact: true,
  });
  await trigger.scrollIntoViewIfNeeded();
  const target = await trigger.boundingBox();
  await page.waitForTimeout(350);
  expect(await trigger.boundingBox()).toEqual(target);
  expect(target?.height).toBeGreaterThanOrEqual(44);
  expect(target?.width).toBeGreaterThanOrEqual(44);
  if (test.info().project.name === "phone") await trigger.tap();
  else await trigger.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(trigger).toBeFocused();
  await page.goto("/history");
  const search = page.getByRole("textbox", { name: "Buscar en mensajes" });
  // The archive loading shell already has a disabled search. Key presses do
  // not wait for it to become enabled and would otherwise go to the body.
  await expect(search).toBeEnabled();
  await search.focus();
  await expect(search).toBeFocused();
  await search.pressSequentially("amor");
  await expect(search).toHaveValue("amor");
  await expect(search).toBeFocused();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
});

test("editable controls suppress global shortcuts", async ({ page }) => {
  await installJournalFixtures(page);
  await page.goto("/");
  await expect(page.getByTestId("week-context")).toContainText(
    "Semana 25 / 2026",
  );
  const week = await page.getByTestId("week-context").textContent();
  await page.evaluate(() => {
    const editor = document.createElement("div");
    editor.contentEditable = "true";
    editor.setAttribute("aria-label", "Test editor");
    document.body.append(editor);
    editor.focus();
  });
  await page.keyboard.type("amor");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.getByTestId("week-context")).toHaveText(week ?? "");
});

test("surprise worlds remain readable in reduced motion and short landscape", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installJournalFixtures(page);
  await page.goto("/?time=night");
  for (const [trigger, title, prefix] of [
    ["Abrir sorpresa", "Sorpresa surrealista", "surprise"],
    ["Abrir un momento especial", "Momento especial", "amor"],
  ]) {
    await page.getByRole("button", { name: trigger, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: title, exact: true });
    await expect(
      dialog.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(dialog.locator("p").last()).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Cerrar", exact: true }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const before = await dialog.boundingBox();
    await page.waitForTimeout(650);
    expect(await dialog.boundingBox()).toEqual(before);
    expect(
      await dialog.evaluate(
        (el) =>
          el
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
    ).toBe(0);
    await page.screenshot({
      path: `playwright-report/evidence/${prefix}-${testInfo.project.name}.png`,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: 667, height: 320 });
  await page
    .getByRole("button", { name: "Abrir sorpresa", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Sorpresa surrealista",
    exact: true,
  });
  const close = dialog.getByRole("button", { name: "Cerrar", exact: true });
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await close.focus();
  await expect(close).toBeInViewport();
  expect(
    await close.evaluate((el) => getComputedStyle(el).outlineStyle),
  ).not.toBe("none");
  const content = dialog.locator(".journal-dialog-content");
  expect(
    await content.evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBe(true);
  await content.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(dialog.locator("p").last()).toBeInViewport();
  await page.screenshot({
    path: `playwright-report/evidence/surprise-landscape-${testInfo.project.name}.png`,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
});
