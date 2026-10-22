import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
import {
  SYNTHETIC_PASSWORD_HASH,
  SYNTHETIC_SESSION_SECRET,
} from "./tests/helpers/shoebox-auth";

// Synthetic shoebox configuration and blanked personal integrations, so the
// preload, not fake credentials alone, enforces the server network boundary.
const SYNTHETIC_SERVER_ENV = {
  NODE_OPTIONS: `--require=${JSON.stringify(resolve("scripts/shoebox-offline.cjs"))}`,
  NEXT_TELEMETRY_DISABLED: "1",
  NOTION_API_KEY: "test-notion-key",
  NOTION_DB_ID: "",
  BIRTHDAY_PHOTOS_DB_ID: "",
  TELEGRAM_BOT_TOKEN: "",
  TELEGRAM_CHAT_ID: "",
  NOTION_WEBHOOK_VERIFICATION_TOKEN: "",
  NEXT_PUBLIC_APP_URL: "",
  SHOEBOX_NOTION_DB_ID: "test-shoebox-db",
  SHOEBOX_PASSWORD_HASH: SYNTHETIC_PASSWORD_HASH,
  SHOEBOX_SESSION_SECRET: SYNTHETIC_SESSION_SECRET,
  SHOEBOX_APP_ORIGIN: "http://127.0.0.1:3100",
};

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results",
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    timezoneId: "Europe/Madrid",
    serviceWorkers: "block",
    ignoreHTTPSErrors: process.env.SHOEBOX_E2E_HTTPS === "1",
    // Fail closed for browser requests too; direct local HTTP remains usable.
    proxy: {
      server: "http://127.0.0.1:9",
      bypass: "127.0.0.1,localhost,[::1]",
    },
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "phone",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        hasTouch: true,
      },
    },
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm exec next dev --hostname 127.0.0.1 --port 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: false,
        timeout: 120_000,
        env: SYNTHETIC_SERVER_ENV,
      },
});
