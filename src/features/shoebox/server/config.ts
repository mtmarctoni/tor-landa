import "server-only";
import { ShoeboxError } from "./errors";

export type ShoeboxConfig = {
  notionApiKey: string;
  notionDbId: string;
  passwordHash: string;
  sessionSecret: string;
  appOrigin: string;
};

const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ShoeboxError("SETUP_REQUIRED", { detail: name });
  }
  return value;
}

function parseOrigin(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ShoeboxError("SETUP_REQUIRED", { detail: "SHOEBOX_APP_ORIGIN" });
  }
  const secure = url.protocol === "https:";
  const loopback =
    url.protocol === "http:" && LOOPBACK_HOSTS.includes(url.hostname);
  if (!secure && !loopback) {
    throw new ShoeboxError("SETUP_REQUIRED", { detail: "SHOEBOX_APP_ORIGIN" });
  }
  return url.origin;
}

/** Reads the five server variables on demand; nothing happens at import. */
export function getConfig(): ShoeboxConfig {
  return {
    notionApiKey: required("NOTION_API_KEY"),
    notionDbId: required("SHOEBOX_NOTION_DB_ID"),
    passwordHash: required("SHOEBOX_PASSWORD_HASH"),
    sessionSecret: required("SHOEBOX_SESSION_SECRET"),
    appOrigin: parseOrigin(required("SHOEBOX_APP_ORIGIN")),
  };
}
