import { expect, type Page } from "@playwright/test";
import { SYNTHETIC_PASSWORD } from "../helpers/shoebox-auth";

/** Text that only the authenticated shell renders. */
export const PRIVATE_MARKER = "Todo esto es culpa nuestra";

export const LOGIN_PATH = "/shoebox/login";

const PRIVATE_HEADERS: Record<string, string> = {
  "cache-control": "private, no-store, max-age=0",
  "cdn-cache-control": "no-store",
  "vercel-cdn-cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "content-security-policy": "frame-ancestors 'none'",
  "permissions-policy": "microphone=(self), camera=(), geolocation=()",
  "x-robots-tag": "noindex, nofollow, noarchive",
};

/** Set when the suite runs against `next start` instead of `next dev`. */
export const PRODUCTION_SERVER = process.env.SHOEBOX_E2E_PRODUCTION === "1";

/** `next dev` forces this on every page; production keeps the config value. */
const DEV_PAGE_CACHE_CONTROL = "no-cache, must-revalidate";

export function expectPrivateHeaders(
  headers: Record<string, string>,
  { page = false }: { page?: boolean } = {},
): void {
  for (const [name, value] of Object.entries(PRIVATE_HEADERS)) {
    const expected =
      page && name === "cache-control" && !PRODUCTION_SERVER
        ? DEV_PAGE_CACHE_CONTROL
        : value;
    expect(headers[name], name).toBe(expected);
  }
}

export async function loginThroughUi(
  page: Page,
  password = SYNTHETIC_PASSWORD,
): Promise<void> {
  await page.goto(LOGIN_PATH);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Abrir la caja" }).click();
}

/** Logs in for real and opens the composer dialog on the guarded page. */
export async function openComposer(page: Page): Promise<void> {
  await loginThroughUi(page);
  await expect(page).toHaveURL("/shoebox");
  await page.getByRole("button", { name: "Meter algo en la caja" }).click();
  await expect(
    page.getByRole("dialog", { name: "Algo nuevo para la caja" }),
  ).toBeVisible();
}

export type CapturedCreate = {
  metadata: Record<string, unknown>;
  file: { type: string; size: number } | null;
};

/** Reads the multipart create body the composer sent (synthetic data only). */
export function parseCreate(body: Buffer, contentType: string): CapturedCreate {
  const boundary = /boundary=(.+)$/.exec(contentType)?.[1] ?? "";
  const parts = body.toString("latin1").split(`--${boundary}`);
  let metadata: Record<string, unknown> = {};
  let file: CapturedCreate["file"] = null;
  for (const part of parts) {
    const [head = "", ...rest] = part.split("\r\n\r\n");
    const content = rest.join("\r\n\r\n").replace(/\r\n$/, "");
    if (/name="metadata"/.test(head)) {
      metadata = JSON.parse(Buffer.from(content, "latin1").toString("utf8"));
    } else if (/name="file"/.test(head)) {
      const type = /Content-Type:\s*([^\r\n]+)/i.exec(head)?.[1] ?? "";
      file = { type, size: Buffer.byteLength(content, "latin1") };
    }
  }
  return { metadata, file };
}

/** Counts getUserMedia calls and keeps every track it handed out. */
export async function instrumentMicrophone(
  page: Page,
  options: { deny?: boolean } = {},
) {
  await page.addInitScript(({ deny }) => {
    const state = { calls: 0, tracks: [] as MediaStreamTrack[] };
    (window as unknown as { __mic: typeof state }).__mic = state;
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      state.calls += 1;
      if (deny) throw new DOMException("denied", "NotAllowedError");
      const stream = await original(constraints);
      state.tracks.push(...stream.getTracks());
      return stream;
    };
  }, options);
}

export const mic = (page: Page) =>
  page.evaluate(() => {
    const state = (
      window as unknown as {
        __mic: { calls: number; tracks: MediaStreamTrack[] };
      }
    ).__mic;
    return {
      calls: state.calls,
      kinds: state.tracks.map((track) => track.kind),
      live: state.tracks.filter((track) => track.readyState === "live").length,
    };
  });
