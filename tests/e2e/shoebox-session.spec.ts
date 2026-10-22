import { expect, type Page, type Route, test } from "@playwright/test";
import { SYNTHETIC_PASSWORD } from "../helpers/shoebox-auth";
import { instrumentMicrophone, LOGIN_PATH, mic } from "./shoebox.fixture";
import {
  apiError,
  openArchive,
  scraps,
  syntheticMemory,
  syntheticSet,
} from "./shoebox-archive.fixture";

// Session gate and negative UI paths. Login is real; expiry is simulated with
// the fake clock plus a routed 401 from the session check. Synthetic data only.

test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  },
  permissions: ["microphone"],
});

const UNAUTHORIZED = {
  status: 401,
  contentType: "application/json",
  body: JSON.stringify({
    error: { code: "UNAUTHORIZED", message: "x", diagnosticId: "d" },
  }),
};

/**
 * A real expiry: the cookie stops opening anything (the login page would
 * otherwise send a still-valid session straight back), and from now on GET
 * /api/shoebox/session answers 401. POST stays real.
 */
async function expireSession(page: Page, { keepCookie = false } = {}) {
  if (!keepCookie) await page.context().clearCookies();
  await page.route("**/api/shoebox/session", (route) =>
    route.request().method() === "GET"
      ? route.fulfill(UNAUTHORIZED)
      : route.fallback(),
  );
}

async function setVisibility(page: Page, state: "hidden" | "visible") {
  return page.evaluate((value) => {
    Object.defineProperty(document, "visibilityState", {
      value,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    // Synchronously, before any React work: is private content still painted?
    const node = document.querySelector("[data-memory-id]");
    return node ? getComputedStyle(node).visibility : "absent";
  }, state);
}

const composer = (page: Page) =>
  page.getByRole("dialog", { name: "Algo nuevo para la caja" });

async function playFirstAudio(page: Page) {
  const audio = page.locator("[data-memory-id] audio").first();
  await audio.evaluate((el: HTMLAudioElement) => el.play());
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => !el.paused))
    .toBe(true);
  return audio;
}

test.describe("expiry", () => {
  test("confirmed expiry pauses playback, hides the archive and leaves through login", async ({
    page,
  }) => {
    await page.clock.install();
    // At the moment the page is left, is anything still audible or open?
    await page.addInitScript(() => {
      window.addEventListener("pagehide", () => {
        const audios = [...document.querySelectorAll("audio")];
        const playing = audios.filter((audio) => !audio.paused).length;
        const gate = document.documentElement.getAttribute("data-shoebox-gate");
        sessionStorage.setItem(
          "shoebox-test",
          `playing=${playing};gate=${gate}`,
        );
      });
    });
    await openArchive(page, [syntheticMemory(1, "audio"), syntheticMemory(2)]);
    await expect(scraps(page)).toHaveCount(2);
    await playFirstAudio(page);
    await expireSession(page);
    await page.clock.fastForward(170 * 3_600_000);
    await expect(page).toHaveURL(LOGIN_PATH);
    expect(
      await page.evaluate(() => sessionStorage.getItem("shoebox-test")),
    ).toBe("playing=0;gate=expired");
    await page.goBack();
    await expect(page.getByText("nota sintética número 2")).toHaveCount(0);
  });

  test("expiry while composing stops the microphone, hides the archive and keeps the draft", async ({
    page,
  }) => {
    await instrumentMicrophone(page);
    const api = await openArchive(page, syntheticSet(4));
    await expect(scraps(page)).toHaveCount(4);
    const posts: unknown[] = [];
    await page.route("**/api/shoebox/memories", (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      posts.push(route.request().postData());
      return route.fulfill(apiError(503, "UNAVAILABLE") as never);
    });
    await page.getByRole("button", { name: "Meter algo en la caja" }).click();
    await composer(page).getByRole("radio", { name: "Audio" }).check();
    await composer(page).getByRole("button", { name: "Grabar" }).click();
    await expect(composer(page).getByText("Grabando")).toBeVisible();
    await page.waitForTimeout(1_200);

    // The session ends while recording; a revalidation finds out. (pageshow
    // itself does not stop a recording, unlike a hidden tab.)
    await expireSession(page, { keepCookie: true });
    await page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      ),
    );
    await expect(composer(page).getByLabel("Contraseña")).toBeVisible();
    await expect.poll(async () => (await mic(page)).live).toBe(0);
    await expect(scraps(page)).toHaveCount(0);
    await expect(page).toHaveURL("/shoebox");

    await page.unroute("**/api/shoebox/session");
    await composer(page).getByLabel("Contraseña").fill(SYNTHETIC_PASSWORD);
    await composer(page)
      .getByRole("button", { name: "Abrir otra vez" })
      .click();
    await expect(
      composer(page).getByRole("button", { name: "Guardar en la caja" }),
    ).toBeVisible();
    await expect(composer(page).locator("audio")).toHaveCount(1);
    await page.waitForTimeout(500);
    expect(posts).toHaveLength(0);
    expect((await mic(page)).calls).toBe(1);
    // The archive comes back only after the session is open again.
    await expect.poll(() => api.listCalls.length).toBeGreaterThanOrEqual(2);
  });

  test("a save-time 401 is session expiry for the host: the archive hides too", async ({
    page,
  }) => {
    const api = await openArchive(page, syntheticSet(3));
    await expect(scraps(page)).toHaveCount(3);
    await page.route("**/api/shoebox/memories", (route) =>
      route.request().method() === "POST"
        ? route.fulfill(apiError(401, "UNAUTHORIZED") as never)
        : route.fallback(),
    );
    await page.getByRole("button", { name: "Meter algo en la caja" }).click();
    await composer(page).getByRole("radio", { name: "Texto" }).check();
    await composer(page).getByLabel("Lo que pasó").fill("borrador sintético");
    await composer(page)
      .getByRole("button", { name: "Guardar en la caja" })
      .click();
    await expect(composer(page).getByLabel("Contraseña")).toBeVisible();
    await expect(scraps(page)).toHaveCount(0);
    await composer(page).getByLabel("Contraseña").fill(SYNTHETIC_PASSWORD);
    await composer(page)
      .getByRole("button", { name: "Abrir otra vez" })
      .click();
    await expect(composer(page).getByLabel("Lo que pasó")).toHaveValue(
      "borrador sintético",
    );
    await expect.poll(() => api.listCalls.length).toBeGreaterThanOrEqual(2);
  });

  test("a late list result after expiry never reveals anything", async ({
    page,
  }) => {
    await page.clock.install();
    const records = syntheticSet(3);
    const api = await openArchive(page, records);
    await expect(scraps(page)).toHaveCount(3);
    api.listReplies.push("hold");
    await page.getByRole("button", { name: "Volver al principio" }).click();
    await expect.poll(() => api.held.length).toBe(1);
    // A composer keeps the page here after expiry.
    await page.getByRole("button", { name: "Meter algo en la caja" }).click();
    await expireSession(page);
    await page.clock.fastForward(170 * 3_600_000);
    await expect(composer(page).getByLabel("Contraseña")).toBeVisible();
    await expect(scraps(page)).toHaveCount(0);
    for (const route of api.held.splice(0)) {
      await route
        .fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: records, nextCursor: null }),
        })
        .catch(() => {});
    }
    await page.waitForTimeout(300);
    await expect(scraps(page)).toHaveCount(0);
    await expect(page.getByText("nota sintética número 1")).toHaveCount(0);
  });
});

test.describe("visibility, bfcache and the checking gate", () => {
  test("a successful visibility recheck does not strand an in-flight correction", async ({
    page,
  }) => {
    const original = syntheticMemory(1);
    const api = await openArchive(page, [original]);
    api.patchReply = () => "hold";
    await scraps(page)
      .getByRole("button", { name: /Corregir/ })
      .click();
    const form = page.getByRole("dialog", { name: "Corregir el recuerdo" });
    await form.getByLabel("Lo que pasó").fill("corrección de la misma sesión");
    await form.getByRole("button", { name: "Guardar la corrección" }).click();
    await expect.poll(() => api.held.length).toBe(1);
    await setVisibility(page, "hidden");
    await setVisibility(page, "visible");
    await expect(form).toBeVisible();
    await api.held[0]?.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        memory: { ...original, text: "corrección de la misma sesión" },
      }),
    });
    await expect(form).toHaveCount(0);
    await expect(scraps(page)).toContainText("corrección de la misma sesión");
  });

  test("the synchronous gate also hides a saved excerpt and backdated detail action", async ({
    page,
  }) => {
    await openArchive(page, syntheticSet(13));
    const memory = syntheticMemory(900, "text", { memoryDate: "2001-02-03" });
    await page.route("**/api/shoebox/memories", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({ memory, replayed: false }),
          })
        : route.fallback(),
    );
    await page.getByRole("button", { name: "Meter algo en la caja" }).click();
    await composer(page).getByRole("radio", { name: "Texto" }).check();
    await composer(page)
      .getByLabel("Lo que pasó")
      .fill("borrador sintético antiguo");
    await composer(page)
      .getByRole("button", { name: "Guardar en la caja" })
      .click();
    await expect(
      page.getByRole("button", { name: "Ver recuerdo" }),
    ).toBeVisible();
    await setVisibility(page, "hidden");
    await expect(
      page.getByRole("button", { name: "Ver recuerdo" }),
    ).toBeHidden();
    await expect(page.getByText(/Guardado en la caja:/)).toBeHidden();
  });

  test("a hidden tab hides private content synchronously and revalidates before reveal", async ({
    page,
  }) => {
    await openArchive(page, syntheticSet(3));
    await expect(scraps(page)).toHaveCount(3);
    expect(await setVisibility(page, "hidden")).toBe("hidden");

    const held: Route[] = [];
    await page.route("**/api/shoebox/session", (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      held.push(route);
    });
    await setVisibility(page, "visible");
    await expect.poll(() => held.length).toBe(1);
    await expect(
      page.getByText("Comprobando que la caja sigue abierta"),
    ).toBeVisible();
    await expect(page.getByText("nota sintética número 1")).toBeHidden();
    await page.unroute("**/api/shoebox/session");
    await held[0]?.fallback();
    await expect(page.getByText("nota sintética número 1")).toBeVisible();
  });

  test("a network failure on the session check fails closed", async ({
    page,
  }) => {
    await openArchive(page, syntheticSet(2));
    await expect(scraps(page)).toHaveCount(2);
    await page.route("**/api/shoebox/session", (route) =>
      route.request().method() === "GET" ? route.abort() : route.fallback(),
    );
    await setVisibility(page, "hidden");
    await setVisibility(page, "visible");
    await expect(
      page.getByRole("alert").filter({ hasText: "No pudimos comprobar" }),
    ).toBeVisible();
    await expect(page.getByText("nota sintética número 1")).toBeHidden();
    await page.unroute("**/api/shoebox/session");
    await page.getByRole("button", { name: "Comprobar otra vez" }).click();
    await expect(page.getByText("nota sintética número 1")).toBeVisible();
  });

  test("pagehide closes the gate before bfcache; pageshow keeps it closed until a valid check", async ({
    page,
  }) => {
    await openArchive(page, syntheticSet(2));
    await expect(scraps(page)).toHaveCount(2);
    await page.getByRole("button", { name: "Meter algo en la caja" }).click();
    await composer(page).getByRole("radio", { name: "Texto" }).check();
    await composer(page)
      .getByLabel("Lo que pasó")
      .fill("borrador de esta pestaña");
    const hidden = await page.evaluate(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: true }),
      );
      const dialog = document.querySelector("dialog[open]");
      return dialog ? getComputedStyle(dialog).visibility : "absent";
    });
    expect(hidden).toBe("hidden");
    await expect(scraps(page)).toHaveCount(0);

    await page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      ),
    );
    await expect(composer(page).getByLabel("Lo que pasó")).toHaveValue(
      "borrador de esta pestaña",
    );
    await expect(composer(page).getByLabel("Lo que pasó")).toBeVisible();
    await composer(page).getByRole("button", { name: "Cerrar" }).click();
    await page.getByRole("button", { name: "Tirar el borrador" }).click();
    await expect(scraps(page)).toHaveCount(2);
  });

  test("pageshow after the session ended goes to login without revealing", async ({
    page,
  }) => {
    await openArchive(page, syntheticSet(2));
    await expect(scraps(page)).toHaveCount(2);
    await expireSession(page);
    await page.evaluate(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: true }),
      );
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      );
    });
    await expect(page).toHaveURL(LOGIN_PATH);
  });
});

test.describe("logout and dialogs", () => {
  test("a correction finishing after expiry and reauthentication cannot overwrite the new batch", async ({
    page,
  }) => {
    const original = syntheticMemory(1);
    const api = await openArchive(page, [original]);
    await expect(scraps(page)).toHaveCount(1);
    api.patchReply = () => "hold";
    await scraps(page)
      .getByRole("button", { name: /Corregir/ })
      .click();
    const correction = page.getByRole("dialog", {
      name: "Corregir el recuerdo",
    });
    await correction
      .getByLabel("Lo que pasó")
      .fill("respuesta sintética obsoleta");
    await correction
      .getByRole("button", { name: "Guardar la corrección" })
      .click();
    await expect.poll(() => api.held.length).toBe(1);
    await correction.getByRole("button", { name: "Cerrar" }).click();
    await page.getByRole("button", { name: "Meter algo en la caja" }).click();
    await expireSession(page, { keepCookie: true });
    await page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      ),
    );
    await expect(composer(page).getByLabel("Contraseña")).toBeVisible();
    await page.unroute("**/api/shoebox/session");
    await composer(page).getByLabel("Contraseña").fill(SYNTHETIC_PASSWORD);
    await composer(page)
      .getByRole("button", { name: "Abrir otra vez" })
      .click();
    await expect(scraps(page)).toHaveCount(1);
    await api.held[0]?.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        memory: { ...original, text: "respuesta sintética obsoleta" },
      }),
    });
    await composer(page).getByRole("button", { name: "Cerrar" }).click();
    await expect(scraps(page)).toContainText("nota sintética número 1");
    await expect(page.getByText("respuesta sintética obsoleta")).toHaveCount(0);
  });

  test("logout is a full navigation that clears everything; back shows nothing stale", async ({
    page,
  }) => {
    await openArchive(page, syntheticSet(3));
    await expect(scraps(page)).toHaveCount(3);
    await page.evaluate(() => {
      (window as unknown as { __spa: boolean }).__spa = true;
    });
    await page.getByRole("button", { name: "Cerrar la caja" }).click();
    await expect(page).toHaveURL(LOGIN_PATH);
    expect(
      await page.evaluate(
        () => (window as unknown as { __spa?: boolean }).__spa,
      ),
    ).toBeUndefined();
    await page.goBack();
    await expect(page.getByText("nota sintética número 1")).toHaveCount(0);
  });

  test("one native dialog at a time; AMOR stays inert while composing", async ({
    page,
  }) => {
    await openArchive(page, syntheticSet(2));
    await page.getByRole("button", { name: "Meter algo en la caja" }).click();
    await expect(composer(page)).toBeVisible();
    await composer(page).getByRole("button", { name: "Cerrar" }).focus();
    await page.keyboard.type("amor");
    await page.waitForTimeout(200);
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    await composer(page).getByRole("radio", { name: "Texto" }).check();
    await composer(page).getByLabel("Lo que pasó").type("amor");
    await expect(page.locator("dialog[open]")).toHaveCount(1);
  });
});
