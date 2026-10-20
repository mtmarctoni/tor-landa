import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { installJournalFixtures } from "./journal.fixture";

test("impossible painted objects stay substantial and star portals clean up", async ({
  page,
}, info) => {
  await installJournalFixtures(page);
  await page.goto("/?time=day");
  await expect(page.getByTestId("quality-message")).toBeVisible();
  for (const motif of ["eye", "melt", "stairs", "moon"]) {
    const object = page.locator(`[data-dream-object='${motif}']`);
    await expect(object).toBeVisible();
    const box = await object.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(motif === "moon" ? 40 : 95);
    expect(box?.height).toBeGreaterThanOrEqual(40);
  }
  const star = page.getByRole("button", { name: "Hacer bailar el mensaje" });
  for (let repeat = 0; repeat < 2; repeat++) {
    if (info.project.name === "phone") await star.tap();
    else {
      await star.focus();
      await page.keyboard.press("Enter");
    }
    await expect(page.getByTestId("dream-flourish")).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("dream-flourish")).toHaveCount(0);
  }
  await star.click();
  await page.waitForTimeout(750);
  await star.click();
  await page.waitForTimeout(750);
  await expect(page.getByTestId("dream-flourish")).toBeVisible();
  await expect(page.getByTestId("dream-flourish")).toHaveCount(0, {
    timeout: 2000,
  });
  await star.click();
  await page
    .getByRole("button", { name: "Semana anterior", exact: true })
    .click();
  await expect(page.getByTestId("dream-flourish")).toHaveCount(0);
});

test("four painted atmospheres retain the readable center", async ({
  page,
}, info) => {
  await installJournalFixtures(page);
  await mkdir("playwright-report/evidence", { recursive: true });
  for (const theme of ["day", "dawn", "dusk", "night"]) {
    await page.goto(`/?time=${theme}`);
    await expect(page.getByTestId("quality-message")).toBeVisible();
    await page.waitForTimeout(1400);
    await expect(page.locator("html")).toHaveAttribute("data-time", theme);
    if (info.project.name === "phone")
      expect(
        (await page.getByTestId("quality-message").boundingBox())?.y,
      ).toBeLessThan(500);
    const prefix = `playwright-report/evidence/exaggerated-${info.project.name}${theme === "day" ? "" : `-${theme}`}`;
    await page.screenshot({ path: `${prefix}.png`, fullPage: true });
    await page.screenshot({ path: `${prefix}-viewport.png` });
  }
});

for (const reduced of [false, true]) {
  test(`impossible imagery ${reduced ? "rests" : "drifts"} and bounded flourish`, async ({
    page,
  }, info) => {
    await page.emulateMedia({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await installJournalFixtures(page);
    await page.goto("/?time=day");
    await page.waitForTimeout(1200);
    const sample = () =>
      page.locator("[data-dream-object]").evaluateAll((nodes) =>
        nodes.map((node) => ({
          transform: getComputedStyle(node).transform,
          animations: node
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
        })),
      );
    const before = await sample();
    await page.waitForTimeout(700);
    const after = await sample();
    expect(before).toHaveLength(4);
    if (reduced) {
      expect(after).toEqual(before);
      expect(after.every((node) => node.animations === 0)).toBe(true);
    } else expect(after).not.toEqual(before);
    await page.getByRole("button", { name: "Hacer bailar el mensaje" }).click();
    const flourish = page.getByTestId("dream-flourish");
    await expect(flourish).toBeVisible();
    await page.waitForTimeout(350);
    if (reduced)
      expect(
        await flourish.evaluate(
          (node) => node.getAnimations({ subtree: true }).length,
        ),
      ).toBe(0);
    await page.screenshot({
      path: `playwright-report/evidence/flourish-${info.project.name}-${reduced ? "reduced" : "normal"}.png`,
    });
    await writeFile(
      `playwright-report/evidence/impossible-motion-${info.project.name}-${reduced ? "reduced" : "normal"}.json`,
      JSON.stringify({ before, after }, null, 2),
    );
    await expect(flourish).toHaveCount(0, { timeout: 2500 });
  });
}

test("recognizable local paintings float around a protected message", async ({
  page,
}, info) => {
  await installJournalFixtures(page);
  await page.goto("/?time=day");
  const paintings = page.locator("[data-painting]");
  await expect(paintings).toHaveCount(4);
  await expect
    .poll(() =>
      paintings
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  const visibleArt = await paintings.evaluateAll((nodes) =>
    nodes.map((node) => {
      const image = node.querySelector("img");
      if (!image) throw new Error("Painting image is missing");
      const r = node.getBoundingClientRect();
      return {
        source: image.getAttribute("src"),
        loaded: image.complete && image.naturalWidth > 0,
        width: Math.min(r.right, innerWidth) - Math.max(r.left, 0),
        height: Math.min(r.bottom, innerHeight) - Math.max(r.top, 0),
        opacity: getComputedStyle(node).opacity,
      };
    }),
  );
  expect(new Set(visibleArt.map((art) => art.source)).size).toBe(4);
  expect(visibleArt.every((art) => art.loaded)).toBe(true);
  expect(
    visibleArt.filter(
      (art) =>
        art.width >= 100 && art.height >= 90 && Number(art.opacity) >= 0.8,
    ).length,
  ).toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId("quality-message")).toBeVisible();
  await mkdir("playwright-report/evidence", { recursive: true });
  await writeFile(
    `playwright-report/evidence/art-geometry-${info.project.name}.json`,
    JSON.stringify(
      {
        paintings: visibleArt,
        message: await page.getByTestId("quality-message").boundingBox(),
        previous: await page
          .getByRole("button", { name: "Semana anterior", exact: true })
          .boundingBox(),
      },
      null,
      2,
    ),
  );
  await page.screenshot({
    path: `playwright-report/evidence/surreal-${info.project.name}.png`,
    fullPage: true,
  });
  await page.screenshot({
    path: `playwright-report/evidence/surreal-${info.project.name}-viewport.png`,
  });
});

for (const reduced of [false, true]) {
  test(`${reduced ? "reduced" : "normal"} motion artwork, message and touch response`, async ({
    page,
  }, info) => {
    await page.emulateMedia({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await installJournalFixtures(page);
    await page.goto("/");
    await expect(page.getByTestId("quality-message")).toBeVisible();
    await page.waitForTimeout(900);
    const sample = () =>
      page
        .locator("[data-painting], [data-testid='message-shell']")
        .evaluateAll((nodes) =>
          nodes.map((node) => ({
            transform: getComputedStyle(node).transform,
            radius: getComputedStyle(node).borderRadius,
          })),
        );
    const before = await sample();
    expect(before.length).toBe(5);
    await page.waitForTimeout(850);
    const after = await sample();
    if (reduced) expect(after).toEqual(before);
    else {
      expect(after[0].transform).not.toBe(before[0].transform);
      expect(after[4].transform).not.toBe(before[4].transform);
      expect(after[4].radius).not.toBe(before[4].radius);
    }
    const danceButton = page.getByRole("button", {
      name: "Hacer bailar el mensaje",
    });
    if (info.project.name === "phone") await danceButton.tap();
    else await danceButton.click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Las palabras también saben bailar" }),
    ).toBeVisible();
    const reaction = page.getByTestId("message-reaction");
    if (!reduced)
      await expect
        .poll(() =>
          reaction.evaluate((node) => getComputedStyle(node).transform),
        )
        .not.toBe("none");
    const active = await reaction.evaluate(
      (node) => getComputedStyle(node).transform,
    );
    if (reduced) expect(active).toBe("none");
    else expect(active).not.toBe("none");
    await expect(
      page.getByRole("button", { name: "Hacer bailar el mensaje" }),
    ).toBeFocused();
    await page.waitForTimeout(1000);
    expect(
      await reaction.evaluate((node) => getComputedStyle(node).transform),
    ).toBe("none");
    await mkdir("playwright-report/evidence", { recursive: true });
    await writeFile(
      `playwright-report/evidence/motion-${info.project.name}-${reduced ? "reduced" : "normal"}.json`,
      JSON.stringify(
        { reduced, before, after, touchTransform: active },
        null,
        2,
      ),
    );
    await info.attach("motion-samples", {
      body: JSON.stringify(
        { reduced, before, after, touchTransform: active },
        null,
        2,
      ),
      contentType: "application/json",
    });
    expect(await page.locator("button button").count()).toBe(0);
  });
}
