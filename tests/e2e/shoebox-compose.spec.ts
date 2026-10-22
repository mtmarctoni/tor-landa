import { readFileSync } from "node:fs";
import { expect, type Page, type Route, test } from "@playwright/test";
import { SYNTHETIC_PASSWORD } from "../helpers/shoebox-auth";
import {
  type CapturedCreate,
  LOGIN_PATH,
  loginThroughUi,
  openComposer,
  parseCreate,
} from "./shoebox.fixture";

// Login and session are real. Only the memory create and request-status APIs
// are routed to synthetic responses, because the local server cannot reach
// Notion. Every string below is synthetic.

const SECRET_TEXT = "pez-luna sintético que cruza la calle";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const AUDIO = readFileSync("tests/fixtures/shoebox/audio-webm-opus-2s.webm");

type Reply =
  | { status: number; json?: unknown; text?: string; contentType?: string }
  | "hold";

function memoryFor(post: CapturedCreate) {
  return {
    id: "0f0f0f0f-0000-4000-8000-0000000000aa",
    kind: post.metadata.kind,
    text: post.metadata.text,
    caption: post.metadata.caption,
    memoryDate: post.metadata.memoryDate,
    createdAt: "2026-10-21T10:00:00.000Z",
  };
}

const apiError = (status: number, code: string) => ({
  status,
  json: { error: { code, message: "x", diagnosticId: "d-1" } },
});

/** Routes POST /memories and GET /requests/:id; returns the captured calls. */
async function mockApi(
  page: Page,
  options: {
    create: (post: CapturedCreate, index: number) => Reply;
    status?: (index: number, posts: CapturedCreate[]) => Reply;
  },
) {
  const posts: CapturedCreate[] = [];
  const statusChecks: string[] = [];
  const held: Route[] = [];
  await page.route("**/api/shoebox/memories", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    const post = parseCreate(
      request.postDataBuffer() ?? Buffer.alloc(0),
      request.headers()["content-type"] ?? "",
    );
    posts.push(post);
    const reply = options.create(post, posts.length - 1);
    if (reply === "hold") {
      held.push(route);
      return;
    }
    await fulfill(route, reply);
  });
  await page.route("**/api/shoebox/requests/*", async (route) => {
    statusChecks.push(new URL(route.request().url()).pathname);
    const reply = options.status?.(statusChecks.length - 1, posts) ?? {
      status: 200,
      json: { state: "not_found" },
    };
    if (reply === "hold") return;
    await fulfill(route, reply);
  });
  return { posts, statusChecks, held };
}

async function fulfill(route: Route, reply: Exclude<Reply, "hold">) {
  await route.fulfill({
    status: reply.status,
    contentType:
      reply.contentType ??
      (reply.text === undefined ? "application/json" : "text/plain"),
    body: reply.text ?? JSON.stringify(reply.json ?? {}),
  });
}

const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Algo nuevo para la caja" });

async function writeText(page: Page, text = SECRET_TEXT) {
  await dialog(page).getByRole("radio", { name: "Texto" }).check();
  await dialog(page).getByLabel("Lo que pasó").fill(text);
}

const saveButton = (page: Page) =>
  dialog(page).getByRole("button", { name: "Guardar en la caja" });

test.describe("composer basics", () => {
  test("offers Foto/Audio/Texto and defaults the date to the local calendar day near UTC rollover", async ({
    page,
  }) => {
    // 23:30 UTC on 1 March is already 2 March in Europe/Madrid.
    await page.clock.setFixedTime(new Date("2026-03-01T23:30:00Z"));
    await openComposer(page);
    for (const name of ["Foto", "Audio", "Texto"]) {
      await expect(dialog(page).getByRole("radio", { name })).toBeVisible();
    }
    await expect(
      dialog(page).getByRole("radio", { name: "Foto" }),
    ).toBeFocused();
    await dialog(page).getByRole("radio", { name: "Texto" }).check();
    await expect(dialog(page).getByLabel("Fecha")).toHaveValue("2026-03-02");
    await expect(dialog(page).getByLabel("Fecha")).toHaveAttribute(
      "type",
      "date",
    );
  });

  test("Save stays disabled while invalid, nothing uploads before Save, and a double tap sends one POST", async ({
    page,
  }) => {
    const api = await mockApi(page, {
      create: (post) => ({
        status: 201,
        json: { memory: memoryFor(post), replayed: false },
      }),
    });
    await openComposer(page);
    await dialog(page).getByRole("radio", { name: "Texto" }).check();
    await expect(saveButton(page)).toBeDisabled();
    await dialog(page).getByLabel("Lo que pasó").fill("   ");
    await expect(saveButton(page)).toBeDisabled();
    await writeText(page);
    await dialog(page).getByLabel("Pie (opcional)").fill("x".repeat(501));
    await expect(saveButton(page)).toBeDisabled();
    await dialog(page).getByLabel("Pie (opcional)").fill("pie sintético");
    await expect(saveButton(page)).toBeEnabled();
    expect(api.posts).toHaveLength(0);

    await saveButton(page).dblclick();
    await expect(
      page.getByRole("status").filter({ hasText: "Guardado en la caja" }),
    ).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);
    expect(api.posts).toHaveLength(1);
    const [post] = api.posts;
    expect(post?.file).toBeNull();
    expect(post?.metadata).toMatchObject({
      kind: "text",
      text: SECRET_TEXT,
      caption: "pie sintético",
    });
    expect(String(post?.metadata.requestId)).toMatch(UUID);
    // The focus returns to the stable add button.
    await expect(
      page.getByRole("button", { name: "Meter algo en la caja" }),
    ).toBeFocused();
  });

  test("an uploaded audio file previews locally without autoplay and is sent only on Save", async ({
    page,
  }) => {
    const api = await mockApi(page, {
      create: (post) => ({
        status: 201,
        json: {
          memory: {
            ...memoryFor(post),
            text: undefined,
            kind: "audio",
            mediaPath:
              "/api/shoebox/memories/0f0f0f0f-0000-4000-8000-0000000000aa/media",
            durationSeconds: 2,
            mimeType: "audio/webm",
          },
          replayed: false,
        },
      }),
    });
    await openComposer(page);
    await dialog(page).getByRole("radio", { name: "Audio" }).check();
    await dialog(page).getByLabel("Subir un audio").setInputFiles({
      name: "voz.webm",
      mimeType: "audio/webm",
      buffer: AUDIO,
    });
    const preview = dialog(page).locator("audio");
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute("preload", /metadata|none/);
    expect(
      await preview.evaluate(
        (el: HTMLAudioElement) => el.autoplay || !el.paused,
      ),
    ).toBe(false);
    expect(api.posts).toHaveLength(0);
    await saveButton(page).click();
    await expect(dialog(page)).toHaveCount(0);
    expect(api.posts).toHaveLength(1);
    expect(api.posts[0]?.metadata.kind).toBe("audio");
    expect(api.posts[0]?.file).toEqual({
      type: "audio/webm",
      size: AUDIO.byteLength,
    });
  });

  test("closing an unsaved draft asks inline first; Escape returns to the form", async ({
    page,
  }) => {
    await openComposer(page);
    // An untouched form closes at once.
    await dialog(page).getByRole("button", { name: "Cerrar" }).click();
    await expect(dialog(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Meter algo en la caja" }).click();
    await writeText(page);
    await page.keyboard.press("Escape");
    await expect(dialog(page).getByText("¿Tirar este borrador?")).toBeVisible();
    await expect(
      dialog(page).getByRole("button", { name: "Seguir editando" }),
    ).toBeFocused();
    // Only one dialog exists: the confirmation is a panel, not a nested modal.
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dialog(page).getByLabel("Lo que pasó")).toHaveValue(
      SECRET_TEXT,
    );

    await dialog(page).getByRole("button", { name: "Cerrar" }).click();
    await dialog(page)
      .getByRole("button", { name: "Tirar el borrador" })
      .click();
    await expect(dialog(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Meter algo en la caja" }).click();
    await dialog(page).getByRole("radio", { name: "Texto" }).check();
    await expect(dialog(page).getByLabel("Lo que pasó")).toHaveValue("");
  });

  test("a dirty draft registers a best-effort reload warning", async ({
    page,
  }) => {
    await openComposer(page);
    await writeText(page);
    const warned = await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(warned).toBe(true);
  });
});

test.describe("save failures follow the Task 5 contract", () => {
  test("a 401 keeps the in-memory draft, reauthenticates inline and waits for an explicit Save", async ({
    page,
  }) => {
    const api = await mockApi(page, {
      create: (post, index) =>
        index === 0
          ? apiError(401, "UNAUTHORIZED")
          : { status: 201, json: { memory: memoryFor(post), replayed: false } },
    });
    await openComposer(page);
    await writeText(page);
    await saveButton(page).click();
    const password = dialog(page).getByLabel("Contraseña");
    await expect(password).toBeVisible();
    await expect(password).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await password.fill(SYNTHETIC_PASSWORD);
    await dialog(page).getByRole("button", { name: "Abrir otra vez" }).click();
    await expect(dialog(page).getByLabel("Lo que pasó")).toHaveValue(
      SECRET_TEXT,
    );
    await page.waitForTimeout(500);
    expect(api.posts).toHaveLength(1);
    await saveButton(page).click();
    await expect(dialog(page)).toHaveCount(0);
    expect(api.posts).toHaveLength(2);
    // Nothing about the draft was persisted in browser storage.
    const stored = await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    );
    expect(stored).not.toContain("pez-luna");
  });

  test("a non-JSON 413 shows a clear size error and keeps the draft", async ({
    page,
  }) => {
    const api = await mockApi(page, {
      create: () => ({ status: 413, text: "Request Entity Too Large" }),
    });
    await openComposer(page);
    await writeText(page);
    await saveButton(page).click();
    await expect(dialog(page).getByText(/demasiado grande/)).toBeVisible();
    await expect(dialog(page).getByLabel("Lo que pasó")).toHaveValue(
      SECRET_TEXT,
    );
    await expect(saveButton(page)).toBeEnabled();
    expect(api.posts).toHaveLength(1);
  });

  test("corrupted JSON is uncertain and is reconciled by a read-only status poll", async ({
    page,
  }) => {
    const api = await mockApi(page, {
      create: () => ({
        status: 201,
        text: '{"memory": {',
        contentType: "application/json",
      }),
      status: (_index, posts) => ({
        status: 200,
        json: { state: "found", memory: memoryFor(posts[0] as CapturedCreate) },
      }),
    });
    await openComposer(page);
    await writeText(page);
    await saveButton(page).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Guardado en la caja" }),
    ).toBeVisible();
    expect(api.posts).toHaveLength(1);
    expect(api.statusChecks).toEqual([
      `/api/shoebox/requests/${api.posts[0]?.metadata.requestId}`,
    ]);
  });

  test("202 OUTCOME_UNKNOWN is never success: it polls, then offers a read-only check", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    let found = false;
    const api = await mockApi(page, {
      create: () => apiError(202, "OUTCOME_UNKNOWN"),
      status: (_index, posts) =>
        found
          ? {
              status: 200,
              json: {
                state: "found",
                memory: memoryFor(posts[0] as CapturedCreate),
              },
            }
          : { status: 200, json: { state: "not_found" } },
    });
    await openComposer(page);
    await writeText(page);
    await saveButton(page).click();
    await expect(
      dialog(page).getByText("Comprobando si llegó a la caja"),
    ).toBeVisible();
    await expect(page.getByText("Guardado en la caja")).toHaveCount(0);
    await expect(
      dialog(page).getByText("No sabemos todavía si se guardó"),
    ).toBeVisible({
      timeout: 15_000,
    });
    expect(api.statusChecks).toHaveLength(3);
    expect(api.posts).toHaveLength(1);
    // The uncertain draft is locked so its Request ID cannot silently change.
    await expect(dialog(page).getByLabel("Lo que pasó")).toBeDisabled();
    await expect(dialog(page).getByLabel("Lo que pasó")).toHaveValue(
      SECRET_TEXT,
    );

    found = true;
    await dialog(page)
      .getByRole("button", { name: "Comprobar de nuevo" })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Guardado en la caja" }),
    ).toBeVisible();
    expect(api.statusChecks).toHaveLength(4);
    expect(api.posts).toHaveLength(1);
  });

  test("Reintentar after an unknown outcome re-checks status, then resends the same Request ID", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const api = await mockApi(page, {
      create: (post, index) =>
        index === 0
          ? apiError(202, "OUTCOME_UNKNOWN")
          : { status: 200, json: { memory: memoryFor(post), replayed: true } },
    });
    await openComposer(page);
    await writeText(page);
    await saveButton(page).click();
    await expect(
      dialog(page).getByText("No sabemos todavía si se guardó"),
    ).toBeVisible({
      timeout: 15_000,
    });
    await dialog(page).getByRole("button", { name: "Reintentar" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Guardado en la caja" }),
    ).toBeVisible();
    expect(api.statusChecks).toHaveLength(4);
    expect(api.posts).toHaveLength(2);
    expect(api.posts[1]?.metadata).toEqual(api.posts[0]?.metadata);
  });

  test("409 with an ambiguous status shows recovery, keeps the draft and sends nothing more", async ({
    page,
  }) => {
    const api = await mockApi(page, {
      create: () => apiError(409, "REQUEST_CONFLICT"),
      status: () => ({ status: 200, json: { state: "ambiguous" } }),
    });
    await openComposer(page);
    await writeText(page);
    await saveButton(page).click();
    await expect(dialog(page).getByText(/más de una copia/)).toBeVisible();
    await expect(dialog(page).getByLabel("Lo que pasó")).toHaveValue(
      SECRET_TEXT,
    );
    await expect(saveButton(page)).toBeDisabled();
    await page.waitForTimeout(1_500);
    expect(api.posts).toHaveLength(1);
    expect(api.statusChecks).toHaveLength(1);
  });

  test("409 for an edited draft asks before saving it under a new Request ID", async ({
    page,
  }) => {
    const api = await mockApi(page, {
      create: (post, index) =>
        index === 0
          ? apiError(409, "REQUEST_CONFLICT")
          : { status: 201, json: { memory: memoryFor(post), replayed: false } },
      status: () => ({ status: 200, json: { state: "not_found" } }),
    });
    await openComposer(page);
    await writeText(page);
    await saveButton(page).click();
    await dialog(page)
      .getByRole("button", { name: "Guardar como recuerdo nuevo" })
      .click();
    await expect(dialog(page)).toHaveCount(0);
    expect(api.posts).toHaveLength(2);
    expect(api.posts[1]?.metadata.requestId).not.toBe(
      api.posts[0]?.metadata.requestId,
    );
  });

  test("a 503 wrote nothing: explicit Reintentar reuses the ID, an edit after it mints a new one", async ({
    page,
  }) => {
    const api = await mockApi(page, {
      create: (post, index) =>
        index < 2
          ? apiError(503, "UNAVAILABLE")
          : { status: 201, json: { memory: memoryFor(post), replayed: false } },
    });
    await openComposer(page);
    await writeText(page);
    await saveButton(page).click();
    await expect(dialog(page).getByText(/no guardó nada/)).toBeVisible();
    await page.waitForTimeout(1_500);
    expect(api.posts).toHaveLength(1);
    await dialog(page).getByRole("button", { name: "Reintentar" }).click();
    await expect.poll(() => api.posts.length).toBe(2);
    expect(api.posts[1]?.metadata.requestId).toBe(
      api.posts[0]?.metadata.requestId,
    );

    await expect(dialog(page).getByText(/no guardó nada/)).toBeVisible();
    await dialog(page).getByLabel("Pie (opcional)").fill("pie corregido");
    await saveButton(page).click();
    await expect(dialog(page)).toHaveCount(0);
    expect(api.posts).toHaveLength(3);
    expect(api.posts[2]?.metadata.requestId).not.toBe(
      api.posts[0]?.metadata.requestId,
    );
    expect(api.statusChecks).toHaveLength(0);
  });

  test("cancelling a pending upload warns it may still finish and never resends by itself", async ({
    page,
  }) => {
    const api = await mockApi(page, {
      create: (post, index) =>
        index === 0
          ? "hold"
          : { status: 200, json: { memory: memoryFor(post), replayed: true } },
    });
    await openComposer(page);
    await writeText(page);
    await saveButton(page).click();
    await expect(dialog(page).getByText("Guardando en la caja")).toBeVisible();
    await expect(saveButton(page)).toBeDisabled();
    await dialog(page).getByRole("button", { name: "Cancelar envío" }).click();
    await expect(
      dialog(page).getByText(/puede terminar de guardarlo/),
    ).toBeVisible();
    await page.waitForTimeout(2_000);
    expect(api.posts).toHaveLength(1);
    expect(api.statusChecks).toHaveLength(0);

    await dialog(page).getByRole("button", { name: "Reintentar" }).click();
    await expect(dialog(page)).toHaveCount(0);
    expect(api.statusChecks).toHaveLength(1);
    expect(api.posts).toHaveLength(2);
    expect(api.posts[1]?.metadata.requestId).toBe(
      api.posts[0]?.metadata.requestId,
    );
  });
});

test.describe("session expiry on the host", () => {
  test("a client clock ahead of the server does not bounce to login", async ({
    page,
  }) => {
    await page.clock.install({ time: Date.now() + 8 * 86_400_000 });
    const checks: string[] = [];
    page.on("request", (request) => {
      if (
        request.url().endsWith("/api/shoebox/session") &&
        request.method() === "GET"
      ) {
        checks.push(request.url());
      }
    });
    await loginThroughUi(page);
    await expect(page).toHaveURL("/shoebox");
    await page.waitForTimeout(3_000);
    await expect(page).toHaveURL("/shoebox");
    await expect(
      page.getByRole("button", { name: "Meter algo en la caja" }),
    ).toBeVisible();
    // One confirmation, not a check loop.
    expect(checks.length).toBeGreaterThanOrEqual(1);
    expect(checks.length).toBeLessThanOrEqual(2);
  });

  test("confirmed expiry redirects to login and leaves no private content behind", async ({
    page,
    context,
  }) => {
    await page.clock.install();
    await mockApi(page, {
      create: (post) => ({
        status: 201,
        json: { memory: memoryFor(post), replayed: false },
      }),
    });
    await openComposer(page);
    await writeText(page);
    await saveButton(page).click();
    await expect(page.getByText(SECRET_TEXT)).toBeVisible();

    await page.route("**/api/shoebox/session", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({
              error: { code: "UNAUTHORIZED", message: "x", diagnosticId: "d" },
            }),
          })
        : route.continue(),
    );
    // A real expiry: the cookie no longer opens anything either.
    await context.clearCookies();
    await page.clock.fastForward(170 * 3_600_000);
    await expect(page).toHaveURL(LOGIN_PATH);
    await expect(page.getByText(SECRET_TEXT)).toHaveCount(0);
    await page.goBack();
    await expect(page.getByText(SECRET_TEXT)).toHaveCount(0);
  });

  test("expiry with the composer open keeps the draft and reauthenticates inline", async ({
    page,
  }) => {
    await page.clock.install();
    const api = await mockApi(page, {
      create: () => apiError(503, "UNAVAILABLE"),
    });
    await openComposer(page);
    await writeText(page);
    let expired = true;
    await page.route("**/api/shoebox/session", (route) => {
      if (route.request().method() === "GET" && expired) {
        expired = false;
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "UNAUTHORIZED", message: "x", diagnosticId: "d" },
          }),
        });
      }
      return route.continue();
    });
    await page.clock.fastForward(170 * 3_600_000);
    const password = dialog(page).getByLabel("Contraseña");
    await expect(password).toBeVisible();
    await expect(page).toHaveURL("/shoebox");
    await password.fill(SYNTHETIC_PASSWORD);
    await dialog(page).getByRole("button", { name: "Abrir otra vez" }).click();
    await expect(dialog(page).getByLabel("Lo que pasó")).toHaveValue(
      SECRET_TEXT,
    );
    await expect(page).toHaveURL("/shoebox");
    expect(api.posts).toHaveLength(0);
  });
});
