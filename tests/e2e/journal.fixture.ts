import type { Page } from "@playwright/test";
import type { Photo, QualityEntry } from "../../src/types";

export interface JournalFixtureOptions {
  now?: string;
  qualities?: QualityEntry[];
  qualityStatus?: number;
  photos?: Photo[];
  photoStatus?: number;
  storedWeek?: { week: number; year: number };
}

export async function installJournalFixtures(
  page: Page,
  options: JournalFixtureOptions = {},
): Promise<void> {
  await page.clock.setFixedTime(
    new Date(options.now ?? "2026-06-15T12:00:00+02:00"),
  );
  if (options.storedWeek) {
    await page.addInitScript((storedWeek) => {
      const sentinel = "journal-fixture:week-seeded";
      if (!sessionStorage.getItem(sentinel)) {
        localStorage.setItem(
          "tor-landa:last-viewed-week",
          JSON.stringify(storedWeek),
        );
        sessionStorage.setItem(sentinel, "true");
      }
    }, options.storedWeek);
  }
  const qualities = options.qualities ?? [
    { week: 24, year: 2026, message: "Tu paciencia transforma los días." },
    {
      week: 25,
      year: 2026,
      message: "Tu imaginación abre puertas imposibles.",
    },
    { week: 26, year: 2026, message: "Tu alegría cambia el paisaje." },
    { week: 52, year: 2025, message: "Un recuerdo de otro año." },
  ];
  const photos = options.photos ?? [
    { url: "/__fixtures/photo-a.svg", caption: "Recuerdo de prueba A" },
    { url: "/__fixtures/photo-b.svg", caption: "Recuerdo de prueba B" },
  ];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
      await route.abort();
      return;
    }
    if (url.pathname === "/api/quality") {
      await route.fulfill({
        status: options.qualityStatus ?? 200,
        json: { qualities },
      });
    } else if (url.pathname === "/api/birthday-photos") {
      await route.fulfill({
        status: options.photoStatus ?? 200,
        json: { photos },
      });
    } else if (url.pathname.startsWith("/api/")) {
      await route.abort();
    } else {
      const imagePath =
        url.pathname === "/_next/image"
          ? new URL(url.searchParams.get("url") ?? "/", url.origin).pathname
          : url.pathname;
      const match = /^\/__fixtures\/(photo-[ab]\.svg)$/.exec(imagePath);
      if (match) {
        await route.fulfill({
          path: `tests/e2e/fixtures/${match[1]}`,
          contentType: "image/svg+xml",
        });
      } else if (
        url.pathname === "/_next/image" &&
        [
          "/images/dali1.webp",
          "/images/dali2.webp",
          "/images/thekiss.jpg",
          "/images/dream/van-gogh-cypresses.webp",
        ].includes(url.searchParams.get("url") ?? "")
      ) {
        // Exact local artwork only. Never normalize a remote URL into the allowlist.
        await route.continue();
      } else if (url.pathname === "/_next/image") {
        // Never allow the local optimizer to fetch a remote image server-side.
        await route.abort();
      } else {
        await route.continue();
      }
    }
  });
}
