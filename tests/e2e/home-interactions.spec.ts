import { expect, test } from "@playwright/test";
import { installJournalFixtures } from "./journal.fixture";

const currentMessage = "Tu imaginación abre puertas imposibles.";
const savedMessage = /Tu paciencia|Tu imaginación|Tu alegría|Un recuerdo/;

test("restored week survives navigation and reload", async ({ page }) => {
  await installJournalFixtures(page, { storedWeek: { week: 24, year: 2026 } });
  await page.goto("/");
  await expect(page.getByTestId("week-context")).toContainText(
    "Semana 24 / 2026",
  );
  await expect(page.getByTestId("quality-message")).toHaveText(
    "Tu paciencia transforma los días.",
  );
  await expect(
    page.getByRole("button", { name: "Volver al presente", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Semana siguiente", exact: true })
    .click();
  await expect(page.getByTestId("quality-message")).toHaveText(currentMessage);
  await page.reload();
  await expect(page.getByTestId("week-context")).toContainText(
    "Semana 25 / 2026",
  );
  await expect(page.getByTestId("quality-message")).toHaveText(currentMessage);
  await expect(
    page.getByRole("button", { name: "Volver al presente", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Semana anterior", exact: true })
    .click();
  await expect(page.getByTestId("week-context")).toContainText(
    "Semana 24 / 2026",
  );
  await page.reload();
  await expect(page.getByTestId("week-context")).toContainText(
    "Semana 24 / 2026",
  );
  await expect(page.getByTestId("quality-message")).toHaveText(
    "Tu paciencia transforma los días.",
  );
  await page
    .getByRole("button", { name: "Volver al presente", exact: true })
    .click();
  await expect(page.getByTestId("week-context")).toContainText(
    "Semana 25 / 2026",
  );
  await expect(page.getByTestId("quality-message")).toHaveText(currentMessage);
});

test("random and recent shortcuts select saved messages", async ({ page }) => {
  await installJournalFixtures(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Semana aleatoria", exact: true })
    .click();
  await expect(page.getByTestId("quality-message")).toHaveText(savedMessage);
  const details = page
    .locator("details")
    .filter({ has: page.getByText("Detalles de la semana", { exact: true }) });
  await expect(details).not.toHaveAttribute("open");
  await expect(
    page.getByRole("button", { name: "Recargar datos", exact: true }),
  ).toBeHidden();
  await page.getByText("Detalles de la semana", { exact: true }).click();
  await page
    .getByRole("button", { name: "Semana 24 del 2026", exact: true })
    .click();
  await expect(page.getByTestId("week-context")).toContainText(
    "Semana 24 / 2026",
  );
  await expect(page.getByTestId("quality-message")).toHaveText(
    "Tu paciencia transforma los días.",
  );
  await expect(details).toContainText("Semana 24 de 2026");
});

test("memory is stationary and revealed by activation", async ({ page }) => {
  await installJournalFixtures(page);
  await page.goto("/");
  const summary = page.getByText("Un recuerdo al azar", { exact: true });
  await expect(summary).toBeVisible();
  await expect(page.getByTestId("memory-message")).toBeHidden();
  await summary.hover();
  await expect(page.getByTestId("memory-message")).toBeHidden();
  await summary.click();
  const memory = page.getByTestId("memory-message");
  await expect(memory).toHaveText(savedMessage);
  const original = await memory.textContent();
  const position = await summary.evaluate(
    (element) =>
      getComputedStyle(element.parentElement as HTMLElement).position,
  );
  expect(["static", "relative"]).toContain(position);
  await page.clock.fastForward(30_000);
  await expect(memory).toBeVisible();
  await expect(memory).toHaveText(original ?? "");
  await summary.click();
  await expect(memory).toBeHidden();
});

for (const failure of [false, true]) {
  test(`copy reports ${failure ? "failure" : "success"}`, async ({ page }) => {
    await installJournalFixtures(page);
    await page.addInitScript((reject) => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (text: string) => {
            sessionStorage.setItem("copied-message", text);
            if (reject) throw new Error("Clipboard unavailable");
          },
        },
      });
    }, failure);
    await page.goto("/");
    await expect(page.getByTestId("quality-message")).toHaveText(
      currentMessage,
    );
    const status = page.getByRole("status", {
      name: "Estado de copia",
      exact: true,
    });
    await expect(status).toBeAttached();
    const before = await status.boundingBox();
    await page
      .getByRole("button", { name: "Copiar mensaje", exact: true })
      .click();
    expect(
      await page.evaluate(() => sessionStorage.getItem("copied-message")),
    ).toBe(`Semana 25 / 2026\n\n${currentMessage}`);
    await expect(status).toHaveText(
      failure
        ? "No se pudo copiar el mensaje. Inténtalo otra vez."
        : "Mensaje copiado al portapapeles.",
    );
    const after = await status.boundingBox();
    if (!before || !after)
      throw new Error("Copy feedback must reserve visible space");
    expect(after.height).toBe(before.height);
    await page.clock.fastForward(2_300);
    await expect(status).toBeEmpty();
    const cleared = await status.boundingBox();
    if (!cleared) throw new Error("Cleared feedback must still reserve space");
    expect(cleared.height).toBe(before.height);
  });
}

test("empty current week has a waiting state and no executable utilities", async ({
  page,
}) => {
  await installJournalFixtures(page, { qualities: [] });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Todavía no hay mensaje", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Semana aleatoria", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Copiar mensaje", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Un recuerdo al azar", { exact: true }),
  ).toHaveCount(0);
});

test("empty past week has a distinct missing state", async ({ page }) => {
  await installJournalFixtures(page, {
    qualities: [],
    storedWeek: { week: 23, year: 2026 },
  });
  await page.goto("/");
  await expect(page.getByTestId("week-context")).toContainText(
    "Semana 23 / 2026",
  );
  await expect(
    page.getByRole("heading", { name: "Semana sin mensaje", exact: true }),
  ).toBeVisible();
});

test("loading occupies the reading slot", async ({ page }) => {
  await installJournalFixtures(page);
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/quality", async (route) => {
    await held;
    await route.fulfill({
      json: { qualities: [{ week: 25, year: 2026, message: currentMessage }] },
    });
  });
  await page.goto("/");
  const loading = page.getByRole("heading", {
    name: "Cargando el mensaje…",
    exact: true,
  });
  await expect(loading).toBeVisible();
  await expect(page.getByTestId("quality-message")).toHaveCount(0);
  await expect
    .poll(async () => {
      const loadingBox = await loading.boundingBox();
      const navigationBox = await page
        .getByRole("button", { name: "Semana anterior", exact: true })
        .boundingBox();
      return Boolean(
        loadingBox && navigationBox && loadingBox.y < navigationBox.y,
      );
    })
    .toBe(true);
  release();
  await expect(page.getByTestId("quality-message")).toHaveText(currentMessage);
  await expect(loading).toHaveCount(0);
});

test("retry recovers without stale content", async ({ page }) => {
  await installJournalFixtures(page, {
    qualityStatus: 500,
    storedWeek: { week: 24, year: 2026 },
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "No se pudieron cargar los mensajes",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("quality-message")).toHaveCount(0);
  await page.route("**/api/quality", (route) =>
    route.fulfill({
      json: {
        qualities: [
          {
            week: 24,
            year: 2026,
            message: "Tu paciencia transforma los días.",
          },
        ],
      },
    }),
  );
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(page.getByTestId("quality-message")).toHaveText(
    "Tu paciencia transforma los días.",
  );
  await expect(
    page.getByRole("button", { name: "Reintentar", exact: true }),
  ).toHaveCount(0);
});

test("reload refreshes the selected message without showing stale content", async ({
  page,
}) => {
  await installJournalFixtures(page);
  await page.goto("/");
  await expect(page.getByTestId("quality-message")).toHaveText(currentMessage);
  await page.getByText("Detalles de la semana", { exact: true }).click();
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/quality", async (route) => {
    await held;
    await route.fulfill({
      json: {
        qualities: [{ week: 25, year: 2026, message: "Un mensaje renovado." }],
      },
    });
  });
  await page
    .getByRole("button", { name: "Recargar datos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cargando el mensaje…", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("quality-message")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Copiar mensaje", exact: true }),
  ).toBeDisabled();
  release();
  await expect(page.getByTestId("quality-message")).toHaveText(
    "Un mensaje renovado.",
  );
  await expect(page.getByTestId("week-context")).toContainText(
    "Semana 25 / 2026",
  );
});
