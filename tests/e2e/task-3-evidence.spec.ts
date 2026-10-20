import { expect, test } from "@playwright/test";
import { installJournalFixtures } from "./journal.fixture";

// Repeatable local-only captures for the mandatory home visual review.
for (const state of ["ordinary", "long", "error"] as const) {
  test(`capture task 3 ${state} home`, async ({ page }, testInfo) => {
    const message =
      state === "long"
        ? "Tu imaginación abre puertas imposibles.\n\n" +
          "Hay días en los que tu paciencia transforma el paisaje. ".repeat(
            18,
          ) +
          "\n\nIncluso cuando las palabras parecen no terminar: " +
          "imaginación".repeat(24)
        : "Tu imaginación abre puertas imposibles.";
    await installJournalFixtures(page, {
      qualityStatus: state === "error" ? 500 : 200,
      qualities: [{ week: 25, year: 2026, message }],
    });
    await page.goto("/?time=day");
    if (state === "error") {
      await expect(
        page.getByRole("heading", {
          name: "No se pudieron cargar los mensajes",
          exact: true,
        }),
      ).toBeVisible();
    } else {
      await expect(page.getByTestId("quality-message")).toHaveText(message);
    }
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `playwright-report/evidence/task-3-${state}-${testInfo.project.name}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.screenshot({
      path: `playwright-report/evidence/task-3-${state}-${testInfo.project.name}-viewport.png`,
      animations: "disabled",
    });
  });
}
