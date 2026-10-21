import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { installJournalFixtures } from "./journal.fixture";

// Removing the real control-to-scene connection must break these visual checks.
for (const reduced of [false, true]) {
  test(`postal delivery and navigation are visibly connected (${reduced ? "reduced" : "normal"})`, async ({
    page,
  }, info) => {
    const trackTimers = () => {
      const pending = new Map<
        number,
        { delay: number | undefined; stack: string | undefined }
      >();
      const schedule = window.setTimeout.bind(window);
      const cancel = window.clearTimeout.bind(window);
      Reflect.set(
        window,
        "setTimeout",
        (handler: TimerHandler, delay?: number, ...args: unknown[]) => {
          if (typeof handler !== "function")
            return schedule(handler, delay, ...args);
          const id = schedule(() => {
            pending.delete(id);
            handler(...args);
          }, delay);
          pending.set(id, { delay, stack: new Error().stack });
          return id;
        },
      );
      Reflect.set(window, "clearTimeout", (id?: number) => {
        if (id !== undefined) pending.delete(id);
        cancel(id);
      });
      Object.defineProperty(window, "__postalPendingTimers", {
        value: () => pending.size,
      });
      Object.defineProperty(window, "__postalTimerDetails", {
        value: () => [...pending.values()],
      });
    };
    await page.emulateMedia({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await installJournalFixtures(page);
    await page.goto("/?time=day");
    const scene = page.getByTestId("post-office");
    const expectSelectionCue = async (
      action: () => Promise<unknown>,
      direction: -1 | 0 | 1,
    ) => {
      const previousCast = await scene
        .locator(".postal-airmail")
        .elementHandle();
      if (!previousCast)
        throw new Error("Live decorative cast must exist before navigation");
      await action();
      await expect
        .poll(() => previousCast.evaluate((n) => n.isConnected))
        .toBe(false);
      const cast = scene.locator(".postal-airmail");
      await expect.poll(() => cast.evaluate((n) => n.isConnected)).toBe(true);
      await expect(scene.locator(".postal-peeker")).toHaveCSS(
        "transform",
        direction === 1
          ? "matrix(0.978148, 0.207912, -0.207912, 0.978148, 0, -15)"
          : "matrix(0.978148, -0.207912, 0.207912, 0.978148, 0, -6)",
      );
      await expect(scene.locator(".postal-fish")).toHaveCSS(
        "transform",
        direction === 1
          ? "matrix(-0.984808, -0.173648, -0.173648, 0.984808, 0, 0)"
          : "matrix(0.978148, -0.207912, 0.207912, 0.978148, 0, 0)",
      );
      if (reduced) {
        await expect
          .poll(() =>
            cast.evaluate((n) => n.getAnimations({ subtree: true }).length),
          )
          .toBe(0);
      } else {
        await expect
          .poll(() =>
            scene
              .locator(".postal-clock-hand")
              .evaluate((n) =>
                n
                  .getAnimations()
                  .some(
                    (a) =>
                      a instanceof CSSAnimation &&
                      a.animationName === "postal-rewind" &&
                      a.playState === "running",
                  ),
              ),
          )
          .toBe(true);
      }
      await previousCast.dispose();
    };
    await expect(scene.getByTestId("quality-message")).toHaveText(
      "Tu imaginación abre puertas imposibles.",
    );
    await expect(scene.getByText("ENTREGADA", { exact: true })).toBeVisible();
    await expect(scene.locator(".postal-fish")).toBeVisible();
    await expect(scene.locator(".postal-cup")).toBeVisible();
    const fish = await scene.locator(".postal-fish").boundingBox();
    const envelope = await scene.locator(".postal-envelope").boundingBox();
    if (!fish || !envelope)
      throw new Error("Fish and its envelope must be visible");
    expect(envelope.width).toBeGreaterThan(fish.width * 2);
    expect(
      (await scene.getByTestId("quality-message").boundingBox())?.y,
    ).toBeLessThan(500);
    const next = page.getByRole("button", {
      name: "Semana siguiente",
      exact: true,
    });
    const previous = page.getByRole("button", {
      name: "Semana anterior",
      exact: true,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(trackTimers);
    await page.waitForTimeout(1300);
    const baselineTimers = await page.evaluate(() =>
      Reflect.get(window, "__postalPendingTimers")(),
    );
    const initial = await next.boundingBox();
    const initialScroll = await page.evaluate(() => scrollY);
    await expectSelectionCue(() => previous.click(), -1);
    await expect(scene.getByTestId("quality-message")).toHaveText(
      "Tu paciencia transforma los días.",
    );
    if (!reduced) {
      const hand = scene.locator(".postal-clock-hand");
      const firstRotation = await hand.evaluate(
        (n) => getComputedStyle(n).rotate,
      );
      await page.waitForTimeout(100);
      expect(await hand.evaluate((n) => getComputedStyle(n).rotate)).not.toBe(
        firstRotation,
      );
    }
    await expect(scene.locator(".postal-clock-hand")).toHaveCSS(
      "transform",
      /matrix/,
    );
    const previousPose = await scene
      .locator(".postal-peeker")
      .evaluate((n) => getComputedStyle(n).transform);
    await mkdir("playwright-report/post-office", { recursive: true });
    await page.screenshot({
      path: `playwright-report/post-office/${info.project.name}-previous-${reduced ? "reduced" : "normal"}.png`,
      fullPage: true,
    });
    await expectSelectionCue(() => next.click(), 1);
    await expect(scene.getByTestId("quality-message")).toHaveText(
      "Tu imaginación abre puertas imposibles.",
    );
    await expect
      .poll(() =>
        scene
          .locator(".postal-peeker")
          .evaluate((n) => getComputedStyle(n).transform),
      )
      .not.toBe(previousPose);
    const after = await next.boundingBox();
    expect(after?.width).toBe(initial?.width);
    expect(after?.height).toBe(initial?.height);
    expect(after?.x).toBe(initial?.x);
    expect((after?.y ?? 0) + (await page.evaluate(() => scrollY))).toBe(
      (initial?.y ?? 0) + initialScroll,
    );
    await next.focus();
    await expectSelectionCue(() => page.keyboard.press("ArrowLeft"), -1);
    await expect(scene.getByTestId("quality-message")).toHaveText(
      "Tu paciencia transforma los días.",
    );
    await expectSelectionCue(() => page.keyboard.press("ArrowRight"), 1);
    await expect(scene.getByTestId("quality-message")).toHaveText(
      "Tu imaginación abre puertas imposibles.",
    );
    await expectSelectionCue(() => page.keyboard.press("ArrowRight"), 1);
    await expect(scene.getByTestId("quality-message")).toHaveText(
      "Tu alegría cambia el paisaje.",
    );
    await expectSelectionCue(
      () => page.getByRole("button", { name: "Volver al presente" }).click(),
      0,
    );
    await expect(scene.getByTestId("quality-message")).toHaveText(
      "Tu imaginación abre puertas imposibles.",
    );
    await page.getByText("Detalles de la semana", { exact: true }).click();
    await expectSelectionCue(
      () =>
        page
          .getByRole("button", { name: "Semana 24 del 2026", exact: true })
          .click(),
      0,
    );
    await expect(scene.getByTestId("quality-message")).toHaveText(
      "Tu paciencia transforma los días.",
    );
    for (let i = 0; i < 12; i++) {
      await next.click();
      await previous.click();
    }
    expect(await scene.locator(".postal-fish").count()).toBe(1);
    await page.waitForTimeout(1300);
    await info.attach("pending-timers", {
      body: JSON.stringify(
        await page.evaluate(() =>
          Reflect.get(window, "__postalTimerDetails")(),
        ),
        null,
        2,
      ),
      contentType: "application/json",
    });
    await writeFile(
      `playwright-report/post-office/${info.project.name}-timers-${reduced ? "reduced" : "normal"}.json`,
      JSON.stringify(
        {
          baselineTimers,
          pending: await page.evaluate(() =>
            Reflect.get(window, "__postalTimerDetails")(),
          ),
        },
        null,
        2,
      ),
    );
    await expect
      .poll(() =>
        page.evaluate(() => Reflect.get(window, "__postalPendingTimers")()),
      )
      .toBeLessThanOrEqual(baselineTimers + 1);
    expect(
      await scene
        .locator(".postal-airmail")
        .evaluate(
          (n) =>
            n
              .getAnimations({ subtree: true })
              .filter((a) => a.playState === "running").length,
        ),
    ).toBe(0);
  });

  test(`same-week random request makes the moon visibly jealous (${reduced ? "reduced" : "normal"})`, async ({
    page,
  }) => {
    await page.emulateMedia({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await installJournalFixtures(page, {
      qualities: [{ week: 25, year: 2026, message: "Una carta para Landa." }],
    });
    await page.goto("/");
    const moon = page.locator(".postal-moon-pose");
    await expect(page.getByTestId("quality-message")).toBeVisible();
    await expect(moon).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
    await expect(page.locator(".postal-jealous-brow")).toHaveCount(0);
    const action = page.getByRole("button", {
      name: "Semana aleatoria",
      exact: true,
    });
    await action.click();
    await expect(moon).toHaveCSS(
      "transform",
      "matrix(0.945519, -0.325568, 0.325568, 0.945519, -7.56415, 2.60455)",
    );
    await expect(page.locator(".postal-jealous-brow")).toBeVisible();
    await action.click();
    await expect(moon).toHaveCSS(
      "transform",
      "matrix(0.945519, 0.325568, -0.325568, 0.945519, 7.56415, 2.60455)",
    );
    await expect(page.getByTestId("quality-message")).toHaveText(
      "Una carta para Landa.",
    );
  });
}

test("failed and missing letters never claim delivery; retry can deliver", async ({
  page,
}) => {
  await installJournalFixtures(page, { qualityStatus: 500 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  await expect(page.getByText("ENTREGADA", { exact: true })).toHaveCount(0);
  await page.route("**/api/quality", (route) =>
    route.fulfill({
      json: {
        qualities: [{ week: 25, year: 2026, message: "Llegó la carta." }],
      },
    }),
  );
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(
    page.getByTestId("post-office").getByText("ENTREGADA", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Semana siguiente", exact: true })
    .click();
  await expect(page.getByText("ENTREGADA", { exact: true })).toHaveCount(0);
});

test("loading and birthday gate do not receive the delivery stamp", async ({
  page,
}) => {
  await installJournalFixtures(page, {
    now: "2026-10-22T12:00:00+02:00",
    qualities: [
      { week: 43, year: 2026, message: "Berlín y nuestros cuatro números" },
    ],
  });
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/quality", async (route) => {
    await held;
    await route.fallback();
  });
  await page.goto("/");
  const scene = page.getByTestId("post-office");
  await expect(
    page.getByRole("heading", { name: "Cargando el mensaje…", exact: true }),
  ).toBeVisible();
  await expect(scene.getByText("ENTREGADA", { exact: true })).toHaveCount(0);
  await expect(scene.locator(".postal-moon-pose")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  await expect(scene.locator(".postal-jealous-brow")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Semana aleatoria", exact: true }),
  ).toBeDisabled();
  await expect(scene.locator(".postal-moon-pose")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  await expect(scene.locator(".postal-jealous-brow")).toHaveCount(0);
  release();
  await expect(page.getByText("Vuelve el 23 de octubre")).toBeVisible();
  await expect(scene.getByText("ENTREGADA", { exact: true })).toHaveCount(0);
  await expect(scene.getByTestId("quality-message")).toHaveCount(0);
  await expect(scene.locator(".postal-moon-pose")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  await expect(scene.locator(".postal-jealous-brow")).toHaveCount(0);
});

test("night cargo cord stays visible and narrow-phone peeker clears the lunar controls", async ({
  page,
}) => {
  await installJournalFixtures(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?time=night");
  const scene = page.getByTestId("post-office");
  await expect(scene.getByTestId("quality-message")).toBeVisible();
  await expect(scene.locator(".postal-rig")).toHaveCSS(
    "stroke",
    "rgb(255, 243, 218)",
  );
  await expect(scene.locator(".postal-rig")).toHaveCSS("stroke-width", "3px");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() =>
        scene.evaluate((n) => {
          const peeker = n
            .querySelector(".postal-peeker")
            ?.getBoundingClientRect();
          const reply = n
            .querySelector(".lunar-reply")
            ?.getBoundingClientRect();
          const button = n
            .querySelector(".lunar-request")
            ?.getBoundingClientRect();
          const message = n
            .querySelector("[data-testid='quality-message']")
            ?.getBoundingClientRect();
          if (!peeker || !reply || !button || !message) return false;
          return [reply, button, message].every(
            (r) =>
              peeker.right <= r.left ||
              peeker.left >= r.right ||
              peeker.bottom <= r.top ||
              peeker.top >= r.bottom,
          );
        }),
      )
      .toBe(true);
  }
});
