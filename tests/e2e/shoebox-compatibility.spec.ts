import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { stripTypeScriptTypes } from "node:module";
import { expect, test } from "@playwright/test";
import { loginThroughUi } from "./shoebox.fixture";
import { mockArchive, syntheticMemory } from "./shoebox-archive.fixture";

for (const kind of ["text", "photo", "audio"] as const) {
  test(`${kind} saves retain the same-origin header under the page's no-referrer policy`, async ({
    page,
  }) => {
    // Execute the actual client module with only its TypeScript types erased.
    // Use a real HTTP boundary: intercepted requests can hide engine-generated
    // security headers. Persistence and the document are synthetic, not Notion.
    const client = stripTypeScriptTypes(
      readFileSync("src/features/shoebox/client/api.ts", "utf8"),
    );
    const origins: (string | undefined)[] = [];
    const server = createServer((request, response) => {
      if (request.url === "/client.js") {
        response.writeHead(200, { "Content-Type": "text/javascript" });
        response.end(client);
      } else if (request.url === "/api/shoebox/memories") {
        origins.push(request.headers.origin);
        request.resume();
        response.writeHead(201, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({ memory: syntheticMemory(1, kind), replayed: false }),
        );
      } else {
        response.writeHead(200, {
          "Content-Type": "text/html",
          "Referrer-Policy": "no-referrer",
        });
        response.end(
          "<!doctype html><title>Synthetic shoebox origin regression</title>",
        );
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test server address");
    const origin = `http://127.0.0.1:${address.port}`;
    try {
      await page.goto(origin);
      const result = await page.evaluate(async (kind) => {
        // The runtime URL is deliberately not a TypeScript source dependency.
        const modulePath = "/client.js";
        const { saveMemory } = await import(modulePath);
        return saveMemory({
          requestId: crypto.randomUUID(),
          fields: {
            kind,
            caption: "",
            memoryDate: "2026-10-22",
            ...(kind === "text" ? { text: "synthetic note" } : {}),
          },
          ...(kind !== "text"
            ? { file: new File(["synthetic bytes"], "fixture.bin") }
            : {}),
        });
      }, kind);
      expect(result.kind).toBe("saved");
      expect(origins).toEqual([origin]);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
}

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
