import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { installJournalFixtures } from "./journal.fixture";

// A stationary reading card with a separately animated fish must fail this test.
test("the actual sealed envelope and fish share substantial flight before opening", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await installJournalFixtures(page);
  await page.goto("/?time=day");
  const scene = page.getByTestId("post-office");
  await expect(scene.locator(".postal-fish")).toHaveCSS("position", "absolute");
  await expect(scene.getByTestId("quality-message")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page
    .getByRole("button", { name: "Semana anterior", exact: true })
    .click();
  const cargo = scene.locator(".postal-cargo");
  await expect(cargo).toHaveCount(1);
  const facts = await cargo.evaluate(async (node) => {
    const flight = node
      .getAnimations()
      .find(
        (a) =>
          a instanceof CSSAnimation &&
          a.animationName === "postal-cargo-flight",
      );
    if (!flight)
      throw new Error("The actual cargo needs a live flight animation");
    flight.pause();
    const sample = async (time: number) => {
      flight.currentTime = time;
      await new Promise(requestAnimationFrame);
      const fish = node.querySelector(".postal-fish")?.getBoundingClientRect();
      const envelope = node
        .querySelector(".postal-envelope")
        ?.getBoundingClientRect();
      if (!fish || !envelope)
        throw new Error("Both real cargo members must exist");
      return { fish: fish.x, envelope: envelope.x };
    };
    const start = await sample(0);
    const end = await sample(1250);
    flight.play();
    return { start, end };
  });
  const minimum = info.project.name === "phone" ? 120 : 220;
  expect(
    Math.abs(facts.start.envelope - facts.end.envelope),
  ).toBeGreaterThanOrEqual(minimum);
  expect(Math.abs(facts.start.fish - facts.end.fish)).toBeGreaterThanOrEqual(
    minimum,
  );
  expect(
    Math.abs(
      facts.start.fish -
        facts.end.fish -
        (facts.start.envelope - facts.end.envelope),
    ),
  ).toBeLessThan(1);
  await expect(scene.locator(".postal-paper")).toHaveAttribute("inert", "");
  await expect(scene.locator(".postal-flap")).toBeVisible();
  await expect(scene.getByTestId("quality-message")).toBeVisible();
  await expect(scene.getByText("ENTREGADA", { exact: true })).toBeVisible();
  await expect(scene).toHaveAttribute("data-phase", "complete");
});

test("real folded triangle, emerging paper and stamp have distinct physical transforms", async ({
  page,
}) => {
  await installJournalFixtures(page);
  await page.goto("/");
  await expect(page.getByTestId("quality-message")).toBeVisible();
  await page
    .getByRole("button", { name: "Semana anterior", exact: true })
    .click();
  const scene = page.getByTestId("post-office");
  await expect(scene.locator(".postal-flap")).toHaveCSS(
    "clip-path",
    "polygon(0px 0px, 100% 0px, 50% 100%)",
  );
  const samples = await scene.evaluate(async (node) => {
    const sample = async (selector: string, time: number) => {
      const element = node.querySelector(selector);
      if (!element) throw new Error(selector);
      const animation = element.getAnimations()[0];
      if (!animation) throw new Error(`No physical motion on ${selector}`);
      animation.pause();
      animation.currentTime = time;
      await new Promise(requestAnimationFrame);
      const result = getComputedStyle(element).transform;
      return result;
    };
    return {
      flapClosed: await sample(".postal-flap", 1250),
      flapHalf: await sample(".postal-flap", 1500),
      flapOpen: await sample(".postal-flap", 1780),
      paperBefore: await sample(".postal-paper", 1600),
      paperAbove: await sample(".postal-paper", 1900),
      paperAfter: await sample(".postal-paper", 2100),
      sealBefore: await sample(".postal-cup-seal", 2100),
      sealImpact: await sample(".postal-cup-seal", 2420),
    };
  });
  expect(samples.flapHalf).toMatch(/matrix3d/);
  expect(samples.flapClosed).not.toBe(samples.flapHalf);
  expect(samples.flapOpen).not.toBe(samples.flapHalf);
  expect(samples.paperBefore).toContain("58)");
  expect(samples.paperAbove).not.toBe(samples.paperBefore);
  expect(samples.paperAfter).toBe("matrix(1, 0, 0, 1, 0, 0)");
  expect(samples.sealImpact).not.toBe(samples.sealBefore);
});

test("same-week requests cancel old delivery and keep lunar memory; unmount cancels fallback timers", async ({
  page,
}) => {
  await installJournalFixtures(page, {
    qualities: [{ week: 25, year: 2026, message: "Una carta para Landa." }],
  });
  await page.goto("/");
  await expect(page.getByTestId("quality-message")).toBeVisible();
  await page.evaluate(() => {
    const pending = new Set<number>();
    const schedule = window.setTimeout.bind(window);
    const clear = window.clearTimeout.bind(window);
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
        if ([950, 1250, 1600, 2150, 2700].includes(delay ?? 0)) pending.add(id);
        return id;
      },
    );
    Reflect.set(window, "clearTimeout", (id?: number) => {
      if (id !== undefined) pending.delete(id);
      clear(id);
    });
    Reflect.set(window, "__deliveryTimers", () => pending.size);
  });
  const random = page.getByRole("button", {
    name: "Semana aleatoria",
    exact: true,
  });
  for (let i = 0; i < 6; i++) {
    const old = await page.locator(".postal-cargo").elementHandle();
    await random.click();
    expect(await old?.evaluate((n) => n.isConnected)).toBe(false);
    await old?.dispose();
    await expect(page.getByTestId("post-office")).toHaveAttribute(
      "data-phase",
      "flight",
    );
    expect(
      await page.evaluate(() => Reflect.get(window, "__deliveryTimers")()),
    ).toBeLessThanOrEqual(5);
  }
  await expect(page.locator(".postal-jealous-brow")).toBeVisible();
  await page
    .getByRole("link", { name: "Historia completa", exact: true })
    .click();
  await expect(page.getByTestId("post-office")).toHaveCount(0);
  expect(
    await page.evaluate(() => Reflect.get(window, "__deliveryTimers")()),
  ).toBe(0);
});

test("latest selection wins even with missing animation completion events", async ({
  page,
}) => {
  await installJournalFixtures(page);
  await page.goto("/");
  await expect(page.getByTestId("quality-message")).toBeVisible();
  await page.addStyleTag({
    content: ".postal-cargo, .postal-cargo * { animation: none !important; }",
  });
  const previous = page.getByRole("button", {
    name: "Semana anterior",
    exact: true,
  });
  const next = page.getByRole("button", {
    name: "Semana siguiente",
    exact: true,
  });
  for (let i = 0; i < 8; i++) {
    await previous.click();
    await next.click();
  }
  await next.click();
  await expect(page.getByTestId("week-context")).toHaveText("Semana 26 / 2026");
  await expect(page.getByTestId("quality-message")).toBeVisible();
  await expect(page.getByTestId("quality-message")).toHaveText(
    "Tu alegría cambia el paisaje.",
  );
  await expect(page.getByTestId("post-office")).toHaveAttribute(
    "data-phase",
    "complete",
  );
  await expect(page.locator(".postal-cargo")).toHaveCount(1);
});

test("natural phone and desktop delivery evidence includes flight, fold, paper and stamp", async ({
  browser,
}, info) => {
  test.setTimeout(60000);
  const dir = "playwright-report/fish-delivery";
  await mkdir(dir, { recursive: true });
  const viewport = info.project.use.viewport ?? { width: 390, height: 844 };
  const context = await browser.newContext({
    baseURL: info.project.use.baseURL,
    viewport,
    reducedMotion: "no-preference",
    timezoneId: "Europe/Madrid",
    recordVideo: { dir: `${dir}/video`, size: viewport },
  });
  const page = await context.newPage();
  await installJournalFixtures(page);
  await page.goto("/?time=day");
  const scene = page.getByTestId("post-office");
  await expect(scene.getByTestId("quality-message")).toBeVisible();
  await expect(scene).toHaveAttribute("data-phase", "complete");
  await page.evaluate(() => document.fonts.ready);
  const records = [];
  // Each frame uses a fresh real delivery, so screenshot encoding cannot skip
  // the next short-lived phase. The complete runs remain in the actual video.
  for (const phase of ["flight", "land", "fold", "open", "stamp", "complete"]) {
    for (const [action, direction] of [
      ["Semana anterior", -1],
      ["Semana siguiente", 1],
    ] as const) {
      await page.getByRole("button", { name: action, exact: true }).click();
      await page.waitForFunction(
        ({ phase }) => {
          const scene = document.querySelector(".postal-scene");
          if (scene?.getAttribute("data-phase") !== phase) return false;
          const selector =
            phase === "fold"
              ? ".postal-flap"
              : phase === "open"
                ? ".postal-paper"
                : phase === "stamp"
                  ? ".postal-cup-seal"
                  : ".postal-cargo";
          const minimumTime =
            phase === "flight"
              ? 300
              : phase === "fold"
                ? 1400
                : phase === "open"
                  ? 1780
                  : phase === "stamp"
                    ? 2380
                    : 0;
          return (
            phase === "complete" ||
            Number(
              scene.querySelector(selector)?.getAnimations()[0]?.currentTime ??
                0,
            ) >= minimumTime
          );
        },
        { phase },
        { polling: "raf" },
      );
      const geometry = await scene.evaluate((n) => {
        const css = (selector: string) => {
          const element = n.querySelector(selector);
          if (!element) throw new Error(`Missing delivery part ${selector}`);
          return getComputedStyle(element);
        };
        const cargo = css(".postal-cargo");
        return {
          phase: n.getAttribute("data-phase"),
          cargo: cargo.transform,
          travelX: new DOMMatrix(cargo.transform).m41,
          flap: css(".postal-flap").transform,
          paper: css(".postal-paper").transform,
          paperVisibility: css(".postal-paper").visibility,
          frontOpacity: css(".postal-envelope-front").opacity,
          seal: css(".postal-cup-seal").transform,
        };
      });
      records.push({ direction, ...geometry });
      await page.screenshot({
        path: `${dir}/${info.project.name}-${direction}-${phase}.png`,
      });
      if (phase === "flight") {
        expect(geometry.paperVisibility).toBe("hidden");
        expect(geometry.frontOpacity).toBe("1");
        expect(geometry.cargo).toMatch(/matrix/);
        expect(Math.sign(geometry.travelX)).toBe(direction === 1 ? 1 : -1);
      }
      if (phase === "stamp") {
        expect(geometry.seal).not.toBe(
          "matrix(0.913545, 0.406737, -0.406737, 0.913545, 0, 0)",
        );
      }
    }
  }
  for (const theme of ["day", "night"]) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/?time=${theme}`);
    await expect(scene.getByTestId("quality-message")).toBeVisible();
    await expect(scene.locator(".postal-cargo")).toHaveCSS("transform", "none");
    await page.screenshot({
      path: `${dir}/${info.project.name}-${theme}-reduced.png`,
      fullPage: true,
    });
  }
  await writeFile(
    `${dir}/${info.project.name}-geometry.json`,
    JSON.stringify(records, null, 2),
  );
  const video = page.video();
  await context.close();
  await video?.saveAs(`${dir}/${info.project.name}-normal-delivery.webm`);
});

test("skip retains focus and live reduced motion settles the real letter", async ({
  page,
}) => {
  await installJournalFixtures(page);
  await page.goto("/");
  await expect(page.getByTestId("quality-message")).toBeVisible();
  await page
    .getByRole("button", { name: "Semana anterior", exact: true })
    .click();
  const skip = page.getByRole("button", {
    name: "Saltar animación",
    exact: true,
  });
  await skip.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Repetir entrega", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".postal-cargo")).toHaveCSS("transform", "none");
  await page
    .getByRole("button", { name: "Semana siguiente", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByTestId("quality-message")).toBeVisible();
  await expect(page.locator(".postal-cargo")).toHaveCSS("transform", "none");
  await expect(page.locator(".postal-paper")).not.toHaveAttribute("inert", "");
  expect(
    await page
      .locator(".postal-cargo")
      .evaluate(
        (n) =>
          n
            .getAnimations({ subtree: true })
            .filter((a) => a.playState === "running").length,
      ),
  ).toBe(0);
});

test("320px long paper reserves its real height and hidden controls are inert until opened", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await installJournalFixtures(page, {
    qualities: [
      {
        week: 25,
        year: 2026,
        message: "Te quiero incluso cuando el pez solicita vacaciones. ".repeat(
          40,
        ),
      },
    ],
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const scene = page.getByTestId("post-office");
  const message = scene.getByTestId("quality-message");
  await expect(message).toBeVisible();
  await expect(scene).toHaveAttribute("data-running", "false");
  await page.evaluate(() => document.fonts.ready);
  await expect(message).toHaveCSS("visibility", "visible");
  const before = await scene.boundingBox();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page
    .getByRole("button", { name: "Repetir entrega", exact: true })
    .click();
  await expect(scene.locator(".postal-paper")).toHaveAttribute("inert", "");
  await expect(
    page.getByRole("button", { name: "Hacer bailar el mensaje", exact: true }),
  ).toHaveCount(0);
  const during = await scene.boundingBox();
  expect(during?.height).toBe(before?.height);
  const skip = page.getByRole("button", {
    name: "Saltar animación",
    exact: true,
  });
  await skip.focus();
  await expect(scene).toHaveAttribute("data-phase", "complete");
  await expect(
    page.getByRole("button", { name: "Repetir entrega", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Hacer bailar el mensaje", exact: true }),
  ).toHaveCount(1);
  expect((await scene.boundingBox())?.height).toBe(before?.height);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  expect((await message.boundingBox())?.y).toBeLessThan(500);
});

test("error feedback is static and only resolved retry begins a real sealed delivery", async ({
  page,
}) => {
  await installJournalFixtures(page, { qualityStatus: 500 });
  await page.goto("/");
  const scene = page.getByTestId("post-office");
  await expect(
    page.getByRole("button", { name: "Reintentar", exact: true }),
  ).toBeVisible();
  await expect(scene).toHaveAttribute("data-running", "false");
  await expect(scene.locator(".postal-cargo")).toHaveCSS("transform", "none");
  expect(
    await scene
      .locator(".postal-cargo")
      .evaluate(
        (n) =>
          n
            .getAnimations({ subtree: true })
            .filter((a) => a.playState === "running").length,
      ),
  ).toBe(0);
  await page.route("**/api/quality", (route) =>
    route.fulfill({
      json: {
        qualities: [
          { week: 25, year: 2026, message: "El pez ya tiene tu carta." },
        ],
      },
    }),
  );
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(scene).toHaveAttribute("data-phase", "flight");
  await expect(scene.locator(".postal-paper")).toHaveAttribute("inert", "");
  await expect(scene.getByText("ENTREGADA", { exact: true })).toHaveCount(0);
  await expect(scene.getByTestId("quality-message")).toBeVisible();
  await expect(scene.getByTestId("quality-message")).toHaveText(
    "El pez ya tiene tu carta.",
  );
});

test("keyboard navigation to a missing letter does not orphan skip focus", async ({
  page,
}) => {
  await installJournalFixtures(page, {
    qualities: [{ week: 25, year: 2026, message: "Una carta de verdad." }],
  });
  await page.goto("/");
  await expect(page.getByTestId("quality-message")).toBeVisible();
  const control = page.locator(".postal-skip");
  await control.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("week-context")).toHaveText("Semana 26 / 2026");
  await expect(control).toBeFocused();
  await expect(control).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId("post-office")).toHaveAttribute(
    "data-running",
    "false",
  );
  await page.keyboard.press("Enter");
  await expect(page.locator(".postal-cargo")).toHaveCSS("transform", "none");
});

test("replacement delivery restarts the real teacup stamp rather than reusing an ended gesture", async ({
  page,
}) => {
  await installJournalFixtures(page);
  await page.goto("/");
  await expect(page.getByTestId("post-office")).toHaveAttribute(
    "data-phase",
    "complete",
  );
  await page
    .getByRole("button", { name: "Semana anterior", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector(".postal-cup-seal")?.getAnimations()[0]
          ?.currentTime ?? 0,
      ) >= 1400,
    undefined,
    { polling: "raf" },
  );
  await page
    .getByRole("button", { name: "Semana siguiente", exact: true })
    .click();
  const seal = page.locator(".postal-cup-seal");
  const elapsed = await seal.evaluate((n) =>
    Number(n.getAnimations()[0]?.currentTime ?? Infinity),
  );
  expect(elapsed).toBeLessThan(250);
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector(".postal-cup-seal")?.getAnimations()[0]
          ?.currentTime ?? 0,
      ) >= 2400,
    undefined,
    { polling: "raf" },
  );
  expect(await seal.evaluate((n) => getComputedStyle(n).transform)).not.toBe(
    "matrix(0.913545, 0.406737, -0.406737, 0.913545, 0, 0)",
  );
});
