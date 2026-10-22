import net from "node:net";
import {
  SYNTHETIC_PASSWORD_HASH,
  SYNTHETIC_SESSION_SECRET,
} from "./shoebox-auth";

export const FAKE_APP_ORIGIN = "https://shoebox.test";

/** Explicit synthetic values; nothing is inherited from the developer's shell. */
export const SAFE_ENV: Record<string, string> = {
  NOTION_API_KEY: "test-notion-key",
  NOTION_DB_ID: "",
  BIRTHDAY_PHOTOS_DB_ID: "",
  TELEGRAM_BOT_TOKEN: "",
  TELEGRAM_CHAT_ID: "",
  NOTION_WEBHOOK_VERIFICATION_TOKEN: "",
  NEXT_PUBLIC_APP_URL: FAKE_APP_ORIGIN,
  SHOEBOX_NOTION_DB_ID: "test-shoebox-db",
  SHOEBOX_PASSWORD_HASH: SYNTHETIC_PASSWORD_HASH,
  SHOEBOX_SESSION_SECRET: SYNTHETIC_SESSION_SECRET,
  SHOEBOX_APP_ORIGIN: FAKE_APP_ORIGIN,
};

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function applySafeEnv(): void {
  Object.assign(process.env, SAFE_ENV);
}

function targetHost(args: unknown[]): string | undefined {
  const [first, second] = args;
  if (typeof first === "object" && first !== null) {
    const options = first as { host?: string; path?: string };
    return options.path ? "localhost" : (options.host ?? "localhost");
  }
  if (typeof first === "string" && Number.isNaN(Number(first))) {
    return "localhost"; // unix socket path
  }
  return typeof second === "string" ? second : "localhost";
}

/** Backstop for non-fetch transports: refuses non-loopback TCP connections. */
export function blockOutboundNetwork(): void {
  const original = net.Socket.prototype.connect;
  net.Socket.prototype.connect = function connect(
    this: net.Socket,
    ...args: unknown[]
  ) {
    const host = targetHost(args);
    if (host !== undefined && !LOOPBACK.has(host)) {
      const error = new Error("offline test guard: outbound network blocked");
      queueMicrotask(() => this.destroy(error));
      return this;
    }
    return (original as (...a: unknown[]) => net.Socket).apply(this, args);
  } as typeof net.Socket.prototype.connect;
}

function blockOutboundFetch(): void {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const { hostname } = new URL(raw, "http://localhost");
    if (!LOOPBACK.has(hostname)) {
      return Promise.reject(
        new TypeError("offline test guard: outbound network blocked"),
      );
    }
    return original(input, init);
  }) as typeof fetch;
}

applySafeEnv();
blockOutboundFetch();
blockOutboundNetwork();
