import { expect, test } from "@playwright/test";
import { installJournalFixtures } from "./journal.fixture";

test("message precedes navigation and starts in the first phone view", async ({
  page,
}) => {
  await installJournalFixtures(page);
  await page.goto("/");
  const message = page.getByTestId("quality-message");
  await expect(message).toHaveText("Tu imaginación abre puertas imposibles.");
  const m = await message.boundingBox();
  const previous = await page
    .getByRole("button", { name: "Semana anterior", exact: true })
    .boundingBox();
  expect(m).not.toBeNull();
  expect(previous).not.toBeNull();
  expect(m!.y).toBeLessThan(500);
  expect(previous!.y).toBeGreaterThanOrEqual(m!.y + m!.height);
  await expect(
    page.getByRole("link", { name: "Historia completa", exact: true }),
  ).toHaveAttribute("href", "/history");
  await expect(page.locator("a button, button a")).toHaveCount(0);
});

test("week context labels the selected year and week", async ({ page }) => {
  await installJournalFixtures(page);
  await page.goto("/");
  await expect(page.getByTestId("week-context")).toContainText(
    "Semana 25 / 2026",
  );
  await expect(
    page.getByRole("heading", { name: "Cualidades de Landa", exact: true }),
  ).toBeVisible();
});
