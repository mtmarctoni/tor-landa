import { expect, test } from "@playwright/test";
import { loginThroughUi } from "./shoebox.fixture";
import { mockArchive, syntheticMemory } from "./shoebox-archive.fixture";

test("real session, synthetic archive, native dialogs and upload fallback work across engines", async ({
  page,
}) => {
  await mockArchive(page, [syntheticMemory(1)]);
  await loginThroughUi(page);
  await expect(page).toHaveURL("/shoebox");
  await expect(page.getByText("nota sintética número 1")).toBeVisible();
  // Safari does not focus buttons on a pointer click. Exercise keyboard
  // ownership explicitly when asserting native dialog focus restoration.
  const add = page.getByRole("button", { name: "Meter algo en la caja" });
  await add.focus();
  await add.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Algo nuevo para la caja" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: "Texto", exact: true }).check();
  await expect(dialog.getByLabel("Lo que pasó")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Meter algo en la caja" }),
  ).toBeFocused();
  const support = await page.evaluate(() => ({
    recorder: typeof MediaRecorder !== "undefined",
    mp4:
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported("audio/mp4"),
    webm:
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported("audio/webm;codecs=opus"),
    ogg:
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported("audio/ogg;codecs=opus"),
  }));
  await test.info().attach("codec-probes-not-device-certification", {
    body: JSON.stringify(support),
    contentType: "application/json",
  });
  console.info("Shoebox codec probes", test.info().project.name, support);
  let creates = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/shoebox/memories"
    )
      creates++;
  });
  await page.getByRole("button", { name: "Meter algo en la caja" }).click();
  await dialog.getByRole("radio", { name: "Audio", exact: true }).check();
  await dialog
    .getByLabel("Subir un audio")
    .setInputFiles("tests/fixtures/shoebox/audio-wav-pcm16-1s.wav");
  const preview = dialog.locator("audio");
  await expect(preview).toBeVisible();
  expect(
    await preview.evaluate(
      (audio: HTMLAudioElement) => audio.paused && !audio.autoplay,
    ),
  ).toBe(true);
  expect(creates).toBe(0);
});
