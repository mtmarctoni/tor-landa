import { expect, test } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import IpadPromiseCertificate from "../../src/components/IpadPromiseCertificate";
import { ipadCountdownConfig } from "../../src/data/ipadCountdown";
import { deriveIpadCountdown } from "../../src/utils/ipadCountdown";

const reveal = Date.parse("2026-10-22T22:00:00Z");
const inline = Date.parse("2026-10-23T22:00:00Z");
const target = Date.parse("2026-11-26T23:00:00Z");
const model = (now: number, config: unknown = ipadCountdownConfig) =>
  deriveIpadCountdown(config, now);

for (const variant of ["full", "compact"] as const) {
  test(`${variant} certificate keeps time readable without tick announcements`, async ({
    page,
  }) => {
    const value = model(target - 90_061 * 1000);
    await page.setContent(
      renderToStaticMarkup(
        createElement(IpadPromiseCertificate, { model: value, variant }),
      ),
    );
    const certificate = page.getByRole("region", {
      name: "Departamento de Promesas Pendientes",
      exact: true,
    });
    await expect(certificate).toContainText(
      "1 día, 1 hora y 2 minutos para salir a buscarlo.",
    );
    await expect(certificate).toContainText(
      "27 noviembre 2026 · 00:00 · hora de Palma",
    );
    await expect(certificate).toContainText(
      "Esperamos ofertas. No las fabricamos.",
    );
    expect(await certificate.locator("[aria-live]").count()).toBe(0);
    expect(await certificate.getByRole("button").count()).toBe(0);
  });
  for (const [now, config, heading, body] of [
    [
      target,
      ipadCountdownConfig,
      "Se abre el plazo de cumplir la promesa.",
      "Hoy toca buscar tu iPad.",
    ],
    [
      Date.parse("2027-01-01T00:00:00Z"),
      ipadCountdownConfig,
      "Se abre el plazo de cumplir la promesa.",
      "Ya podemos buscar tu iPad.",
    ],
    [
      inline,
      { ...ipadCountdownConfig, purchaseStatus: "purchased" },
      "Comprado. El departamento puede respirar.",
      "Tu iPad ya está comprado.",
    ],
    [
      inline,
      { ...ipadCountdownConfig, targetAt: "wrong" },
      "La promesa sigue en pie.",
      "El reloj está de papeleo.",
    ],
  ] as const) {
    test(`${variant} truthful settled state ${heading} ${now}`, async ({
      page,
    }) => {
      await page.setContent(
        renderToStaticMarkup(
          createElement(IpadPromiseCertificate, {
            model: model(now, config),
            variant,
          }),
        ),
      );
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      await expect(page.locator("body")).toContainText(body);
      expect(await page.locator("[data-ipad-timer]").count()).toBe(0);
      await expect(page.locator("body")).not.toContainText("NaN");
      await expect(page.locator("body")).not.toContainText("falta que llegue");
    });
  }
}

for (const [instant, placement] of [
  [reveal - 1, "hidden"],
  [reveal, "reveal"],
  [reveal + 1, "reveal"],
  [inline - 1, "reveal"],
  [inline, "inline"],
  [inline + 1, "inline"],
] as const) {
  test(`release placement at ${instant}`, () => {
    expect(model(instant).placement).toBe(placement);
  });
}
for (const [before, remaining] of [
  [1, { days: 0, hours: 0, minutes: 1 }],
  [60_000, { days: 0, hours: 0, minutes: 1 }],
  [60_001, { days: 0, hours: 0, minutes: 2 }],
  [86_400_000, { days: 1, hours: 0, minutes: 0 }],
] as const) {
  test(`remaining rounds upward ${before}ms before shopping`, () => {
    expect(model(target - before)).toMatchObject({
      content: "pending",
      remaining,
    });
  });
}
for (const now of [target, target + 1, Date.parse("2027-11-01T12:00:00Z")]) {
  test(`no negative timer or annual recurrence at ${now}`, () => {
    expect(model(now)).toMatchObject({
      placement: "inline",
      content: "shopping-open",
      remaining: null,
    });
  });
}
test("Palma target label, day boundary and DST use instants", () => {
  expect(model(Date.parse("2026-10-24T22:00:00Z")).remaining).toEqual({
    days: 33,
    hours: 1,
    minutes: 0,
  });
  expect(model(target).targetLabel).toBe(
    "27 noviembre 2026 · 00:00 · hora de Palma",
  );
  expect(model(Date.parse("2026-11-27T22:59:59.999Z")).isTargetDay).toBe(true);
  expect(model(Date.parse("2026-11-27T23:00:00Z"))).toMatchObject({
    isTargetDay: false,
    nextBoundaryAt: null,
  });
});
test("next date boundary never runs backward", () => {
  for (const [now, boundary] of [
    [reveal - 1, reveal],
    [reveal, inline],
    [inline, target],
    [target, Date.parse("2026-11-27T23:00:00Z")],
  ] as const) {
    expect(model(now).nextBoundaryAt).toBe(boundary);
  }
});
test("purchase overrides time, never the surprise release", () => {
  const config = { ...ipadCountdownConfig, purchaseStatus: "purchased" };
  expect(model(reveal - 1, config).placement).toBe("hidden");
  for (const now of [reveal, inline, target - 1, target + 1]) {
    expect(model(now, config)).toMatchObject({
      content: "purchased",
      remaining: null,
    });
  }
  expect(model(inline, config).nextBoundaryAt).toBeNull();
});
for (const config of [
  undefined,
  null,
  {},
  { ...ipadCountdownConfig, revealAt: "wrong" },
  { ...ipadCountdownConfig, inlineAt: "2026-10-21T00:00:00Z" },
]) {
  test(`missing/invalid release fails closed ${JSON.stringify(config)}`, () => {
    expect(deriveIpadCountdown(config, inline)).toMatchObject({
      placement: "hidden",
      remaining: null,
      nextBoundaryAt: null,
    });
  });
}
for (const change of [
  { targetAt: undefined },
  { targetAt: "invalid" },
  { targetAt: "2026-11-27T00:00:00" },
  { targetAt: "2026-02-30T00:00:00Z" },
  { targetAt: "2026-11-31T00:00:00Z" },
  { targetAt: "2026-10-22T00:00:00Z" },
  { timeZone: "Mars/Olympus" },
  { timeZone: undefined },
  { purchaseStatus: "maybe" },
  { purchaseStatus: { toString: () => "purchased" } },
]) {
  test(`invalid config cannot claim a purchase ${Object.keys(change)} ${JSON.stringify(change)}`, () => {
    const config = { ...ipadCountdownConfig, ...change };
    expect(model(reveal - 1, config).placement).toBe("hidden");
    expect(model(inline, config)).toMatchObject({
      placement: "inline",
      content: "invalid",
      remaining: null,
      targetLabel: null,
      nextBoundaryAt: null,
    });
  });
}
test("nonfinite clocks fail closed", () => {
  for (const now of [NaN, Infinity, -Infinity])
    expect(model(now).placement).toBe("hidden");
});
test("model does not adopt process timezone", () => {
  const previous = process.env.TZ;
  try {
    for (const zone of [
      "Europe/Madrid",
      "UTC",
      "America/New_York",
      "Asia/Tokyo",
    ]) {
      process.env.TZ = zone;
      expect(model(target - 60_001)).toMatchObject({
        content: "pending",
        remaining: { days: 0, hours: 0, minutes: 2 },
        targetLabel: "27 noviembre 2026 · 00:00 · hora de Palma",
      });
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
