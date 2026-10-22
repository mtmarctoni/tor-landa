import { expect, type Page, test } from "@playwright/test";
import { loginThroughUi, parseCreate } from "./shoebox.fixture";
import {
  type ArchiveApi,
  apiError,
  batchHeading,
  listPage,
  memoryId,
  mockArchive,
  openArchive,
  scraps,
  syntheticMemory,
  syntheticSet,
  visibleIds,
} from "./shoebox-archive.fixture";

// Browsing one bounded batch at a time. Login is real; the Memories API is a
// routed synthetic store (see shoebox-archive.fixture.ts).

const older = (page: Page) =>
  page.getByRole("button", { name: "Recuerdos anteriores" });
const newer = (page: Page) =>
  page.getByRole("button", { name: "Recuerdos más recientes" });
const restart = (page: Page) =>
  page.getByRole("button", { name: "Volver al principio" });

test.describe("batch states", () => {
  test("an empty box shows the illustrated empty state and one add action", async ({
    page,
  }) => {
    await openArchive(page, []);
    await expect(
      page.getByText("Todavía no hay nada en la caja"),
    ).toBeVisible();
    await expect(scraps(page)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Meter algo en la caja" }),
    ).toHaveCount(1);
  });

  test("loading shows a bounded placeholder and a text status, then the batch", async ({
    page,
  }) => {
    const api = await openArchiveHeld(page, syntheticSet(3));
    await expect(
      page.getByRole("status").filter({ hasText: "Abriendo la caja" }),
    ).toBeVisible();
    const placeholders = page.locator("[data-shoebox-placeholder]");
    expect(await placeholders.count()).toBeGreaterThan(0);
    expect(await placeholders.count()).toBeLessThanOrEqual(3);
    await api.release();
    await expect(scraps(page)).toHaveCount(3);
    await expect(placeholders).toHaveCount(0);
  });

  test("a failed read retries in place", async ({ page }) => {
    const api = await openArchiveWith(page, syntheticSet(4), [
      apiError(503, "UNAVAILABLE"),
    ]);
    await expect(
      page.getByRole("alert").filter({ hasText: "No pudimos abrir" }),
    ).toBeVisible();
    await expect(scraps(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(scraps(page)).toHaveCount(4);
    expect(api.listCalls).toHaveLength(2);
  });
});

test.describe("one batch of twelve, in the same order on screen and in the DOM", () => {
  test("mounts at most 12 memories in API order and reading order", async ({
    page,
  }, testInfo) => {
    const records = syntheticSet(30);
    await openArchive(page, records);
    await expect(scraps(page)).toHaveCount(12);
    expect(await visibleIds(page)).toEqual(
      listPage(records, null).items.map((item) => item.id),
    );
    const boxes = await scraps(page).evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { top: box.top, left: box.left, bottom: box.bottom };
      }),
    );
    if (testInfo.project.name === "phone") {
      for (let i = 1; i < boxes.length; i += 1) {
        expect(boxes[i]?.top ?? 0).toBeGreaterThan(boxes[i - 1]?.top ?? 0);
      }
    } else {
      // Staggered columns still read row by row: every row starts below the
      // previous row's top and runs left to right.
      const columns = await page
        .locator(".shoebox-batch")
        .evaluate(
          (list) =>
            getComputedStyle(list).gridTemplateColumns.split(" ").length,
        );
      expect(columns).toBeGreaterThan(1);
      for (let i = 0; i < boxes.length; i += 1) {
        const box = boxes[i];
        const before = boxes[i - 1];
        if (!box || !before) continue;
        if (i % columns === 0) {
          expect(box.top).toBeGreaterThan(boxes[i - columns]?.top ?? -1);
        } else {
          expect(box.left).toBeGreaterThan(before.left);
        }
      }
    }
  });

  test("brief core: an older batch replaces the twelve and focuses the heading", async ({
    page,
  }) => {
    await openArchive(page, syntheticSet(40));
    await expect(page.locator("[data-memory-id]")).toHaveCount(12);
    await page.getByRole("button", { name: "Recuerdos anteriores" }).click();
    await expect(page.locator("[data-memory-id]")).toHaveCount(12);
    await expect(
      page.getByRole("heading", { name: "Los recuerdos de esta caja" }),
    ).toBeFocused();
  });

  test("more than 100 memories page by replacing the batch, with focus on its heading", async ({
    page,
  }) => {
    const records = syntheticSet(130);
    await openArchive(page, records);
    await expect(scraps(page)).toHaveCount(12);
    await expect(newer(page)).toBeDisabled();
    const seen = new Set(await visibleIds(page));
    for (let index = 1; index <= 10; index += 1) {
      await older(page).click();
      const expected = listPage(records, `o${index * 12}`).items.map(
        (item) => item.id,
      );
      await expect.poll(() => visibleIds(page)).toEqual(expected);
      await expect(batchHeading(page)).toBeFocused();
      for (const id of expected) seen.add(id);
    }
    await expect(scraps(page)).toHaveCount(10);
    await expect(older(page)).toBeDisabled();
    expect(seen.size).toBe(130);

    await newer(page).click();
    await expect
      .poll(() => visibleIds(page))
      .toEqual(listPage(records, "o108").items.map((item) => item.id));
    await expect(batchHeading(page)).toBeFocused();
    await restart(page).click();
    await expect
      .poll(() => visibleIds(page))
      .toEqual(listPage(records, null).items.map((item) => item.id));
    await expect(newer(page)).toBeDisabled();
  });

  test("a failed older load keeps the current batch", async ({ page }) => {
    const records = syntheticSet(30);
    const api = await openArchive(page, records);
    await expect(scraps(page)).toHaveCount(12);
    const before = await visibleIds(page);
    api.listReplies.push(apiError(503, "UNAVAILABLE"));
    await older(page).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "anteriores" }),
    ).toBeVisible();
    expect(await visibleIds(page)).toEqual(before);
    await expect(newer(page)).toBeDisabled();
    await older(page).click();
    await expect
      .poll(() => visibleIds(page))
      .toEqual(listPage(records, "o12").items.map((item) => item.id));
  });

  test("rapid refresh and older: the latest request wins", async ({ page }) => {
    const records = syntheticSet(60);
    const api = await openArchive(page, records);
    await expect(scraps(page)).toHaveCount(12);
    api.listReplies.push("hold", "hold");
    await older(page).click();
    await restart(page).click();
    await older(page).click();
    const expected = listPage(records, "o12").items.map((item) => item.id);
    await expect.poll(() => visibleIds(page)).toEqual(expected);
    // The stale requests answer late with other records; nothing changes.
    for (const route of api.held.splice(0)) {
      await route
        .fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(listPage(records, "o48")),
        })
        .catch(() => {});
    }
    await page.waitForTimeout(300);
    expect(await visibleIds(page)).toEqual(expected);
  });

  test("duplicate IDs in one response are shown once", async ({ page }) => {
    const records = syntheticSet(5);
    const doubled = {
      items: [...records, records[1], records[3]],
      nextCursor: null,
    };
    await openArchiveWith(page, records, [{ status: 200, json: doubled }]);
    await expect(scraps(page)).toHaveCount(5);
    expect(new Set(await visibleIds(page)).size).toBe(5);
  });
});

test.describe("saves, removals and corrections against the batch", () => {
  test("a backdated save returns to newest and offers Ver recuerdo through a detail GET", async ({
    page,
  }) => {
    const records = syntheticSet(20);
    const api = await openArchive(page, records);
    await routeCreate(page, api.records);
    await older(page).click();
    await expect(batchHeading(page)).toBeFocused();

    await addText(page, "recuerdo sintético con fecha antigua", "2001-02-03");
    await expect
      .poll(() => visibleIds(page))
      .toEqual(listPage(records, null).items.map((item) => item.id));
    const view = page.getByRole("button", { name: "Ver recuerdo" });
    await expect(view).toBeVisible();
    await view.click();
    const detail = page.getByRole("dialog", { name: "Un recuerdo de la caja" });
    await expect(detail).toBeVisible();
    await expect(detail).toContainText("recuerdo sintético con fecha antigua");
    await expect(detail).toContainText("3 de febrero de 2001");
    expect(api.detailCalls).toContain(memoryId(900));
  });

  test("a recent save appears in its date position, not pinned to the top", async ({
    page,
  }) => {
    const records = syntheticSet(8);
    const api = await openArchive(page, records);
    await routeCreate(page, api.records);
    const middle = listPage(records, null).items[3]?.memoryDate ?? "";
    await addText(page, "nota sintética del medio", middle);
    await expect(
      scraps(page).filter({ hasText: "nota sintética del medio" }),
    ).toHaveCount(1);
    const ids = await visibleIds(page);
    expect(ids.indexOf(memoryId(900))).toBe(
      listPage(api.records, null).items.findIndex(
        (item) => item.id === memoryId(900),
      ),
    );
    expect(ids.indexOf(memoryId(900))).toBeGreaterThan(0);
    await expect(
      page.getByRole("button", { name: "Ver recuerdo" }),
    ).toHaveCount(0);
  });

  test("removing the last item of a batch keeps the controls and does not auto-load", async ({
    page,
  }) => {
    const records = syntheticSet(13);
    const api = await openArchive(page, records);
    await older(page).click();
    await expect(scraps(page)).toHaveCount(1);
    const calls = api.listCalls.length;
    await scraps(page)
      .getByRole("button", { name: /Retirar de la caja/ })
      .click();
    const confirm = page.getByRole("dialog", {
      name: "¿Retirar este recuerdo?",
    });
    await confirm.getByRole("button", { name: "Sí, retirarlo" }).click();
    await expect(scraps(page)).toHaveCount(0);
    await expect(
      page.getByText("Esta tanda se ha quedado vacía"),
    ).toBeVisible();
    await expect(newer(page)).toBeEnabled();
    await expect(restart(page)).toBeEnabled();
    await expect(batchHeading(page)).toBeFocused();
    await page.waitForTimeout(500);
    expect(api.listCalls).toHaveLength(calls);
  });

  test("a correction that moves a record out of date order reloads the batch", async ({
    page,
  }) => {
    const records = Array.from({ length: 6 }, (_, i) => syntheticMemory(i + 1));
    const api = await openArchive(page, records);
    await expect(scraps(page)).toHaveCount(6);
    const last = listPage(records, null).items.at(-1);
    const calls = api.listCalls.length;
    const scrap = page.locator(`[data-memory-id="${last?.id}"]`);
    await scrap.getByRole("button", { name: /Corregir/ }).click();
    const form = page.getByRole("dialog", { name: "Corregir el recuerdo" });
    await form.getByLabel("Fecha").fill("2026-12-24");
    await form.getByRole("button", { name: "Guardar la corrección" }).click();
    await expect(form).toHaveCount(0);
    await expect.poll(() => api.listCalls.length).toBe(calls + 1);
    await expect.poll(async () => (await visibleIds(page))[0]).toBe(last?.id);
  });

  test("a detail 404 closes the stale photo and returns focus to the heading", async ({
    page,
  }) => {
    const photo = syntheticMemory(3, "photo");
    const records = [syntheticMemory(1), syntheticMemory(2), photo];
    const api = await openArchive(page, records);
    api.detailReply = (id) =>
      id === photo.id ? apiError(404, "NOT_FOUND") : undefined;
    await page
      .locator(`[data-memory-id="${photo.id}"]`)
      .getByRole("button", { name: /Ver la foto/ })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(`[data-memory-id="${photo.id}"]`)).toHaveCount(0);
    await expect(
      page.getByText("Ese recuerdo ya no está en la caja"),
    ).toBeVisible();
    await expect(batchHeading(page)).toBeFocused();
  });
});

test.describe("public entry", () => {
  test("the footer links to the box without private previews or counts", async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.goto("/");
    const footer = page.locator("footer");
    const link = footer.getByRole("link", { name: "Nuestra caja imposible" });
    await expect(link).toHaveAttribute("href", "/shoebox");
    await link.hover();
    await page.waitForTimeout(300);
    expect(requests.some((url) => url.includes("/api/shoebox"))).toBe(false);
    expect(await footer.innerText()).not.toMatch(/\d/);
    await expect(
      footer.getByRole("button", { name: "Abrir sorpresa" }),
    ).toBeVisible();
    await expect(
      footer.getByRole("button", { name: "Abrir un momento especial" }),
    ).toBeVisible();
    await link.click();
    await expect(page).toHaveURL("/shoebox/login");
  });
});

// --- helpers ---------------------------------------------------------------

async function openArchiveWith(
  page: Page,
  records: ReturnType<typeof syntheticSet>,
  replies: ArchiveApi["listReplies"],
) {
  const api = await mockArchive(page, records);
  api.listReplies.push(...replies);
  await loginThroughUi(page);
  await expect(page).toHaveURL("/shoebox");
  return api;
}

async function openArchiveHeld(
  page: Page,
  records: ReturnType<typeof syntheticSet>,
) {
  const api = await openArchiveWith(page, records, ["hold"]);
  await expect.poll(() => api.held.length).toBe(1);
  return {
    ...api,
    async release() {
      const route = api.held.shift();
      await route?.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(listPage(records, null)),
      });
    },
  };
}

/** POST create returns record 900 with the posted fields and stores it. */
async function routeCreate(page: Page, store: ReturnType<typeof syntheticSet>) {
  await page.route("**/api/shoebox/memories", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.fallback();
    const post = parseCreate(
      request.postDataBuffer() ?? Buffer.alloc(0),
      request.headers()["content-type"] ?? "",
    );
    const memory = syntheticMemory(900, "text", {
      text: String(post.metadata.text),
      caption: String(post.metadata.caption),
      memoryDate: String(post.metadata.memoryDate),
      createdAt: "2026-10-21T11:59:00.000Z",
    });
    store.push(memory);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ memory, replayed: false }),
    });
  });
}

async function addText(page: Page, text: string, date: string) {
  await page.getByRole("button", { name: "Meter algo en la caja" }).click();
  const composer = page.getByRole("dialog", {
    name: "Algo nuevo para la caja",
  });
  await composer.getByRole("radio", { name: "Texto" }).check();
  await composer.getByLabel("Lo que pasó").fill(text);
  await composer.getByLabel("Fecha").fill(date);
  await composer.getByRole("button", { name: "Guardar en la caja" }).click();
  await expect(composer).toHaveCount(0);
}
