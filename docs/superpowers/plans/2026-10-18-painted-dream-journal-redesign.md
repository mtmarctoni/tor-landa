# Painted Dream Journal Redesign Implementation Plan

> **Historical plan — home aesthetic rejected:** Do not reapply the beige/static/single-scene requirements. Current home acceptance is the binding `home-revision-brief.md` under `.superpowers/sdd/2026-10-18-painted-dream-journal-redesign/`. Preserve functional work; floating recognizable paintings, joyful colors, message motion and reduced-motion safety supersede the old visual constraints. The pending home and later-screen gates described below are historical; see [current verification and remaining limitations](2026-10-18-redesign-verification.md) for the completed implementation status.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Cualidades de Landa as a mobile-first, surrealist painted dream journal that makes reading the weekly message the primary experience.

**Architecture:** Keep the existing App Router routes, contexts, hooks, and API contracts. Restructure the existing feature components around shared CSS tokens, a small client-side motion wrapper, and one native-dialog presentation component; add no parallel fetching or week-selection state. Extend the approved mobile home to history, birthday/gallery, and surprises only after the home review gate.

**Tech Stack:** Next.js 16.3 preview, React 19, TypeScript 7, Tailwind CSS v4, Framer Motion 12, Lucide, pnpm; proposed dev-only Playwright browser tests.

**Spec:** [`docs/plans/2026-10-18-painted-dream-journal-redesign.md`](../../plans/2026-10-18-painted-dream-journal-redesign.md). Read both documents. The original document remains the design spec; this document supplies the historical execution order, interfaces, and red/green checks. The original not-started status is superseded by [current verification and remaining limitations](2026-10-18-redesign-verification.md).

## Global Constraints

- “Keep Next.js App Router, React, TypeScript, Tailwind v4, and the existing Framer Motion dependency.”
- “Reuse `QualityContext`, `TimeShiftContext`, `useWeekNavigator`, and the existing birthday/photo hooks. No parallel data-fetching or navigation state system.”
- “Keep shared design tokens in `src/app/globals.css`; extract small presentation components only where they simplify the existing feature code.”
- “Preserve `/api/quality`, `/api/birthday-photos`, `/api/notify`, Notion mappings, Telegram behavior, environment variables, and secret handling.”
- “Do not rewrite calendar logic, add authentication, introduce a CMS, change deployment configuration, or upgrade dependencies for this task.”
- “No new analytics or transmission of personal messages/photos to third-party services.”
- “Body text starts at a comfortable 16-18px on mobile, with generous line height and a bounded reading width on larger screens.”
- “Keep the start of a typical message visible in the initial 390x844 viewport; do not require the whole message or every action to fit above the fold.”
- Preserve Spanish copy, existing last-viewed-week restoration, birthday timing, password semantics, all archive operations, and hidden content.
- Preserve unrelated work, notably the existing modification to `pnpm-workspace.yaml`. Stay on the existing feature worktree; do not create another merely to write this plan.
- Do not commit, push, open a PR, deploy, or merge under this plan alone. Suggested commit boundaries below are advisory; explicit user authorization is required before running commit commands. Never commit to `main`.

## Review Focus

1. **Restored non-current week:** returning visitors must see an honest selected-week label and a usable return-to-present action, including after reload. Task 3 pins this behavior.
2. **Long multiline Spanish or unbroken text at narrow widths:** the reading surface must grow without truncation or horizontal overflow. Task 2 pins this behavior; Task 7 adds zoom review.
3. **Open dialog with global keyboard shortcuts:** arrows and AMOR must not operate the background; focus, scroll, and the opener must be restored after dismissal. Task 5 pins this behavior.
4. **Missing or failing birthday-photo data:** the hook currently substitutes placeholders. Preserve fallback semantics, explain that state, and never navigate modulo zero or index a missing photo. Task 6 pins this behavior.
5. **Reduced motion and changing time palette:** message text, hints, and dialogs must remain visible and legible without endless CSS or JavaScript movement. Task 2 tests the home; Tasks 5-7 cover remaining surfaces.

---

## Execution decisions to review with this plan

These are builder choices, not additional product requirements the user has already approved:

- Use **Cormorant Garamond** (400/600, normal/italic) for display text and **DM Sans** for reading/UI via `next/font/google`, with Spanish glyph support and serif/sans fallbacks.
- Start with the exact palette below; the mobile-home review gate may refine it without changing semantics.
- Add `@playwright/test` as a **dev dependency only** when implementation begins. This extends the spec's manual-browser verification with repeatable browser checks; do not upgrade existing packages or add runtime UI libraries. If the user rejects test tooling, revise the test steps explicitly rather than pretending the commands exist.
- Keep one integrated plan because all screens share the same visual foundation and contracts. Tasks 4-6 remain blocked by the home review gate; this is not a backend or calendar redesign.

| `data-time` | `--journal-surface` | `--journal-ink` | `--journal-muted` | `--journal-accent` |
| --- | --- | --- | --- | --- |
| dawn | `#F4E5D1` | `#352D26` | `#645344` | `#86551A` |
| day | `#F5F0E6` | `#172C3C` | `#52616A` | `#8A5B12` |
| dusk | `#E9DFD4` | `#352C3C` | `#645464` | `#8B452E` |
| night | `#202A30` | `#F4ECDD` | `#C6BDAF` | `#E5B874` |

Use `#914733` as the initial daytime terracotta detail, not small text on arbitrary backgrounds. Check actual text/background contrast before retaining any decorative color as text.

## File and responsibility map

| Files | Responsibility |
| --- | --- |
| `src/app/layout.tsx`, `src/app/globals.css` | Fonts, theme tokens, responsive typography, document-level motion wrapper. |
| `src/app/page.tsx`, `src/sections/Header.tsx`, `src/sections/Footer.tsx` | Compact identity, reading order, quiet footer and stationary surprise triggers. |
| `src/sections/QualityTracker.tsx`, `src/components/QualityCard.tsx` | Selected-week context, message, navigation, utilities, copy feedback, birthday hints. |
| `src/components/SurrealistBackground.tsx`, `src/components/FloatingIcons.tsx`, `public/images/journal/doorway.svg` | Authored surrealist scene; replace unrelated drifting icon clutter with a coherent motif. |
| `src/components/FloatingQuote.tsx`, `src/components/HistoryButton.tsx` | Intentional random-memory detail and semantic archive link. |
| Create `src/components/MotionPreferences.tsx` | Client boundary for `MotionConfig reducedMotion="user"`; no new app state. |
| Create `src/components/JournalDialog.tsx` | Native `<dialog>` lifecycle, accessible title/close control, focus and scroll restoration. |
| `src/app/history/page.tsx`, `src/components/MessageHistory.tsx` | Journal archive, existing search/filter/sort/export behavior and all archive states. |
| `src/components/BirthdayCountdown.tsx`, `src/components/BirthdayConfetti.tsx`, `src/components/BirthdaySecretModal.tsx`, `src/components/BirthdayGalleryModal.tsx` | Birthday presentation and existing unlock/gallery flow. |
| `src/components/PhotoViewer.tsx`, `src/components/PhotoCaption.tsx`, `src/components/GalleryLoading.tsx` | Photo controls, captions, loading, and safe fallback presentation. |
| `src/components/EasterEggModal.tsx`, `src/components/AmorEasterEggModal.tsx`, `src/components/EasterEggKeyboardListener.tsx`, `src/hooks/useWeekNavigator.ts` | Preserved surprises, touch equivalent, and modal-aware keyboard shortcuts. |
| `src/components/StatusState.tsx`, `src/components/LoadingQuality.tsx`, `src/components/WaitingForQuality.tsx`, `src/components/NoQualityInPast.tsx`, `src/components/WaitingForBirthday.tsx` | Consistent home status and recovery UI. |
| Create `playwright.config.ts`, `tests/e2e/journal.fixture.ts`, `tests/e2e/*.spec.ts`, `tests/e2e/fixtures/photo-a.svg`, `tests/e2e/fixtures/photo-b.svg` | Synthetic, local-only browser verification. |
| Modify `package.json`, `pnpm-lock.yaml`, `.gitignore` during Task 1 | Test-only dependency/script and ignored test reports. Do not touch `package-lock.json` or regenerate unrelated lockfiles. |
| Create `docs/superpowers/plans/2026-10-18-redesign-verification.md`, `public/images/journal/README.md` | Actual baseline/final evidence and asset provenance; no personal content. |

Leave `src/types/index.d.ts`, `src/types/components.d.ts`, API routes, services, and date utilities unchanged. Remove obsolete color-combo imports from `QualityCard` when replacing its gradients, but do not delete `src/utils/qualityColorCombos.ts` or its types without proving they are unused.

## Test conventions and shared contracts

Use browser tests rather than introducing a second component-test framework. Prefer roles and accessible names; use only `data-testid="quality-message"`, `data-testid="week-context"`, `data-testid="journal-scene"`, and `data-testid="memory-message"` for visual geometry or otherwise ambiguous content.

Task 1 creates `tests/e2e/journal.fixture.ts` with this interface:

```ts
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
export function installJournalFixtures(
  page: Page,
  options?: JournalFixtureOptions,
): Promise<void>;
```

- Default browser timezone: `Europe/Madrid`; fixed wall clock: `2026-06-15T12:00:00+02:00`. Do not freeze timer progression; use `page.clock.setFixedTime` before navigation.
- Default qualities: `{week:24, year:2026, message:"Tu paciencia transforma los días."}`, `{week:25, year:2026, message:"Tu imaginación abre puertas imposibles."}`, `{week:26, year:2026, message:"Tu alegría cambia el paisaje."}`, and `{week:52, year:2025, message:"Un recuerdo de otro año."}`. Week 25 is current under the existing date utility.
- Default photos: two synthetic local SVGs served through test routing at `/__fixtures/photo-a.svg` and `/__fixtures/photo-b.svg`, captions `"Recuerdo de prueba A"` and `"Recuerdo de prueba B"`. Intercept the corresponding Next image-optimizer requests too so no nonexistent public fixture route is required.
- Route both `/api/quality` and `/api/birthday-photos` before `goto`, returning their existing JSON shapes. Match error status options. Abort every other `/api/**` request, especially `/api/notify`; block non-loopback HTTP requests. Tests must never access actual Notion data or send Telegram messages.
- Seed `tor-landa:last-viewed-week` only once when `storedWeek` is provided, guarded by a session-storage sentinel. Do not overwrite later navigation on every reload. A fresh browser context is otherwise clean.
- Configure Chromium projects `phone` (390x844, touch enabled) and `desktop` (1440x1000). Allow individual tests to override viewport or motion preferences.
- Configure a dedicated Next dev server on port 3100, `reuseExistingServer: false`, through `pnpm exec next dev --hostname 127.0.0.1 --port 3100`. Use ignored `test-results/` and `playwright-report/` for artifacts; snapshots can be reviewed manually before adding baselines.
- Set the package script `test:e2e` to `playwright test`. Run one task's spec while developing; run the whole suite at the end.

Expected red results below mean assertion failures for the stated missing behavior. A server failure, missing browser binary, invalid test, or network leak is not a valid red test. Record existing defects separately from new requirements; do not rewrite calendar logic to make a characterization test pass.

## Task 1: Message-first home with a reproducible browser test

**Files:** Modify `package.json`, `pnpm-lock.yaml`, `.gitignore`, `src/app/page.tsx`, `src/sections/Header.tsx`, `src/sections/QualityTracker.tsx`, `src/components/QualityCard.tsx`, `src/components/HistoryButton.tsx`. Create the test configuration/fixture files above, `tests/e2e/home-reading.spec.ts`, and the verification record.

**Interfaces:** Consumes existing `useQualityContext(): {qualities: QualityEntry[]; loading: boolean; error: string | null; refetch: () => Promise<void>; lastUpdated: Date | null}` and the existing `useWeekNavigator(qualities)` result. Preserve `QualityCard({entry, onSecretClick?}: {entry: QualityEntry; onSecretClick?: () => void})` and all no-prop home component entry points. Produces the shared fixture API and the four DOM test hooks defined above as they become applicable.

- [ ] **Step 1: Record a baseline before changing product code.** Run `pnpm lint`, `pnpm typecheck`, and `pnpm build` separately and record exit codes/failures in the verification record. Capture existing home/history at 390x844 and 1440x1000 using synthetic data after Step 2. Do not commit generated screenshots or environment values.
- [ ] **Step 2: Add the browser harness alongside its first real consumer.** Run `pnpm add -D @playwright/test` and `pnpm exec playwright install chromium`; create the configuration, fixture implementation, and two synthetic SVGs according to the shared contracts. Ignore report/output directories. Verify the resulting diff contains no existing dependency upgrades or unrelated workspace edits.
- [ ] **Step 3: Write failing tests in `home-reading.spec.ts`.** Import `test`/`expect` from `@playwright/test` and the fixture function. Implement these two tests:

```ts
test("message precedes navigation and starts in the first phone view", async ({ page }) => {
  await installJournalFixtures(page);
  await page.goto("/");
  const message = page.getByTestId("quality-message");
  await expect(message).toHaveText("Tu imaginación abre puertas imposibles.");
  const m = await message.boundingBox();
  const previous = await page.getByRole("button", { name: "Semana anterior", exact: true }).boundingBox();
  expect(m).not.toBeNull();
  expect(previous).not.toBeNull();
  expect(m!.y).toBeLessThan(500);
  expect(previous!.y).toBeGreaterThanOrEqual(m!.y + m!.height);
  await expect(page.getByRole("link", { name: "Historia completa", exact: true })).toHaveAttribute("href", "/history");
  await expect(page.locator("a button, button a")).toHaveCount(0);
});
test("week context labels the selected year and week", async ({ page }) => {
  await installJournalFixtures(page);
  await page.goto("/");
  await expect(page.getByTestId("week-context")).toContainText("Semana 25 / 2026");
  await expect(page.getByRole("heading", { name: "Cualidades de Landa", exact: true })).toBeVisible();
});
```

- [ ] **Step 4: Run the red check.** `pnpm test:e2e tests/e2e/home-reading.spec.ts --project=phone`. Expect failures for missing message/context hooks, exact accessible names, or the current controls-before-message geometry; inspect the rendered baseline rather than assuming all assertions fail.
- [ ] **Step 5: Implement the compact home shell.** Keep `Home(): React.JSX.Element`, `Header`, and `QualityTracker` in their existing files. Order identity, week context, state/message, previous-next navigation, secondary tools, then details. Put the message hook on the text element itself. Make “Historia completa” a styled `Link`, not a nested button. Preserve birthday state priority and data flow; do not change hook semantics.
- [ ] **Step 6: Run the green check.** Repeat Step 4 and run it with `--project=desktop`; expect all assertions to pass. Run `pnpm typecheck`.
- [ ] **Step 7: Review the task diff and record the boundary.** Suggested commit, only if separately authorized: `feat: prioritize the weekly message on mobile`. Stage exact task paths, never `git add .`.

## Task 2: Painted visual system, responsive scene, and readable motion

**Files:** Modify `src/app/globals.css`, `src/app/layout.tsx`, `src/sections/Header.tsx`, `src/sections/Footer.tsx`, `src/components/QualityCard.tsx`, `src/components/SurrealistBackground.tsx`, `src/components/FloatingIcons.tsx`. Create `src/components/MotionPreferences.tsx`, `public/images/journal/doorway.svg`, `public/images/journal/README.md`, and `tests/e2e/visual-system.spec.ts`.

**Interfaces:** `MotionPreferences({children}: {children: React.ReactNode}): React.JSX.Element` wraps the app content in the existing Framer Motion `MotionConfig`. Preserve `SurrealistBackground()` and `QualityCard` entry points. The scene is decorative, `aria-hidden`, non-interactive, and exposes `journal-scene`; the message exposes `quality-message`. All reading surfaces consume the palette tokens above.

- [ ] **Step 1: Write failing layout tests in `visual-system.spec.ts`.** For widths `[320,390,430,768,1440]`, install a current-week fixture with `message = "Ánimo, imaginación y cariño.\n\n" + "Una nota larga. ".repeat(100) + "x".repeat(240)` and assert:

```ts
await expect(page.getByTestId("quality-message")).toHaveText(message);
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
expect(await page.getByTestId("quality-message").evaluate(el => {
  const style = getComputedStyle(el);
  return Number.parseFloat(style.fontSize) >= 16 &&
    style.whiteSpace === "pre-wrap" && el.scrollWidth <= el.clientWidth + 1;
})).toBe(true);
```

Add `"theme uses the approved reading tokens"`, looping over the four palette rows and both routes, asserting `html[data-time]` and the computed `--journal-surface`/`--journal-ink` values equal that row. Add `"reduced motion leaves a stable readable message"`: emulate reduced motion, read the message's bounding box twice 300ms apart after its entrance, and assert position/size differences `< 1px` and computed `animationName === "none"`. Block decorative images in `"art failure does not hide the message"` and assert the message and navigation remain visible.
- [ ] **Step 2: Run the red check.** `pnpm test:e2e tests/e2e/visual-system.spec.ts --project=phone`. Expect missing theme tokens and legacy morph/overflow behavior to fail.
- [ ] **Step 3: Implement the visual foundation.** Load the chosen fonts in `layout.tsx`; implement exact theme roles (day tokens also serve as the server-rendered default), 16-18px mobile reading type, 38ch mobile/52ch desktop maximum reading width, `white-space: pre-wrap`, `overflow-wrap: anywhere`, fine rules, subtle paper texture, and 44px minimum control target dimensions. Remove the card's deterministic bright gradient and morphing-container classes. Keep legacy tokens until later screens no longer depend on them.
- [ ] **Step 4: Implement the scene and motion boundary.** Author the doorway/landscape SVG with floating stones, a moon, and an impossible shadow as one coherent composition. Give it reserved dimensions and narrow/wide placement outside the reading area. Inventory existing paintings' dimensions, size, and provenance in the asset README; use a recognizable crop only when reuse rights are established, otherwise use the original scene. Wrap the app in `MotionPreferences`; use `useReducedMotion()` in continuous Framer animations to disable movement/repeats, not just transform transitions. Keep footer triggers stationary.
- [ ] **Step 5: Run the green checks and inspect the art.** `pnpm test:e2e tests/e2e/home-reading.spec.ts tests/e2e/visual-system.spec.ts`; expect both projects to pass. Check text/muted-text contrast against the palette with WCAG relative luminance (normal text at least 4.5:1) and manually inspect actual composited backgrounds, focus states, and desktop placement. Capture synthetic-data screenshots; automated token assertions do not prove visual quality.
- [ ] **Step 6: Record the review boundary.** Suggested authorized commit: `feat: establish the painted dream journal visual system`.

## Task 3: Preserve navigation, utilities, and home states without visual clutter

**Files:** Modify `src/sections/QualityTracker.tsx`, `src/components/FloatingQuote.tsx`, `src/app/page.tsx`, `src/components/StatusState.tsx`, `src/components/LoadingQuality.tsx`, `src/components/WaitingForQuality.tsx`, `src/components/NoQualityInPast.tsx`, `src/components/WaitingForBirthday.tsx`. Create `tests/e2e/home-interactions.spec.ts`.

**Interfaces:** Preserve the existing `useWeekNavigator` return contract and `StatusState` callers. Preserve `FloatingQuote()` as a no-prop component using `QualityContext`; it now returns a stationary expandable random-memory detail, or `null` when no entries exist. Exact control names: “Semana anterior”, “Semana siguiente”, “Volver al presente”, “Semana aleatoria”, “Copiar mensaje”, “Recargar datos”; native details summary “Detalles de la semana”.

- [ ] **Step 1: Write the failing restored-week test.** Seed `{week:24,year:2026}`, assert week 24/message, click next and assert week 25/message, reload and assert week 25, click previous and then “Volver al presente”, and assert week 25 again. Assert the present action is hidden or disabled only while current. Use the fixture seeding contract so reload really tests persistence.
- [ ] **Step 2: Write failing action/state tests.** Add the following named cases with these assertions:

```ts
// "random and recent shortcuts select saved messages"
await page.getByRole("button", { name: "Semana aleatoria", exact: true }).click();
await expect(page.getByTestId("quality-message")).toHaveText(/Tu paciencia|Tu imaginación|Tu alegría|Un recuerdo/);
await page.getByText("Detalles de la semana", { exact: true }).click();
await page.getByRole("button", { name: "Semana 24 del 2026", exact: true }).click();
await expect(page.getByTestId("week-context")).toContainText("Semana 24 / 2026");
// "memory is stationary and revealed by activation"
await page.getByText("Un recuerdo al azar", { exact: true }).click();
await expect(page.getByTestId("memory-message")).toHaveText(/Tu paciencia|Tu imaginación|Tu alegría|Un recuerdo/);
// "empty and missing weeks have distinct states"; separate fresh-page cases
await expect(page.getByRole("heading", { name: "Todavía no hay mensaje", exact: true })).toBeVisible(); // no current entry
await expect(page.getByRole("heading", { name: "Semana sin mensaje", exact: true })).toBeVisible(); // stored week 23, empty data
```

Add `"copy reports success and failure"` using separate tests that stub `navigator.clipboard.writeText` to capture the passed string or reject; assert exact payload `"Semana 25 / 2026\n\nTu imaginación abre puertas imposibles."`, then “Mensaje copiado al portapapeles.” or “No se pudo copiar el mensaje. Inténtalo otra vez.” in a live status region. Add `"retry recovers without stale content"`: intercept quality as 500, assert heading “No se pudieron cargar los mensajes”, change the test route to success, click “Reintentar”, assert the selected message. Add `"loading occupies the reading slot"` by holding the routed response until after asserting “Cargando el mensaje…”; release it and assert the message replaces it. Assert empty-data random/copy controls cannot execute.
- [ ] **Step 3: Run the red check.** `pnpm test:e2e tests/e2e/home-interactions.spec.ts --project=phone`. Distinguish existing passing characterization tests from new failing labels, placement, details, or status feedback.
- [ ] **Step 4: Implement the preserved interactions.** Move recent shortcuts, “Semana {week} de {year}” context, refresh, and synchronization time into the native details area; replace the annual bar with quiet text. Put present navigation alongside selected-week context. Keep copy status in a stable-height live region. Present non-birthday missing states with the exact headings above and existing personal supporting copy. Keep loading/error precedence and birthday-before-release semantics. Make `FloatingQuote` a native details/summary labeled “Un recuerdo al azar”, choose a saved message on opening, and remove its drifting/autodismiss timers. Render it after `QualityTracker`, not over it.
- [ ] **Step 5: Run the green check.** `pnpm test:e2e tests/e2e/home-reading.spec.ts tests/e2e/home-interactions.spec.ts tests/e2e/visual-system.spec.ts`; expect both projects to pass. Run `pnpm lint` and `pnpm typecheck`; compare any failures with baseline.
- [ ] **Step 6: Record the boundary.** Suggested authorized commit: `feat: simplify weekly navigation and memory discovery`.
- [ ] **Step 7: Stop for the mandatory home review.** Present 390x844 and 1440px screenshots of an ordinary message, a long message, and a waiting/error state. Ask for visual approval. Record the answer in the verification document. Do not begin Tasks 4-6 until the user approves; passing tests cannot substitute for this gate.

## Task 4: Readable journal archive with all existing tools

**Files:** Modify `src/app/history/page.tsx`, `src/components/MessageHistory.tsx`. Create `tests/e2e/history.spec.ts`.

**Interfaces:** Preserve `HistoryPage()` and `MessageHistory()` no-prop entry points and `QualityContext` consumption. Keep local `searchQuery`, `filterYear`, and `sortOrder` state. Search accessible name “Buscar en mensajes”; year select “Año”; sort names “Reciente”/“Antiguo”; exports “JSON”/“TXT”; return link “Volver al presente”. Keep date-range/export semantics unchanged.

- [ ] **Step 1: Write failing `"archive search, year and order compose"`.** Install the default fixtures, visit `/history`, search `"Tu"`, select `2026`, assert `"3 de 4 cualidades"`; assert displayed message order is weeks `[26,25,24]`, toggle sort, assert `[24,25,26]`. Clear filters and assert `"4 de 4 cualidades"`. Read order from semantic `article` elements labeled `"Semana {week} del {year}"`.
- [ ] **Step 2: Write failing `"exports contain only filtered entries"`.** Search `"imaginación"`, download JSON and TXT via `page.waitForEvent("download")`, read the local downloaded paths with `node:fs/promises`, parse JSON and assert `[{week:25,year:2026,message:"Tu imaginación abre puertas imposibles."}]`; assert TXT contains that message and `"Semana 25, 2026"`, and excludes the other three messages. Add separate empty-data, 500-response, and no-search-match tests asserting distinct headings “Todavía no hay recuerdos”, “No se pudo cargar la historia”, and “Ningún recuerdo coincide”; no-match recovery “Limpiar filtros” must restore results.
- [ ] **Step 3: Run the red check.** `pnpm test:e2e tests/e2e/history.spec.ts --project=phone`. Expect unlabeled inputs, article semantics, or new state headings to fail.
- [ ] **Step 4: Implement the archive layout.** Keep existing sort/filter/export functions, provide real labels and semantic articles, show full messages with preserved whitespace, stack tools on phones, place exports in a secondary group, and remove repeated avatar/“Sistema” clutter. Replace index-based entrance delays with a bounded shared entrance. Adopt journal tokens and use a styled return `Link`.
- [ ] **Step 5: Run green checks.** `pnpm test:e2e tests/e2e/history.spec.ts tests/e2e/visual-system.spec.ts`; expect both projects to pass. Check long messages and filter controls at 320px. Run `pnpm typecheck`.
- [ ] **Step 6: Record the boundary.** Suggested authorized commit: `feat: redesign the memory archive as journal entries`.

## Task 5: Shared accessible dialog and touch-accessible surprises

**Files:** Create `src/components/JournalDialog.tsx` and `tests/e2e/surprises.spec.ts`. Modify `src/components/EasterEggModal.tsx`, `src/components/AmorEasterEggModal.tsx`, `src/components/EasterEggKeyboardListener.tsx`, `src/sections/Footer.tsx`, `src/app/layout.tsx`, `src/hooks/useWeekNavigator.ts`, `src/app/globals.css`.

**Interfaces:** Export default `JournalDialog(props: JournalDialogProps): React.JSX.Element`, where `JournalDialogProps` is `{isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; className?: string; initialFocusRef?: React.RefObject<HTMLElement | null>}`. Preserve existing `SimpleModalProps` callers; both surprise dialogs mount the shared wrapper with `isOpen={true}`. Preserve `EasterEggKeyboardListener()` but render its subtle touch trigger from the footer instead of mounting it in `layout.tsx`; it continues to register the global AMOR listener exactly once.

- [ ] **Step 1: Write failing `"footer surprise traps focus and restores the opener"`.** Open “Abrir sorpresa”, assert a modal `dialog` named “Sorpresa surrealista”; Tab/Shift+Tab repeatedly and assert each active element remains inside it. Assert document scrolling is locked. Press Escape, assert closed, focus back on the opener, and previous scroll-lock styles restored. Capture `week-context`, open again, press ArrowLeft/ArrowRight and type `amor`, close, and assert the original week remains selected and no second dialog opened.
- [ ] **Step 2: Write failing `"AMOR works by keyboard and touch"`.** Type `amor` on the document and assert dialog “Momento especial”; close and activate the touch button “Abrir un momento especial” to assert the same content. Type `amor` in the history search input and assert no dialog. With reduced motion, open both surprise dialogs and assert heading/body/close control remain visible after entrances settle.
- [ ] **Step 3: Run the red check.** `pnpm test:e2e tests/e2e/surprises.spec.ts --project=phone`. Expect missing dialog roles, stationary named triggers, or focus containment to fail.
- [ ] **Step 4: Implement `JournalDialog` using native `<dialog>`.** Synchronize `showModal()`/`close()` with `isOpen`, name it with a generated heading ID, handle native cancel with `onClose`, and provide one “Cerrar” button. Capture the opener and prior root/body overflow values; restore them on close/unmount. On open, focus `initialFocusRef.current` if present, otherwise the close button. Use a constrained `100dvh` layout with safe-area padding and internally scrollable content. Do not add another modal library or a parallel overlay context.
- [ ] **Step 5: Integrate the surprises and guard shortcuts.** Keep personal paragraph content, replace only the framing/headings and moving triggers. Mount the AMOR listener/trigger in the global footer. Both global listeners must ignore events from editable controls/contenteditable and while `document.querySelector("dialog[open]")` exists. Native modal behavior provides background inertness and focus containment; verify it rather than reimplementing a second trap.
- [ ] **Step 6: Run green checks.** `pnpm test:e2e tests/e2e/surprises.spec.ts tests/e2e/home-interactions.spec.ts`; expect both projects to pass. Also inspect focus visibility and modal scrolling in phone landscape. Run `pnpm typecheck`.
- [ ] **Step 7: Record the boundary.** Suggested authorized commit: `feat: make journal surprises accessible on touch and keyboard`.

## Task 6: Birthday special edition and resilient photo gallery

**Files:** Modify `src/components/BirthdayCountdown.tsx`, `src/components/BirthdayConfetti.tsx`, `src/components/BirthdaySecretModal.tsx`, `src/components/BirthdayGalleryModal.tsx`, `src/components/PhotoViewer.tsx`, `src/components/PhotoCaption.tsx`, `src/components/GalleryLoading.tsx`, `src/components/QualityCard.tsx`. Create `tests/e2e/birthday.spec.ts`.

**Interfaces:** Preserve `BirthdaySecretModalProps {isOpen,onClose,onSuccess}`, `BaseModalProps {isOpen,onClose}`, and `PhotoViewerProps {photos: Photo[]; currentIndex: number; imageLoadStates: {[key:number]:boolean}; onNext:()=>void; onPrev:()=>void}`. Reuse Task 5's `JournalDialog`. Consume the existing `useBirthdayPhotos(isOpen): {photos: Photo[]; loading: boolean; error: string | null}` unchanged. Gallery accessible title “Para ti, Landa”; photo controls “Foto anterior”/“Foto siguiente”. Secret input accessible label “Código secreto”.

- [ ] **Step 1: Write failing birthday-visibility tests.** Override the browser clock and fixtures per case: `2026-09-01T12:00:00+02:00` has no countdown; `2026-10-18T12:00:00+02:00` shows a countdown; stored week 43 on `2026-10-22T12:00:00+02:00` shows “Vuelve el 23 de octubre” without the secret; `2026-10-23T12:00:00+02:00` with a week-43 message containing `"Berlín y nuestros cuatro números"` exposes inline buttons named “Berlín” and “nuestros cuatro números”. An older birthday entry, week 43/2025, remains unlocked at the latter date. Do not assert corrected calendar math or change birthday utilities.
- [ ] **Step 2: Write failing `"secret unlock transfers focus to the gallery"`.** Click a hint, assert dialog “El secreto de Landa” and initial focus in the named input. Submit an incorrect value and assert error feedback without gallery access. Submit the existing correct value supplied locally as `JOURNAL_TEST_SECRET` to the test process, not hardcoded in fixtures/docs, and assert the secret closes and named gallery opens. Test the existing three-attempt close behavior separately. After closing the gallery, assert focus returns to the original hint. If the test value is unavailable, report the success-path test as blocked, never as verified.
- [ ] **Step 3: Write failing `"gallery preserves captions, arrows and fallback safety"`.** After the same unlock flow, assert caption “Recuerdo de prueba A”, click next and assert B, click next and assert A; test previous as well. Hold image fulfillment and assert loading feedback while close stays reachable. Repeat with `{photos:[]}` and with `photoStatus:500`: assert the hook's three-placeholder gallery remains navigable and a clear “Mostrando imágenes de ejemplo” notice appears (error also has a polite load-failure explanation). Assert counter `"1 / 3"`, absence of `"1 / 0"`, and working next/previous controls after fallback. Add a pending-photo-response case asserting no photo navigation is rendered while the dataset has not loaded. The isolated zero-photo `PhotoViewer` branch is a defensive code-review check, not an E2E path reachable through this hook; do not introduce a production test route or claim that branch has a direct browser test.
- [ ] **Step 4: Run the red check.** `pnpm test:e2e tests/e2e/birthday.spec.ts --project=phone`. Expected failures: non-semantic hints, missing dialog/focus behavior, and undisclosed fallback presentation. Keep the test secret local and never print it.
- [ ] **Step 5: Implement birthday presentation and semantic hints.** Replace the clickable spans with inline semantic buttons; keep the existing match phrases, password validation, attempt limits, countdown window, and date gates. Use ochre/terracotta details and the established journal typography rather than a separate pink gradient UI. Disable confetti movement for reduced motion and keep it brief otherwise. Connect both birthday dialogs to `JournalDialog`, using an input ref for initial focus and preserving the original hint across the secret-to-gallery transition.
- [ ] **Step 6: Implement safe gallery presentation.** Retain the existing fetch/preload hooks and consume their `error` field. The current hook substitutes placeholders for empty/error responses, so do not claim those responses yield zero photos. Detect placeholder use from the known placeholder asset URLs, display the notice, and display a load-failure explanation when `error` is set. If any placeholder art lacks reuse rights, change only its source URL in `src/hooks/useBirthdayPhotos.ts` to the authored scene and add that file to this task's diff. Guard `photos.length === 0` in next/previous handlers and caption access. Keep swipe support plus named buttons, reserve photo dimensions, and ensure captions/close controls survive short viewports and long captions.
- [ ] **Step 7: Run green checks.** `pnpm test:e2e tests/e2e/birthday.spec.ts tests/e2e/surprises.spec.ts`; expect both projects to pass, or explicitly record missing-local-secret blocking only its dependent tests. Inspect a full-height gallery at 390x844 and 844x390, including reduced motion and all theme palettes. Run `pnpm lint` and `pnpm typecheck`.
- [ ] **Step 8: Record the boundary.** Suggested authorized commit: `feat: redesign birthday moments and the photo journal`.

## Task 7: Cross-screen regression, accessibility, and performance handoff

**Files:** Create `tests/e2e/regression.spec.ts`; update the verification record and only those presentation files where a new failing regression test identifies a remaining issue.

**Interfaces:** Consumes all earlier DOM names, shared fixtures, and dialogs; introduces no new production interfaces. All acceptance criteria in the spec's verification matrix must have a recorded automated or manual result.

- [ ] **Step 1: Add failing regressions before correcting remaining gaps.** At 320px, 390px, 430px, 768px, 1440px and 844x390, assert `document.documentElement.scrollWidth <= innerWidth` on both routes with long/multiline messages. Check every visible primary control's bounding box is at least 44x44px. For each theme under reduced motion, open each dialog and confirm visible text/close controls plus stable scene/message geometry across samples. Add a failed-image request case proving text/navigation remain usable. Use role selectors and the existing fixture API; no new production test endpoints.
- [ ] **Step 2: Run the red checks.** `pnpm test:e2e tests/e2e/regression.spec.ts`; inspect failures and assign corrections to the owning component. If all assertions already pass, record that fact and do not manufacture a defect.
- [ ] **Step 3: Make the smallest presentation fixes.** Correct only the verified sizing, contrast, focus, motion, or loading problem; do not expand into calendar, security, Notion, or notification refactors. Remove obsolete visual code only after a repo search confirms no preserved feature uses it.
- [ ] **Step 4: Run the complete automated gate.** Run `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `git diff --check` separately. Expected: both browser projects pass, successful command exits, and no whitespace errors. Record baseline failures versus new failures; never report the branch green if a required check failed or was skipped.
- [ ] **Step 5: Perform manual checks that automation does not replace.** Verify 200% browser zoom, a screen-reader smoke test, keyboard-only interaction, native-dialog focus/scroll restoration, and actual composited text contrast in all themes. Compare mobile page-load/image/font requests against Task 1's baseline; investigate regressions and confirm the design still works with decorative assets blocked. Check browser console for hydration/runtime errors. Use `?time=dawn|day|dusk|night` rather than changing production time code.
- [ ] **Step 6: Check integration boundaries without external side effects.** Inspect the diff for unchanged API response shapes and no service/env/notification changes. Inspect the two read endpoints locally only if their configuration is confirmed to use non-private test data; otherwise mark live-endpoint verification as not run. Do not invoke `/api/notify` or `pnpm test:telegram` for UI verification. Never copy personal responses into the record.
- [ ] **Step 7: Record evidence and hand off.** Update the verification record with dated results, screenshots from synthetic fixtures, the home-review approval, asset provenance, and any blocked/manual checks. Suggested authorized commit: `test: verify the mobile dream journal redesign`. Summarize outcomes and limitations; leave commits/PR/deployment to separate explicit authorization.

## Plan self-review

- Spec coverage: Tasks 1-3 implement the mobile home and reading priority; Task 2 covers art/fonts/themes; Task 4 preserves all archive tools; Tasks 5-6 preserve personal surprises, birthday timing and gallery; Task 7 covers the remaining verification matrix.
- Interfaces: Existing `.d.ts` types, API contracts, photo fallback behavior, and component signatures were inspected. Only the motion wrapper and native-dialog shell add production components.
- Review Focus: The five failure classes each have an owning test step, rather than remaining an untested warning.
- Scope: No product code, dependencies, generated browser artifacts, or private fixture content is created by writing this plan. Existing design spec and unrelated working-tree changes remain intact.
- Execution gate: Review this plan and choose native or subagent-driven implementation before starting Task 1. After Task 3, pause again for visual approval of the mobile home.
