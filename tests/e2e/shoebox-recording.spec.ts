import { expect, type Page, test } from "@playwright/test";
import {
  type CapturedCreate,
  instrumentMicrophone,
  mic,
  openComposer,
  parseCreate,
} from "./shoebox.fixture";

// Chromium's fake microphone proves the browser wiring and lifecycle only. It
// is not evidence that real phones record in a compatible format (Task 10).
test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
  permissions: ["microphone"],
});

const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Algo nuevo para la caja" });

async function captureCreates(page: Page) {
  const posts: CapturedCreate[] = [];
  await page.route("**/api/shoebox/memories", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const post = parseCreate(
      route.request().postDataBuffer() ?? Buffer.alloc(0),
      route.request().headers()["content-type"] ?? "",
    );
    posts.push(post);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        memory: {
          id: "0f0f0f0f-0000-4000-8000-0000000000ab",
          kind: "audio",
          caption: "",
          memoryDate: post.metadata.memoryDate,
          createdAt: "2026-10-21T10:00:00.000Z",
          mediaPath:
            "/api/shoebox/memories/0f0f0f0f-0000-4000-8000-0000000000ab/media",
          durationSeconds: 1,
          mimeType: "audio/webm",
        },
        replayed: false,
      }),
    });
  });
  return posts;
}

test("no microphone access until Grabar; stop releases every track and previews locally", async ({
  page,
}) => {
  await instrumentMicrophone(page);
  const posts = await captureCreates(page);
  await openComposer(page);
  await dialog(page).getByRole("radio", { name: "Audio" }).check();
  await page.waitForTimeout(300);
  expect((await mic(page)).calls).toBe(0);

  await dialog(page).getByRole("button", { name: "Grabar" }).click();
  await expect(dialog(page).getByText("Grabando")).toBeVisible();
  await expect(dialog(page).getByRole("timer")).toContainText(/0:0\d/);
  expect(await mic(page)).toMatchObject({
    calls: 1,
    kinds: ["audio"],
    live: 1,
  });
  await page.waitForTimeout(1_500);
  await dialog(page).getByRole("button", { name: "Parar" }).click();

  const preview = dialog(page).getByLabel("Escuchar la grabación");
  await expect(preview).toBeVisible({ timeout: 15_000 });
  expect((await mic(page)).live).toBe(0);
  expect(
    await preview.evaluate((el: HTMLAudioElement) => el.autoplay || !el.paused),
  ).toBe(false);
  expect(posts).toHaveLength(0);

  await dialog(page)
    .getByRole("button", { name: "Guardar en la caja" })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  expect(posts).toHaveLength(1);
  expect(posts[0]?.metadata.kind).toBe("audio");
  expect(posts[0]?.file?.type).toMatch(/^audio\/(webm|mp4|ogg)/);
  expect(posts[0]?.file?.size).toBeGreaterThan(0);
  expect((await mic(page)).calls).toBe(1);
});

test("a hidden tab stops recording at once, keeps the clip for review and never resumes", async ({
  page,
}) => {
  await instrumentMicrophone(page);
  await openComposer(page);
  await dialog(page).getByRole("radio", { name: "Audio" }).check();
  await dialog(page).getByRole("button", { name: "Grabar" }).click();
  await expect(dialog(page).getByText("Grabando")).toBeVisible();
  await page.waitForTimeout(1_200);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => (await mic(page)).live).toBe(0);
  // Task 9: a hidden tab also closes the private gate, so the clip is
  // reviewed after the tab returns and the session is confirmed again.
  await expect(dialog(page)).toBeHidden();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(dialog(page).getByText(/se interrumpió/)).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(500);
  expect((await mic(page)).calls).toBe(1);
  await expect(dialog(page).getByText("Grabando")).toHaveCount(0);
});

test("discarding the draft while recording stops the microphone", async ({
  page,
}) => {
  await instrumentMicrophone(page);
  await openComposer(page);
  await dialog(page).getByRole("radio", { name: "Audio" }).check();
  await dialog(page).getByRole("button", { name: "Grabar" }).click();
  await expect(dialog(page).getByText("Grabando")).toBeVisible();
  await dialog(page).getByRole("button", { name: "Cerrar" }).click();
  await dialog(page).getByRole("button", { name: "Tirar el borrador" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect.poll(async () => (await mic(page)).live).toBe(0);
});

test("a re-recording asks before replacing the preview", async ({ page }) => {
  await instrumentMicrophone(page);
  await openComposer(page);
  await dialog(page).getByRole("radio", { name: "Audio" }).check();
  await dialog(page).getByRole("button", { name: "Grabar" }).click();
  await page.waitForTimeout(800);
  await dialog(page).getByRole("button", { name: "Parar" }).click();
  await expect(dialog(page).getByLabel("Escuchar la grabación")).toBeVisible({
    timeout: 15_000,
  });
  const firstUrl = await dialog(page)
    .getByLabel("Escuchar la grabación")
    .getAttribute("src");
  await dialog(page).getByRole("button", { name: "Grabar otra vez" }).click();
  await expect(
    dialog(page).getByText("¿Sustituir esta grabación?"),
  ).toBeVisible();
  expect((await mic(page)).calls).toBe(1);
  await dialog(page).getByRole("button", { name: "Sí, grabar otra" }).click();
  await expect(dialog(page).getByText("Grabando")).toBeVisible();
  expect((await mic(page)).calls).toBe(2);
  // The old preview's object URL is released.
  const stillReadable = await page.evaluate(
    (url) =>
      fetch(url ?? "").then(
        () => true,
        () => false,
      ),
    firstUrl,
  );
  expect(stillReadable).toBe(false);
});

test("a denied microphone explains itself and offers upload or text instead", async ({
  page,
}) => {
  await instrumentMicrophone(page, { deny: true });
  await openComposer(page);
  await dialog(page).getByRole("radio", { name: "Audio" }).check();
  await dialog(page).getByRole("button", { name: "Grabar" }).click();
  await expect(
    dialog(page).getByText(/permiso para usar el micrófono/),
  ).toBeVisible();
  await expect(dialog(page).getByLabel("Subir un audio")).toBeEnabled();
  await expect(
    dialog(page).getByRole("button", { name: "Guardar en la caja" }),
  ).toBeDisabled();
});
