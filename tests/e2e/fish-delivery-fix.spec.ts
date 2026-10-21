import { mkdir, writeFile } from "node:fs/promises";
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

for (const phase of ["flight", "fold"] as const) {
  test(`real footer modal settles ${phase} to static readable paper and preserves modal focus`, async ({
    page,
  }, info) => {
    await installJournalFixtures(page);
    await page.goto("/");
    const scene = page.getByTestId("post-office");
    await expect(scene.getByTestId("quality-message")).toBeVisible();
    await expect(scene).toHaveAttribute("data-phase", "complete");
    await page.evaluate(() => document.fonts.ready);
    await page
      .getByRole("button", { name: "Repetir entrega", exact: true })
      .click();
    const footer = page.getByRole("button", {
      name: "Abrir sorpresa",
      exact: true,
    });
    await footer.scrollIntoViewIfNeeded();
    if (phase === "fold") {
      await page.waitForFunction(
        () => {
          const flap = document.querySelector(".postal-flap");
          const time = Number(flap?.getAnimations()[0]?.currentTime ?? 0);
          return (
            time >= 1330 &&
            time < 1600 &&
            getComputedStyle(flap as Element).transform.startsWith("matrix3d")
          );
        },
        undefined,
        { polling: "raf" },
      );
    } else {
      await expect(scene.locator(".postal-cargo")).not.toHaveCSS(
        "transform",
        "none",
      );
    }
    const before = await scene.evaluate((n) => ({
      phase: n.getAttribute("data-phase"),
      paperOpacity: getComputedStyle(
        n.querySelector(".postal-paper") as Element,
      ).opacity,
      cargo: getComputedStyle(n.querySelector(".postal-cargo") as Element)
        .transform,
      flap: getComputedStyle(n.querySelector(".postal-flap") as Element)
        .transform,
    }));
    expect(before.phase).toBe(phase);
    expect(before.paperOpacity).toBe("0");
    await footer.click();
    const dialog = page.getByRole("dialog", {
      name: "Sorpresa surrealista",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(scene.locator(".postal-paper")).toHaveCSS("opacity", "1", {
      timeout: 750,
    });
    await expect(scene.locator(".postal-paper")).toHaveCSS("transform", "none");
    await expect(scene.locator(".postal-cargo")).toHaveCSS("transform", "none");
    await expect(scene.locator(".postal-paper")).not.toHaveAttribute(
      "inert",
      "",
    );
    await expect(scene).toHaveAttribute("data-phase", "complete");
    expect(
      await dialog.evaluate((n) => n.contains(document.activeElement)),
    ).toBe(true);
    expect(
      await scene.evaluate(
        (n) =>
          Array.from(
            n.querySelectorAll(
              ".postal-cargo,.postal-flap,.postal-paper,.postal-fish,.postal-clock-hand,.postal-peeker,.postal-cup-seal",
            ),
          )
            .flatMap((part) => part.getAnimations())
            .filter(
              (a) => a.playState === "running" || a.playState === "paused",
            ).length,
      ),
    ).toBe(0);
    await mkdir(evidence, { recursive: true });
    await page.screenshot({
      path: `${evidence}/${info.project.name}-modal-${phase}-open.png`,
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(footer).toBeFocused();
    await expect(scene.locator(".postal-paper")).toHaveCSS("opacity", "1");
    await expect(scene.locator(".postal-paper")).toHaveCSS("transform", "none");
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: `${evidence}/${info.project.name}-modal-${phase}-dismissed.png`,
    });
    await writeFile(
      `${evidence}/${info.project.name}-modal-${phase}.json`,
      JSON.stringify(
        {
          before,
          after: await scene.evaluate((n) => ({
            phase: n.getAttribute("data-phase"),
            paper: getComputedStyle(n.querySelector(".postal-paper") as Element)
              .cssText,
            opacity: getComputedStyle(
              n.querySelector(".postal-paper") as Element,
            ).opacity,
            transform: getComputedStyle(
              n.querySelector(".postal-paper") as Element,
            ).transform,
            inert: n.querySelector(".postal-paper")?.hasAttribute("inert"),
          })),
        },
        null,
        2,
      ),
    );
    await page
      .getByRole("button", { name: "Semana aleatoria", exact: true })
      .click();
    await expect(scene.locator(".postal-paper")).toHaveAttribute("inert", "");
    await expect(scene.locator(".postal-cargo")).not.toHaveCSS(
      "transform",
      "none",
    );
    const present = page.getByRole("button", {
      name: "Volver al presente",
      exact: true,
    });
    if (await present.isEnabled()) await present.click();
    await page
      .getByRole("button", { name: "Semana siguiente", exact: true })
      .click();
    await expect(page.getByTestId("week-context")).toHaveText(
      "Semana 26 / 2026",
    );
    await expect(scene.locator(".postal-paper")).toHaveAttribute("inert", "");
    await expect(scene.locator(".postal-cargo")).not.toHaveCSS(
      "transform",
      "none",
    );
    await expect(scene).toHaveAttribute("data-phase", "complete");
    await expect(scene.locator(".postal-paper")).toHaveCSS("opacity", "1");
  });
}

test("actual dialog observers disconnect on settle, reduction, replacement and route unmount", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeObserver = window.MutationObserver;
    const active = new Set<MutationObserver>();
    window.MutationObserver = class extends NativeObserver {
      observe(target: Node, options?: MutationObserverInit) {
        super.observe(target, options);
        if (
          target === document.body &&
          options?.attributeFilter?.includes("open")
        )
          active.add(this);
      }
      disconnect() {
        active.delete(this);
        super.disconnect();
      }
    };
    // This set contains the actual native-backed instances, not app counters.
    Reflect.set(window, "__activePostalObservers", active);
  });
  await installJournalFixtures(page);
  await page.goto("/");
  await expect(page.getByTestId("quality-message")).toBeVisible();
  await expect(page.getByTestId("post-office")).toHaveAttribute(
    "data-phase",
    "complete",
  );
  const count = () =>
    page.evaluate(
      () =>
        (
          Reflect.get(
            window,
            "__activePostalObservers",
          ) as Set<MutationObserver>
        ).size,
    );
  await expect.poll(count).toBe(0);
  const random = page.getByRole("button", {
    name: "Semana aleatoria",
    exact: true,
  });
  for (let index = 0; index < 8; index++) {
    await random.click();
    await expect.poll(count).toBe(1);
  }
  await page
    .getByRole("button", { name: "Saltar animación", exact: true })
    .click();
  await expect.poll(count).toBe(0);
  await random.click();
  await expect.poll(count).toBe(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(count).toBe(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await random.click();
  await expect.poll(count).toBe(1);
  await page
    .getByRole("link", { name: "Historia completa", exact: true })
    .click();
  await expect(page.getByTestId("post-office")).toHaveCount(0);
  await expect.poll(count).toBe(0);
});
