import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import sharp from "sharp";
import {
  type CapturedCreate,
  openComposer,
  parseCreate,
} from "./shoebox.fixture";

// Real browser decoding of synthetic images (no personal photos). Chromium
// only: Safari/iPhone HEIC and orientation behavior is a Task 10 device gate.

const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Algo nuevo para la caja" });
const photoInput = (page: Page) => dialog(page).getByLabel("Elegir una foto");
const preview = (page: Page) =>
  dialog(page).getByRole("img", { name: "Vista previa de la foto" });

async function jpeg(width: number, height: number, orientation?: number) {
  let image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 230, g: 120, b: 100 },
    },
  }).jpeg({ quality: 80 });
  if (orientation) image = image.withMetadata({ orientation });
  return image.toBuffer();
}

async function choose(
  page: Page,
  name: string,
  mimeType: string,
  buffer: Buffer,
) {
  await photoInput(page).setInputFiles({ name, mimeType, buffer });
}

async function naturalSize(page: Page) {
  await expect(preview(page)).toBeVisible({ timeout: 20_000 });
  return preview(page).evaluate((img: HTMLImageElement) =>
    img
      .decode()
      .then(() => ({ width: img.naturalWidth, height: img.naturalHeight })),
  );
}

test.beforeEach(async ({ page }) => {
  await openComposer(page);
  await dialog(page).getByRole("radio", { name: "Foto" }).check();
});

test("EXIF orientation is applied before the local preview", async ({
  page,
}) => {
  // Stored landscape 60x30 with orientation 6 (rotate 90°) displays portrait.
  await choose(page, "girada.jpg", "image/jpeg", await jpeg(60, 30, 6));
  expect(await naturalSize(page)).toEqual({ width: 30, height: 60 });
  await expect(dialog(page).getByText("30 × 60")).toBeVisible();
});

test("a large photo is downsampled to a 2,048 long edge and sent as JPEG only on Save", async ({
  page,
}) => {
  const posts: CapturedCreate[] = [];
  await page.route("**/api/shoebox/memories", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    posts.push(
      parseCreate(
        route.request().postDataBuffer() ?? Buffer.alloc(0),
        route.request().headers()["content-type"] ?? "",
      ),
    );
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "UNAVAILABLE", message: "x", diagnosticId: "d" },
      }),
    });
  });
  await choose(page, "grande.jpg", "image/jpeg", await jpeg(4_000, 3_000));
  expect(await naturalSize(page)).toEqual({ width: 2_048, height: 1_536 });
  expect(posts).toHaveLength(0);
  await dialog(page)
    .getByRole("button", { name: "Guardar en la caja" })
    .click();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]?.metadata.kind).toBe("photo");
  expect(posts[0]?.file?.type).toBe("image/jpeg");
  expect(posts[0]?.file?.size).toBeLessThanOrEqual(4_000_000);
});

test("a transparent PNG previews flattened", async ({ page }) => {
  await choose(
    page,
    "transparente.png",
    "image/png",
    readFileSync("tests/fixtures/shoebox/photo-transparent.png"),
  );
  const size = await naturalSize(page);
  expect(size.width).toBeGreaterThan(0);
});

test("a header claiming excessive pixels is refused before decoding and keeps the rest of the draft", async ({
  page,
}) => {
  await dialog(page).getByLabel("Pie (opcional)").fill("pie sintético");
  await choose(
    page,
    "enorme.jpg",
    "image/jpeg",
    // SOF0 claims 60000x60000: over the 40,000,000-pixel browser ceiling.
    readFileSync("tests/fixtures/shoebox/photo-dimension-bomb.jpg"),
  );
  await expect(
    dialog(page).getByText(/demasiado grande para prepararla/),
  ).toBeVisible();
  await expect(preview(page)).toHaveCount(0);
  await expect(dialog(page).getByLabel("Pie (opcional)")).toHaveValue(
    "pie sintético",
  );
  await expect(
    dialog(page).getByRole("button", { name: "Guardar en la caja" }),
  ).toBeDisabled();
});

test("an undecodable HEIC asks for a JPEG export instead of uploading the original", async ({
  page,
}) => {
  // ftyp heic header followed by junk: Chromium cannot decode HEIC.
  const heic = Buffer.concat([
    Buffer.from([0, 0, 0, 0x18]),
    Buffer.from("ftypheic\0\0\0\0mif1heic", "latin1"),
    Buffer.alloc(512, 7),
  ]);
  await choose(page, "foto.heic", "image/heic", heic);
  await expect(dialog(page).getByText(/exportarla como JPEG/)).toBeVisible({
    timeout: 20_000,
  });
  await expect(preview(page)).toHaveCount(0);
  await expect(
    dialog(page).getByRole("button", { name: "Guardar en la caja" }),
  ).toBeDisabled();
});

test("choosing a new photo releases the old preview URL", async ({ page }) => {
  await choose(page, "una.jpg", "image/jpeg", await jpeg(40, 40));
  await naturalSize(page);
  const firstUrl = await preview(page).getAttribute("src");
  expect(firstUrl).toMatch(/^blob:/);
  await choose(page, "otra.jpg", "image/jpeg", await jpeg(50, 20));
  expect(await naturalSize(page)).toEqual({ width: 50, height: 20 });
  const readable = (url: string | null) =>
    page.evaluate(
      (target) =>
        fetch(target ?? "").then(
          () => true,
          () => false,
        ),
      url,
    );
  expect(await readable(firstUrl)).toBe(false);

  const secondUrl = await preview(page).getAttribute("src");
  await dialog(page).getByRole("button", { name: "Quitar la foto" }).click();
  await expect(preview(page)).toHaveCount(0);
  expect(await readable(secondUrl)).toBe(false);
});
