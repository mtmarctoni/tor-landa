import { expect, type Page, test } from "@playwright/test";
import {
  apiError,
  batchHeading,
  mockArchive,
  openArchive,
  scraps,
  syntheticMemory,
  syntheticSet,
  visibleIds,
} from "./shoebox-archive.fixture";

const correction = (page: Page) =>
  page.getByRole("dialog", { name: "Corregir el recuerdo" });
const removal = (page: Page) =>
  page.getByRole("dialog", { name: "¿Retirar este recuerdo?" });
const correctFirst = (page: Page) =>
  scraps(page)
    .first()
    .getByRole("button", { name: /Corregir/ })
    .click();
const save = (page: Page) =>
  correction(page)
    .getByRole("button", { name: "Guardar la corrección" })
    .click();

test("correction keyboard focus stays modal, Escape restores its stationary trigger", async ({
  page,
}) => {
  await openArchive(page, [syntheticMemory(1)]);
  const trigger = scraps(page).getByRole("button", { name: /Corregir/ });
  await trigger.click();
  await expect(
    correction(page).getByRole("button", { name: "Cerrar" }),
  ).toBeFocused();
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    // Native Tab may visit browser chrome (reported as BODY), never an
    // interactive background element. Do not replace native focus ownership.
    expect(
      await page.evaluate(
        () =>
          document.activeElement === document.body ||
          !!document.activeElement?.closest("dialog[open]"),
      ),
    ).toBe(true);
  }
  await correction(page).getByRole("button", { name: "Cerrar" }).focus();
  await page
    .getByRole("button", { name: "No tocar" })
    .evaluate((node: HTMLButtonElement) => node.focus());
  expect(
    await page.evaluate(
      () => !!document.activeElement?.closest("dialog[open]"),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(correction(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

for (const status of [400, 503]) {
  test(`correction ${status} retains the draft and original record for explicit retry`, async ({
    page,
  }) => {
    const api = await openArchive(page, [syntheticMemory(1)]);
    api.patchReply = () =>
      apiError(status, status === 400 ? "INVALID_INPUT" : "UNAVAILABLE");
    await correctFirst(page);
    await correction(page)
      .getByLabel("Lo que pasó")
      .fill("corrección sintética pendiente");
    await save(page);
    await expect(correction(page).getByRole("status")).not.toHaveText(
      "Guardando la corrección…",
    );
    await expect(correction(page).getByLabel("Lo que pasó")).toHaveValue(
      "corrección sintética pendiente",
    );
    await expect(scraps(page)).toContainText("nota sintética número 1");
    api.patchReply = undefined;
    await save(page);
    await expect(correction(page)).toHaveCount(0);
    await expect(scraps(page)).toContainText("corrección sintética pendiente");
    expect(api.patches).toHaveLength(2);
  });
}

test("correction 404 removes only the missing record and focuses the batch heading", async ({
  page,
}) => {
  const api = await openArchive(page, syntheticSet(2));
  api.patchReply = () => apiError(404, "NOT_FOUND");
  await correctFirst(page);
  await save(page);
  await expect(correction(page)).toHaveCount(0);
  await expect(scraps(page)).toHaveCount(1);
  await expect(scraps(page)).toContainText("nota sintética número 2");
  await expect(batchHeading(page)).toBeFocused();
});

test("correction 401 clears private content and leaves through the session guard", async ({
  page,
}) => {
  const api = await openArchive(page, [syntheticMemory(1)]);
  await correctFirst(page);
  await page.context().clearCookies();
  api.patchReply = () => apiError(401, "UNAUTHORIZED");
  await save(page);
  await expect(page).toHaveURL("/shoebox/login");
  await expect(page.getByText("nota sintética número 1")).toHaveCount(0);
});

test("removal initially focuses Cancel, cancel preserves, failure preserves, success focuses adjacent action", async ({
  page,
}) => {
  const api = await openArchive(page, syntheticSet(3));
  const trigger = scraps(page)
    .first()
    .getByRole("button", { name: /Retirar de la caja/ });
  await trigger.click();
  await expect(
    removal(page).getByRole("button", { name: "Cancelar" }),
  ).toBeFocused();
  await expect(removal(page)).toContainText("nota sintética número 1");
  await removal(page).getByRole("button", { name: "Cancelar" }).click();
  await expect(trigger).toBeFocused();
  expect(api.deletes).toHaveLength(0);
  await trigger.click();
  api.deleteReply = () => apiError(503, "UNAVAILABLE");
  await removal(page).getByRole("button", { name: "Sí, retirarlo" }).click();
  await expect(removal(page)).toContainText("El recuerdo sigue en la caja");
  await expect(scraps(page)).toHaveCount(3);
  api.deleteReply = undefined;
  await removal(page).getByRole("button", { name: "Sí, retirarlo" }).click();
  await expect(scraps(page)).toHaveCount(2);
  await expect(
    scraps(page)
      .first()
      .getByRole("button", { name: /Corregir/ }),
  ).toBeFocused();
});

test("a boundary date correction reloads even when its batch remains locally sorted", async ({
  page,
}) => {
  const records = syntheticSet(13);
  const api = await openArchive(page, records);
  await page.getByRole("button", { name: "Recuerdos anteriores" }).click();
  await expect(scraps(page)).toHaveCount(1);
  const calls = api.listCalls.length;
  await correctFirst(page);
  await correction(page).getByLabel("Fecha").fill("2026-12-24");
  await save(page);
  await expect.poll(() => api.listCalls.length).toBe(calls + 1);
  await expect(scraps(page)).toHaveCount(1);
  expect(await visibleIds(page)).toEqual([records[11]?.id]);
  await expect(batchHeading(page)).toBeFocused();
});

test("two clients see last confirmed correction and removal after refresh", async ({
  page,
  context,
}) => {
  const records = [syntheticMemory(1), syntheticMemory(2)];
  const api = await openArchive(page, records, { shared: true });
  const other = await context.newPage();
  await mockArchive(other, records, { shared: true });
  await other.goto("/shoebox");
  await expect(scraps(other)).toHaveCount(2);
  await correctFirst(page);
  await correctFirst(other);
  await correction(page)
    .getByLabel("Lo que pasó")
    .fill("primera escritura sintética");
  await save(page);
  await correction(other)
    .getByLabel("Lo que pasó")
    .fill("última escritura sintética");
  await save(other);
  await page.getByRole("button", { name: "Volver al principio" }).click();
  await expect(scraps(page).first()).toContainText(
    "última escritura sintética",
  );
  expect(api.records[0]?.text).toBe("última escritura sintética");
  await scraps(other)
    .first()
    .getByRole("button", { name: /Retirar/ })
    .click();
  await removal(other).getByRole("button", { name: "Sí, retirarlo" }).click();
  await page.getByRole("button", { name: "Volver al principio" }).click();
  await expect(scraps(page)).toHaveCount(1);
  await expect(scraps(page)).toContainText("nota sintética número 2");
  await other.close();
});
