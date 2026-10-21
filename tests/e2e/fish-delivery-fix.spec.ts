import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { installJournalFixtures } from "./journal.fixture";

const evidence = "playwright-report/fish-delivery/fix";

for (const long of [false, true]) {
  for (const reduced of [false, true]) {
    test(`initial ${long ? "long" : "short"} letter keeps the native skip slot in view (${reduced ? "reduced" : "normal"})`, async ({
      page,
    }, info) => {
      if (long) await page.setViewportSize({ width: 320, height: 844 });
      await page.emulateMedia({
        reducedMotion: reduced ? "reduce" : "no-preference",
      });
      await installJournalFixtures(page, {
        qualities: [
          {
            week: 25,
            year: 2026,
            message: long
              ? "Te quiero incluso cuando el pez solicita vacaciones. ".repeat(
                  40,
                )
              : "Una carta para Landa.",
          },
        ],
      });
      await page.goto("/");
      const scene = page.getByTestId("post-office");
      await expect(scene.locator(".postal-fish")).toHaveCSS(
        "position",
        "absolute",
      );
      await expect(scene).toHaveAttribute("data-delivered", "true");
      const control = scene.locator(".postal-skip");
      const box = await control.boundingBox();
      if (!box) throw new Error("Native skip must have a real layout box");
      expect(await page.evaluate(() => scrollY)).toBe(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(
        page.viewportSize()?.height ?? 0,
      );
      expect(box.height).toBeGreaterThanOrEqual(44);
      await mkdir(evidence, { recursive: true });
      await page.screenshot({
        path: `${evidence}/${info.project.name}-${long ? "long-320" : "short"}-${reduced ? "reduced" : "flight"}-top.png`,
      });
      await control.focus();
      if (!reduced) await page.keyboard.press("Enter");
      await expect(control).toBeFocused();
      await expect(scene.locator(".postal-paper")).toHaveCSS("opacity", "1");
      await expect(scene.locator(".postal-paper")).toHaveCSS(
        "transform",
        "none",
      );
      expect(
        (await scene.getByTestId("quality-message").boundingBox())?.y,
      ).toBeLessThan(500);
      await page.screenshot({
        path: `${evidence}/${info.project.name}-${long ? "long-320" : "short"}-${reduced ? "reduced" : "settled"}-final.png`,
      });
    });
  }
}
