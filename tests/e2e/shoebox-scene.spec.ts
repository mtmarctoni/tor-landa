import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { loginThroughUi } from "./shoebox.fixture";
import {
  apiError,
  mockArchive,
  openArchive,
  scraps,
  syntheticMemory,
} from "./shoebox-archive.fixture";

// The surreal scene: stable geometry, bounded mischief, a full ambient pause
// (inherited scenery included), reduced motion, and graceful media failure.
// Login is real; records are synthetic.

const LONG_NOTE = "x".repeat(2_000);
const LONG_CAPTION = "pie-sin-espacios-".repeat(29).slice(0, 500);

function sceneRecords() {
  return [
    syntheticMemory(1, "text", { text: LONG_NOTE, caption: LONG_CAPTION }),
    syntheticMemory(2, "photo", { caption: "foto sintética apaisada" }),
    syntheticMemory(3, "audio", { caption: "frasco sintético uno" }),
    syntheticMemory(4, "text", {
      text: "Una nota sintética corta.\nCon un salto de línea.",
    }),
    syntheticMemory(5, "audio", { caption: "frasco sintético dos" }),
    syntheticMemory(6, "photo", { width: 800, height: 1200, caption: "" }),
  ];
}

/** Boxes of every control and real content surface on the route. */
function targetBoxes(page: Page) {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll(
        ".shoebox-world :is(button, a, audio, .scrap-body, .scrap-text)",
      ),
    ].map((node) => {
      const box = node.getBoundingClientRect();
      return [box.x, box.y, box.width, box.height].map((v) => Math.round(v));
    }),
  );
}

/** CSS and Web animations still running outside native dialogs. */
function runningAnimations(page: Page) {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return (
          animation.playState === "running" &&
          !(target instanceof Element && target.closest("dialog"))
        );
      })
      .map((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return target instanceof Element
          ? `${target.tagName}.${target.getAttribute("class") ?? ""}`
          : "?";
      }),
  );
}

const moonTransform = (page: Page) =>
  page
    .locator(".shoebox-moon")
    .evaluate((node) => getComputedStyle(node).transform);

const noTocar = (page: Page) => page.getByRole("button", { name: "No tocar" });

test.describe("layout and targets", () => {
  for (const size of [
    { width: 320, height: 720 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
    { width: 844, height: 390 },
  ]) {
    test(`${size.width}×${size.height}: no overflow, no clipping, 44px targets, nothing occluded`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await openArchive(page, sceneRecords());
      await expect(scraps(page)).toHaveCount(6);
      await page.evaluate(() => document.fonts.ready);
      const report = await page.evaluate(() => {
        const problems: string[] = [];
        const root = document.documentElement;
        if (root.scrollWidth > window.innerWidth) {
          problems.push(`overflow ${root.scrollWidth} > ${window.innerWidth}`);
        }
        for (const node of document.querySelectorAll<HTMLElement>(
          ".shoebox-world :is(.scrap-text, .scrap-caption, h1, h2, button, .shoebox-bubble)",
        )) {
          if (node.scrollWidth > node.clientWidth + 1) {
            problems.push(
              `clipped ${node.className} ${node.textContent?.slice(0, 20)}`,
            );
          }
        }
        for (const text of document.querySelectorAll<HTMLElement>(
          ".scrap-text",
        )) {
          const scrap = text.closest("li")?.getBoundingClientRect();
          const box = text.getBoundingClientRect();
          if (
            !scrap ||
            box.bottom > scrap.bottom ||
            box.right > scrap.right + 1
          ) {
            problems.push("note outside its scrap");
          }
        }
        const essentials = document.querySelectorAll<HTMLElement>(
          ".shoebox-world :is(button, a)",
        );
        for (const node of essentials) {
          const box = node.getBoundingClientRect();
          if (box.width === 0) continue;
          if (box.height < 44 || box.width < 44) {
            problems.push(
              `small target ${node.textContent} ${box.width}x${box.height}`,
            );
          }
        }
        return problems;
      });
      expect(report).toEqual([]);

      // Every control is the topmost element at its centre once scrolled to.
      const controls = page.locator(".shoebox-world :is(button, a, audio)");
      const count = await controls.count();
      for (let i = 0; i < count; i += 1) {
        const control = controls.nth(i);
        if (!(await control.isVisible())) continue;
        await control.scrollIntoViewIfNeeded();
        const covered = await control.evaluate((node) => {
          node.scrollIntoView({ block: "center", behavior: "instant" });
          const box = node.getBoundingClientRect();
          const hit = document.elementFromPoint(
            box.left + box.width / 2,
            box.top + box.height / 2,
          );
          return hit && (hit === node || node.contains(hit))
            ? null
            : `${node.tagName}.${node.className} covered by ${hit?.tagName}.${hit?.className} at ${box.x},${box.y}`;
        });
        expect(covered, `control ${i} is covered`).toBeNull();
      }
    });
  }

  test("memory content and controls are upright; only decoration tilts", async ({
    page,
  }) => {
    await openArchive(page, sceneRecords());
    await expect(scraps(page)).toHaveCount(6);
    const transforms = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          ".shoebox-world :is(.scrap-body, .scrap-body *, .shoebox-controls, .shoebox-controls *)",
        ),
      ]
        .map((node) => getComputedStyle(node).transform)
        .filter((value) => value !== "none"),
    );
    expect(transforms).toEqual([]);
    const papers = await page
      .locator(".scrap-paper")
      .evaluateAll((nodes) =>
        nodes.map((node) => getComputedStyle(node).transform),
      );
    expect(papers.some((value) => value !== "none")).toBe(true);
    // Decoration never takes pointer input nor reaches assistive tech.
    const decor = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          ".scrap-paper, .scrap-tape, .scrap-lid, .scrap-stamp, .scrap-legs, .shoebox-moon-cell, .shoebox-fish-cell",
        ),
      ].map(
        (node) =>
          `${getComputedStyle(node).pointerEvents}|${node.closest("[aria-hidden='true']") !== null}`,
      ),
    );
    expect(new Set(decor)).toEqual(new Set(["none|true"]));
  });
});

test.describe("No tocar", () => {
  test("twenty rapid presses keep every target still, hold one reaction and settle under 3s", async ({
    page,
  }) => {
    await openArchive(page, sceneRecords());
    await expect(scraps(page)).toHaveCount(6);
    await page.evaluate(() => window.scrollTo(0, 0));
    const before = await targetBoxes(page);
    const scroll = await page.evaluate(() => window.scrollY);
    const focusBefore = await page.evaluate(
      () => document.activeElement?.tagName,
    );
    for (let i = 0; i < 20; i += 1) {
      await noTocar(page).click({ noWaitAfter: true });
      if (i % 5 === 0) expect(await targetBoxes(page)).toEqual(before);
    }
    const stamped = await page.locator(".shoebox-fish-stamp").count();
    expect(stamped).toBeLessThanOrEqual(1);
    await expect(page.locator(".shoebox-world")).toHaveAttribute(
      "data-mischief",
      /moon|legs|stamp|jars/,
    );
    expect(await targetBoxes(page)).toEqual(before);
    expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
    expect(await page.locator("dialog[open]").count()).toBe(0);
    const pressedAt = Date.now();
    await expect(page.locator(".shoebox-world")).not.toHaveAttribute(
      "data-mischief",
      /.+/,
      { timeout: 3_000 },
    );
    expect(Date.now() - pressedAt).toBeLessThan(3_000);
    expect(await targetBoxes(page)).toEqual(before);
    expect(focusBefore).toBeDefined();
  });

  test("a reaction really moves decoration between frames, never the controls", async ({
    page,
  }) => {
    await openArchive(page, sceneRecords());
    await expect(scraps(page)).toHaveCount(6);
    await page.evaluate(() => window.scrollTo(0, 0));
    const before = await targetBoxes(page);
    await noTocar(page).click(); // first reaction: the guilty moon
    await expect(page.locator(".shoebox-world")).toHaveAttribute(
      "data-mischief",
      "moon",
    );
    await expect(page.locator(".shoebox-moon-bubble")).toHaveText(
      "Vale, he sido yo. Un poco.",
    );
    const frameA = await moonTransform(page);
    await page.waitForTimeout(350);
    const frameB = await moonTransform(page);
    expect(frameA).not.toBe(frameB);
    expect(await targetBoxes(page)).toEqual(before);
    await noTocar(page).click(); // second: the legs march
    await expect(page.locator(".shoebox-world")).toHaveAttribute(
      "data-mischief",
      "legs",
    );
    const leg = page.locator(".scrap-legs").first();
    const legA = await leg.evaluate((node) => getComputedStyle(node).transform);
    await page.waitForTimeout(320);
    const legB = await leg.evaluate((node) => getComputedStyle(node).transform);
    expect(legA).not.toBe(legB);
    expect(await targetBoxes(page)).toEqual(before);
  });
});

test.describe("ambient pause and reduced motion", () => {
  test("reduced-motion feedback has its own opaque reading surface above inherited artwork", async ({
    page,
  }) => {
    await openArchive(page, sceneRecords());
    await page.emulateMedia({ reducedMotion: "reduce" });
    const note = page.getByText("Tu dispositivo pide menos movimiento");
    await expect(note).toBeVisible();
    await expect(note).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  });

  test("pause stops every animation on the route, inherited scenery included, and persists only that preference", async ({
    page,
  }) => {
    await openArchive(page, sceneRecords());
    await expect(scraps(page)).toHaveCount(6);
    expect((await runningAnimations(page)).length).toBeGreaterThan(0);
    const inherited = await page.evaluate(
      () => document.querySelectorAll(".dream-gallery *").length,
    );
    expect(inherited).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Pausar movimiento" }).click();
    await expect(
      page.getByRole("button", { name: "Reanudar movimiento" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(await runningAnimations(page)).toEqual([]);

    // The reaction settles to its static punchline.
    const still = await moonTransform(page);
    await noTocar(page).click();
    await expect(page.locator(".shoebox-moon-bubble")).toHaveText(
      "Vale, he sido yo. Un poco.",
    );
    await page.waitForTimeout(300);
    expect(await moonTransform(page)).toBe(still);
    expect(await runningAnimations(page)).toEqual([]);

    const stored = await page.evaluate(() => ({ ...localStorage }));
    expect(stored).toEqual({ "tor-landa:shoebox-motion-paused": "1" });
    await page.reload();
    await expect(scraps(page)).toHaveCount(6);
    await expect(
      page.getByRole("button", { name: "Reanudar movimiento" }),
    ).toBeVisible();
    expect(await runningAnimations(page)).toEqual([]);
    await page.getByRole("button", { name: "Reanudar movimiento" }).click();
    expect((await runningAnimations(page)).length).toBeGreaterThan(0);
  });

  test("an open dialog pauses ambient scenery without taking it over", async ({
    page,
  }) => {
    await openArchive(page, sceneRecords());
    await expect(scraps(page)).toHaveCount(6);
    await page.getByRole("button", { name: "Meter algo en la caja" }).click();
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    expect(await runningAnimations(page)).toEqual([]);
    await page
      .getByRole("dialog", { name: "Algo nuevo para la caja" })
      .getByRole("button", { name: "Cerrar" })
      .click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect
      .poll(async () => (await runningAnimations(page)).length)
      .toBeGreaterThan(0);
  });

  test("an inherited native dialog and a hidden tab also pause all scenery", async ({
    page,
  }) => {
    await openArchive(page, sceneRecords());
    await expect(scraps(page)).toHaveCount(6);
    await page
      .locator("footer")
      .getByRole("button", { name: "Abrir sorpresa" })
      .click();
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    await expect.poll(() => runningAnimations(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(() => runningAnimations(page)).toEqual([]);
  });

  test("reduced motion stops CSS and JS motion live and shows static punchlines", async ({
    page,
  }) => {
    await openArchive(page, sceneRecords());
    await expect(scraps(page)).toHaveCount(6);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(
      page.getByText("Tu dispositivo pide menos movimiento"),
    ).toBeVisible();
    expect(await runningAnimations(page)).toEqual([]);
    await noTocar(page).click();
    await expect(page.locator(".shoebox-moon-bubble")).toHaveText(
      "Vale, he sido yo. Un poco.",
    );
    expect(await moonTransform(page)).toBe("none");
    expect(await runningAnimations(page)).toEqual([]);
  });

  test("leaving the route removes every root attribute and the home scenery runs again", async ({
    page,
  }) => {
    await openArchive(page, sceneRecords());
    await expect(scraps(page)).toHaveCount(6);
    await page.getByRole("button", { name: "Pausar movimiento" }).click();
    await page.getByRole("link", { name: "← Correos imposibles" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.locator(".shoebox-world")).toHaveCount(0);
    const attributes = await page.evaluate(() =>
      document.documentElement
        .getAttributeNames()
        .filter((name) => name.startsWith("data-shoebox")),
    );
    expect(attributes).toEqual([]);
    await expect
      .poll(async () => (await runningAnimations(page)).length)
      .toBeGreaterThan(0);
    const paused = await page.evaluate(
      () =>
        [...document.querySelectorAll(".dream-painting")].filter(
          (node) => getComputedStyle(node).animationPlayState === "paused",
        ).length,
    );
    expect(paused).toBe(0);
  });
});

test.describe("media", () => {
  test("a 500-character unbroken photo caption reflows inside the narrow detail dialog", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await openArchive(page, [
      syntheticMemory(1, "photo", { caption: "x".repeat(500) }),
    ]);
    await page.getByRole("button", { name: /Ver la foto/ }).click();
    const caption = page.getByRole("dialog").locator("figcaption");
    expect(
      await caption.evaluate(
        (node) => node.scrollWidth <= node.clientWidth + 1,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("dialog").getByRole("button", { name: "Cerrar" }),
    ).toBeVisible();
  });

  test("opening the composer silences the archive before a local audio preview", async ({
    page,
  }) => {
    await openArchive(page, [syntheticMemory(1, "audio")]);
    const audio = page.locator("[data-memory-id] audio");
    await audio.evaluate((node: HTMLAudioElement) => node.play());
    await page.getByRole("button", { name: "Meter algo en la caja" }).click();
    expect(await audio.evaluate((node: HTMLAudioElement) => node.paused)).toBe(
      true,
    );
  });

  test("client-side route exit pauses even a detached looping audio element", async ({
    page,
  }) => {
    await openArchive(page, [syntheticMemory(1, "audio")]);
    const audio = page.locator("[data-memory-id] audio");
    await audio.evaluate(async (node: HTMLAudioElement) => {
      (
        window as unknown as { __shoeboxAudio: HTMLAudioElement }
      ).__shoeboxAudio = node;
      node.loop = true;
      await node.play();
    });
    await page.getByRole("link", { name: "← Correos imposibles" }).click();
    await expect(page).toHaveURL("/");
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __shoeboxAudio: HTMLAudioElement })
            .__shoeboxAudio.paused,
      ),
    ).toBe(true);
  });

  test("unavailable detail audio explains failure and retains caption/date", async ({
    page,
  }) => {
    const audio = syntheticMemory(1, "audio", {
      caption: "audio sintético bloqueado",
    });
    // Open a backdated saved audio through the detail flow using the existing
    // card's photo action first, then return an audio detail from the server.
    const photo = syntheticMemory(1, "photo");
    const api = await openArchive(page, [photo]);
    api.detailReply = () => ({ status: 200, json: { memory: audio } });
    await page.route("**/media", (route) =>
      route.request().resourceType() === "media"
        ? route.abort()
        : route.fallback(),
    );
    await page.getByRole("button", { name: /Ver la foto/ }).click();
    const dialog = page.getByRole("dialog", { name: "Un recuerdo de la caja" });
    await expect(dialog.locator("audio")).toHaveCount(1);
    await dialog
      .locator("audio")
      .evaluate((el: HTMLAudioElement) => el.play().catch(() => {}));
    await expect(dialog.getByRole("status")).toContainText(
      "Este audio no está disponible ahora",
    );
    await expect(dialog).toContainText("audio sintético bloqueado");
    await expect(dialog.locator("time")).toBeVisible();
  });
  test("audio never autoplays, loads nothing up front, and plays one at a time", async ({
    page,
  }) => {
    const api = await openArchive(page, sceneRecords());
    await expect(scraps(page)).toHaveCount(6);
    const audios = page.locator("[data-memory-id] audio");
    await expect(audios).toHaveCount(2);
    for (const audio of await audios.all()) {
      await expect(audio).toHaveAttribute("preload", "none");
      expect(
        await audio.evaluate(
          (el: HTMLAudioElement) => el.autoplay || !el.paused,
        ),
      ).toBe(false);
    }
    const audioIds = [syntheticMemory(3).id, syntheticMemory(5).id];
    expect(api.mediaCalls.filter((id) => audioIds.includes(id))).toEqual([]);
    await expect(audios.first()).toHaveAccessibleName(
      "Escuchar: frasco sintético uno",
    );

    await audios.nth(0).evaluate((el: HTMLAudioElement) => el.play());
    await expect
      .poll(() => audios.nth(0).evaluate((el: HTMLAudioElement) => !el.paused))
      .toBe(true);
    await audios.nth(1).evaluate((el: HTMLAudioElement) => el.play());
    await expect
      .poll(() => audios.nth(0).evaluate((el: HTMLAudioElement) => el.paused))
      .toBe(true);
    // Opening a dialog pauses whatever was playing.
    await page
      .getByRole("button", { name: /Ver la foto/ })
      .first()
      .click();
    await expect
      .poll(() => audios.nth(1).evaluate((el: HTMLAudioElement) => el.paused))
      .toBe(true);
  });

  test("a blocked photo keeps caption and date and offers a bounded retry", async ({
    page,
  }) => {
    const photo = syntheticMemory(2, "photo", { caption: "foto bloqueada" });
    const api = await mockArchive(page, [syntheticMemory(1), photo]);
    api.mediaReply = (id) => (id === photo.id ? "abort" : undefined);
    // Configure failure before navigation: even a lazy request scheduled just
    // after an initial counter read must belong to this one mount, not a reload.
    await loginThroughUi(page);
    await expect(page).toHaveURL("/shoebox");
    const scrap = page.locator(`[data-memory-id="${photo.id}"]`);
    await expect(
      scrap.getByText("La foto no quiere salir ahora."),
    ).toBeVisible();
    await expect(scrap.getByText("foto bloqueada")).toBeVisible();
    await expect(scrap.locator("time")).toBeVisible();
    await expect(scrap.locator("img")).toHaveCount(0);
    await scrap.getByRole("button", { name: "Reintentar la foto" }).click();
    await expect(
      scrap.getByText("Esta foto no está disponible ahora."),
    ).toBeVisible();
    await expect(
      scrap.getByRole("button", { name: "Reintentar la foto" }),
    ).toHaveCount(0);
    await page.waitForTimeout(2_000);
    expect(
      api.mediaCalls.filter((id) => id === photo.id).length,
    ).toBeLessThanOrEqual(3);
  });

  test("a busy media read (503) recovers by itself once", async ({ page }) => {
    const photo = syntheticMemory(2, "photo");
    const api = await mockArchive(page, [photo]);
    api.mediaReply = (id, attempt) =>
      id === photo.id && attempt === 1
        ? apiError(503, "UNAVAILABLE")
        : undefined;
    await loginThroughUi(page);
    await expect(page).toHaveURL("/shoebox");
    const image = page.locator(`[data-memory-id="${photo.id}"] img`);
    await expect
      .poll(() =>
        image.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth,
        ),
      )
      .toBeGreaterThan(0);
    expect(api.mediaCalls.filter((id) => id === photo.id)).toHaveLength(2);
  });

  test("the full photo opens in a contain-sized dialog with caption and date, then returns focus", async ({
    page,
  }) => {
    const photo = syntheticMemory(2, "photo", {
      caption: "foto sintética grande",
    });
    await openArchive(page, [photo]);
    const trigger = page.getByRole("button", {
      name: "Ver la foto: foto sintética grande",
    });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Un recuerdo de la caja" });
    await expect(dialog).toBeVisible();
    const image = dialog.locator("img");
    await expect(image).toHaveCSS("object-fit", "contain");
    expect(await image.getAttribute("src")).toBe(photo.mediaPath);
    await expect(dialog).toContainText("foto sintética grande");
    await expect(dialog.locator("time")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});

test("synthetic visual inspection captures @capture", async ({
  page,
}, info) => {
  const directory = process.env.SHOEBOX_CAPTURE_DIR;
  test.skip(!directory, "Opt-in scratch captures, not repository snapshots");
  if (!directory) return;
  mkdirSync(directory, { recursive: true });
  const records = sceneRecords();
  records[0] = syntheticMemory(1, "text", {
    text: "Declaración sintética: las cucharas exigen vacaciones.\nSe abre expediente.",
    caption: "Solo una prueba de composición",
  });
  await openArchive(page, records);
  await expect(scraps(page)).toHaveCount(6);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  // Bring lazy photos into view before the full-page captures.
  for (const image of await page.locator(".scrap-photo img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const time of ["day", "night"]) {
    await page.evaluate(
      (value) => document.documentElement.setAttribute("data-time", value),
      time,
    );
    for (const reduced of [false, true]) {
      await page.emulateMedia({
        reducedMotion: reduced ? "reduce" : "no-preference",
      });
      await page.screenshot({
        path: join(
          directory,
          `${info.project.name}-${time}-${reduced ? "reduced" : "normal"}.png`,
        ),
        fullPage: true,
      });
    }
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await noTocar(page).click();
  await page.waitForTimeout(350);
  await page.screenshot({
    path: join(directory, `${info.project.name}-mischief-frame.png`),
  });
  await page
    .locator(".scrap-jar-content audio")
    .first()
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: join(directory, `${info.project.name}-native-controls.png`),
  });
});
