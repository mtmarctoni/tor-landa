import { defineConfig } from "@playwright/test";
import baseline from "./playwright.config";

// Original Chromium phone/desktop projects are preserved in their own config.
export default defineConfig({
  ...baseline,
  testMatch: ["shoebox-compatibility.spec.ts", "shoebox-privacy.spec.ts"],
  workers: 2,
  projects: [
    ...(baseline.projects ?? []),
    {
      name: "firefox",
      use: { browserName: "firefox", viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "webkit-phone",
      use: {
        browserName: "webkit",
        viewport: { width: 390, height: 844 },
        hasTouch: true,
      },
    },
  ],
});
