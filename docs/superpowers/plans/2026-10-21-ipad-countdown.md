# iPad Countdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for inline execution, or superpowers:subagent-driven-development if the user chooses delegated execution, task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This document authorizes neither execution nor delegation by itself.

**Goal:** Make the birthday iPad promise a surreal discovery on October 23, followed by a readable, always-visible pending-promise certificate.

**Architecture:** A local one-off configuration and pure date model drive one homepage feature component. A focused client scheduling hook handles current timestamps, page visibility and exact boundaries; the existing native dialog handles the birthday reveal. A shared stateless certificate supplies full and compact presentations in the website's existing style.

**Tech Stack:** Existing Next.js 16.3.0-preview.6, React 19, TypeScript, CSS, Framer Motion and Playwright; pnpm; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-21-ipad-countdown-design.md` (approved in conversation). Read it with this plan; its copy and visual requirements are binding.

## Global Constraints

- Work only in `/Users/mtm/.local/share/opencode/worktree/bc1d6b/ipad-countdown`, branch `feat/ipad-countdown`; do not create another worktree.
- No product implementation until explicit plan approval. No dependency installation without separate approval. No commits, staging, pushes, PRs, merges, deployments, secret reads or live-service requests.
- Keep Spanish copy, `@/` source imports, App Router structure, current palette/font tokens, illustrated postal shapes, and all existing birthday/weekly behavior.
- Target **2026-11-27 00:00 Europe/Madrid** = **2026-11-26T23:00:00Z**; no recurrence, negative values, discount guarantees or inferred purchase/delivery.
- Reveal start `2026-10-23T00:00:00+02:00`; inline start `2026-10-24T00:00:00+02:00`; placement uses these Palma instants, not selected week or device date.
- Initial purchase state `pending`; only a deliberate local configuration edit to `purchased` confirms purchase. Purchase does not bypass release.
- No backend, database, new auth, storage, notifications, price tracking, retailer integration, new dependency, new font or remote asset.
- Existing puzzle is not secure authentication. Do not print its value or add another copy of it to tests/documents.
- Preserve existing files/work and visual-companion artifacts. No automatic cleanup of unrelated `.superpowers/` contents.

## Review Focus

- A traveler at the same instant must see the same iPad state, while legacy birthday message gates keep their device-local behavior (Tasks 1 and 3).
- A sleeping/background tab must jump straight to the correct placement/content on resume, without stale animation, drift or an extra minute past zero (Tasks 1 and 2).
- An open reveal crossing October 24 must close without losing focus to the removed opener; an unrelated focused control must not lose focus at midnight (Tasks 2 and 3).
- A late gallery handoff must not cover or reopen over the newer iPad reveal, even if that reveal was quickly dismissed (Task 3).
- Missing/invalid configuration and early/manual purchase must not fabricate a timer or reveal the surprise early; later years must never restart it (Tasks 1–3).

---

## Preflight gate — not permission to install

- [ ] Run `pwd`, `git branch --show-current`, `git status --short`; confirm required path/branch and preserve all unfamiliar modifications.
- [ ] Read `AGENTS.md`, `CLAUDE.md`, approved design and relevant current source. Confirm `package.json` still pins the expected preview.
- [ ] Check `node_modules/next/dist/docs/`. It was absent during planning. **If still absent, stop execution and request approval for dependency setup or ask the user to provide the matching installed documentation.** Do not install during this planning session or fetch substitute stable docs and call them the installed preview docs.
- [x] Matching installed client/prerendering and CSS guidance read after user-approved setup; paths and outcome recorded below. Recheck if dependency version changes before execution. If other preview guidance contradicts the proposed integration, amend the plan for approval before coding.
- [ ] With approved dependencies/docs available, record baseline `pnpm lint`, `pnpm typecheck`, and focused birthday tests. Use the existing synthetic network fixtures. Do not assume an old localhost preview is still running or reuse another worktree's server/build output.

## Files and exact contracts

| File | Responsibility |
| --- | --- |
| Create `src/data/ipadCountdown.ts` | `IpadCountdownConfig` and `ipadCountdownConfig`, local one-off values. |
| Create `src/utils/ipadCountdown.ts` | Pure validation/state/remaining-time and next-boundary calculation. |
| Create `src/hooks/useIpadCountdown.ts` | One cancellable clock subscription; no navigation or gallery state. |
| Create `src/components/IpadPromiseCertificate.tsx` | Stateless Spanish full/compact certificate; decorative illustration and optional full-view flourish. |
| Create `src/components/IpadCountdown.tsx` | Placement, reveal boolean, stable fallback focus heading, `JournalDialog` wiring. |
| Create `src/components/ipad-countdown.css` | Scoped theme-aware illustration, wrapping and reduced-motion rules. |
| Modify `src/sections/QualityTracker.tsx` | Import and render `<IpadCountdown />` after main card, before existing `<BirthdayCountdown />`; no prop changes to old components. |
| Create `tests/e2e/ipad-countdown-model.spec.ts` | Pure contract and static-render tests in existing Playwright runner. |
| Create `tests/e2e/ipad-countdown.spec.ts` | Real homepage/browser clock, visibility, motion and dialog regressions. |

No test route, production query override, public purchase toggle, new provider or generic countdown engine.

Types (export from the files above, referenced unchanged by later tasks):

```ts
// src/data/ipadCountdown.ts
interface IpadCountdownConfig {
  revealAt: string;
  inlineAt: string;
  targetAt: string;
  timeZone: string;
  purchaseStatus: "pending" | "purchased";
}

// src/utils/ipadCountdown.ts
type IpadPlacement = "hidden" | "reveal" | "inline";
type IpadContent = "pending" | "shopping-open" | "purchased" | "invalid";
interface IpadCountdownModel {
  placement: IpadPlacement;
  content: IpadContent;
  remaining: { days: number; hours: number; minutes: number } | null;
  targetLabel: string | null;
  isTargetDay: boolean;
  nextBoundaryAt: number | null;
}
deriveIpadCountdown(config: unknown, nowMs: number): IpadCountdownModel;

// src/hooks/useIpadCountdown.ts
useIpadCountdown(config: unknown, revealOpen: boolean): IpadCountdownModel | null;

// src/components/IpadPromiseCertificate.tsx
interface IpadPromiseCertificateProps {
  model: IpadCountdownModel;
  variant: "full" | "compact";
}
// src/components/IpadCountdown.tsx
// default function IpadCountdown(): React.JSX.Element | null
```

`null` from the hook is the deterministic initial server/client result. `hidden` is a resolved placement, not a loading state. The pure model always describes the next meaningful date boundary; the hook decides whether a minute tick is needed. `content` on a hidden model is not rendered.

## Task 1: Deterministic one-off date model

**Files:** configuration and utility files; `tests/e2e/ipad-countdown-model.spec.ts`.

**Interfaces:** Produce `IpadCountdownConfig`, `ipadCountdownConfig`, `IpadCountdownModel`, and `deriveIpadCountdown(config: unknown, nowMs: number)` exactly as above.

- [ ] **Write failing model tests.** Import the not-yet-created modules; table-test the following exact assertions using explicit timestamps, never `Date.now()`:
  - Reveal start −1ms → hidden; exact/+1ms → reveal; inline start −1ms → reveal; exact/+1ms → inline.
  - Target −1ms → pending with `{ days: 0, hours: 0, minutes: 1 }`; target exact/+1ms → shopping-open with `remaining: null`.
  - Target −60,001ms → two minutes; −60,000ms → one minute; −86,400,000ms → one day, zero hours/minutes. Clamp before rounding; values never negative.
  - `2026-11-27T22:59:59.999Z` has `isTargetDay: true`; `2026-11-27T23:00:00Z` has `isTargetDay: false`.
  - `2026-10-24T22:00:00Z` to target spans the DST change: remaining 33 days, 1 hour, 0 minutes. Same input instant produces identical model under different process timezones.
  - Pending in 2027 remains shopping-open, not a new countdown. Purchased before reveal stays hidden; during reveal/after inline/after target returns purchased, no remaining time.
  - `undefined`, null, invalid/missing target, offset-free timestamp, impossible calendar date, unsupported timezone, unknown purchase status, unordered schedule, and nonfinite `nowMs` never throw. Invalid release schedule/nonfinite now → hidden; valid release with invalid other config → invalid certificate after release, no target label or timer.
  - `nextBoundaryAt` is always future or null; it selects upcoming reveal, inline, target, or target-day end. Purchased/invalid after inline need no future boundary.
- [ ] **Run RED:** `pnpm test:e2e tests/e2e/ipad-countdown-model.spec.ts --project=desktop`. Expected: missing module/export, not browser/network setup failure.
- [ ] **Implement the local config and pure derivation.** Use approved ISO strings and `Europe/Madrid`; validate explicit offsets and actual calendar fields, not `Date.parse` alone. Verify `revealAt < inlineAt < targetAt`. Validate IANA timezone via `Intl.DateTimeFormat` with try/catch. Avoid locale-dependent parsing; display labels use explicit timezone. Target-day end for this one-off event is `2026-11-28T00:00:00+01:00`; derive it from the validated target date in its display timezone rather than a device-local date. Keep invalid date parsing from influencing valid release placement.
- [ ] **Run GREEN:** same command; all assertions pass. Also `pnpm typecheck` passes. Review helper scope: one promise, no recurrence or modification to `dateFormatter.ts`.

## Task 2: Readable presentation and cancellable client clock

**Files:** hook, stateless certificate, feature component, scoped CSS; both new test files. Temporarily no homepage insertion until Task 3.

**Interfaces:** Consume Task 1 model. Produce the hook/component contracts above. Certificate renders a semantic section labelled “Departamento de Promesas Pendientes”, no live ticking region; variant changes composition, not meaning.

- [ ] **Add failing static presentation tests** in the model spec using `renderToStaticMarkup` plus `React.createElement(IpadPromiseCertificate, ...)`, and parse that markup with browser `page.setContent` when semantic queries are needed. Assert:
  - Singular/plural: `1 día`, `1 hora`, `1 minuto`; zeros and wrapped long values remain text, not four boxes.
  - Pending includes correct Palma date label and “Esperamos ofertas. No las fabricamos.”
  - Target-day shopping-open uses “Hoy toca buscar tu iPad.”; subsequent days use “Ya podemos buscar tu iPad.” and no remaining timer.
  - Purchased says “Tu iPad ya está comprado.”, has COMPRADO seal, no timer or delivery claim.
  - Invalid says “La promesa sigue en pie. El reloj está de papeleo.”, no NaN/date/timer. Full and compact expose the same truthful status; decoration is `aria-hidden`.
  - No `aria-live` on timer; no public purchase control. Render both variants from injected model inputs, not a production override.
- [ ] **Run RED:** model-spec command from Task 1; expected missing certificate import or exact copy failure.
- [ ] **Implement the stateless certificate and CSS.** Use approved exact copy; pending full title “Tu iPad no se ha perdido.”, compact title “Lo del iPad sigue en pie. El reloj, no.” Reuse current journal fonts, ink/cloud/surface tokens and illustrated fish/soft-clock style; author focused SVG/CSS without importing/remounting the active postal scene. One compact melting-paper/drawer silhouette, not the tall mockup layout. Full flourish is CSS-only, decorative, at most 800ms, no delayed callbacks. `prefers-reduced-motion` disables it; hidden/closed content has no running animation. Text and close remain readable immediately.
- [ ] **Implement `useIpadCountdown`.** Start `null`; derive first timestamp in an effect. One pending timeout at most. When visible, schedule the earlier of next model boundary and next minute boundary only if a pending timer is actually displayed (`inline` or open reveal). Clamp timeout delay to 2,147,483,647ms; recompute on every callback. Closed reveal/pre-release schedules only the next placement boundary. Background visibility clears the timeout; visibility restoration and focus immediately recompute and rearm. Cleanup removes timeout/listeners; changing `revealOpen` replaces the schedule. No decrementing state or server timestamp.
- [ ] **Implement `IpadCountdown` composition.** Read local config, hold one reveal boolean, call hook unconditionally. Reveal button only in reveal placement; compact only in inline placement; hidden/initial-null shows nothing. `JournalDialog` title “Departamento de Promesas Pendientes”; close/Escape only sets reveal false. When resolved placement leaves reveal, close it; if it was open, focus the new stable `tabIndex={-1}` heading after dialog cleanup. Ordinary inline updates must not move focus. Shared native ownership version already arbitrates pending gallery; do not add another timer/handoff. Preserve once-per-mounted-feature polite transition feedback without announcing ticks or re-announcing on resume.
- [ ] **Run GREEN:** model/static tests and `pnpm typecheck`. Browser hook scheduling is proven through the real integration in Task 3 rather than by adding a test route or runtime bypass.

## Task 3: Homepage integration and boundary/dialog regressions

**Files:** `src/sections/QualityTracker.tsx`, `tests/e2e/ipad-countdown.spec.ts`; adjust only new feature files for failures.

**Interfaces:** Render `<IpadCountdown />` without week, year, password or gallery props. Reuse `installJournalFixtures` and existing synthetic birthday entry wording; reuse existing puzzle derivation pattern in memory only, never log its value. No changes to old date utilities or dialog contracts expected.

- [ ] **Write failing browser tests before insertion.** Install Playwright's advancing clock before fixtures, then use `setSystemTime`/`runFor` consistently; fixed Date alone is not sufficient for timer assertions. Register a controllable test-only visibility getter and dispatch `visibilitychange` for background simulation. All API requests remain synthetic through the existing fixture. Cases/assertions:
  1. No feature at release −1ms; advancing 1ms produces only the button. Clicking/Enter opens exactly one named dialog, close gets initial focus; Escape restores opener and scroll. Text is present at first animation frame.
  2. At inline start −1ms, open reveal; advancing 1ms replaces it with inline certificate, closes dialog, focuses stable feature heading; no subsequent callback reopens it. Repeat with unrelated focused control and no open reveal: its focus stays put.
  3. Load directly October 24 without prior visit: inline visible. Navigate previous/next/current/random/saved historical birthday week: same certificate, no duplicate nodes or resetting target. Loading/error/missing quality does not hide it.
  4. At target −1ms show 1 minute; advance 1ms → shopping-open, no negative/all-zero countdown. Resume after target/day-end/year change → appropriate settled copy, no recurrence. Show one polite transition status, no repeated tick/resume announcements.
  5. Jump clock forward five hours between ticks: displayed time derives from timestamp. Simulate hidden tab, move past target, resume: immediate settled message. Page focus also refreshes after sleep. Test October DST span.
  6. Instrument `setTimeout`/`clearTimeout` and focus/visibility listeners in an init script with callback source labels for this hook, delegating all originals. Assert one feature timer maximum, no minute ticker while reveal closed, no timer while document hidden, minute ticker while reveal open/inline, only future boundary timer after close, none after unmount. Use `/history` client navigation and assert no retained feature callbacks/listeners; don't count unrelated app timers.
  7. Run same real instants in browser contexts with Europe/Madrid, UTC, America/New_York, Asia/Tokyo. New feature placement/time identical. At a cross-date instant, legacy birthday gate still follows existing device date; do not rewrite it to match Palma.
  8. On birthday, start successful puzzle→gallery handoff, activate new iPad reveal before 280ms, then close quickly. Advance past handoff: no gallery reopens. Rapid double activation and subsequent open/close cycles always yield at most one dialog, stable focus and no stale animation. Normal puzzle/gallery without iPad interaction still works.
  9. At 320px, 390px, 1440px and 844×390, certificate/dialog scrolls naturally, no horizontal overflow, all controls stable and at least 44×44px. Reduced-motion has no running feature animations; toggling reduced motion mid-flourish settles immediately. All dawn/day/dusk/night palettes retain legible opaque text surfaces.
  10. Collect console/page errors; reject feature-specific hydration diagnostics. Retain only the existing exact known home-calendar diagnostic allowance, never a general hydration-error filter. Confirm source starts with deterministic null, including static-render test of `<IpadCountdown />`.
- [ ] **Run RED:** `pnpm test:e2e tests/e2e/ipad-countdown.spec.ts --project=phone`. Expected missing button/certificate assertions, with functioning synthetic app setup.
- [ ] **Insert the single feature slot** after the main surface card and before existing birthday countdown. No changes to PostOffice, old countdown, puzzle, gallery, navigation, date helpers or service code unless a demonstrated integration defect requires a narrowly reviewed plan amendment.
- [ ] **Run GREEN:** `pnpm test:e2e tests/e2e/ipad-countdown-model.spec.ts tests/e2e/ipad-countdown.spec.ts` on both configured projects. Fix only actual feature defects or demonstrated test setup problems. Report actual counts, not predicted totals.
- [ ] **Prove configured variants without runtime test infrastructure.** Task 1 tests inject invalid/purchased configuration directly; Task 2 tests render their resulting models in full/compact variants. The real homepage uses the same stateless certificate. No source rewriting, dev-server module interception, production test route or public override. Manually review the single production config→hook→model→certificate path to confirm no alternative interpretation of purchased/invalid states.
- [ ] **Run focused existing regressions:** `pnpm test:e2e tests/e2e/birthday.spec.ts tests/e2e/surprises.spec.ts tests/e2e/fish-delivery.spec.ts tests/e2e/fish-delivery-fix.spec.ts tests/e2e/post-office.spec.ts tests/e2e/home-interactions.spec.ts tests/e2e/history.spec.ts`. Expected all pass; preserve pre-birthday gating, historical birthday access, 280ms handoff, input/shortcut suppression, old annual countdown, postal animation cancellation and restored week behavior.

## Task 4: Actual-motion review and final verification

**Files:** verification results appended to this plan; synthetic evidence under ignored `playwright-report/ipad-countdown/`. No new product scope.

- [ ] **Run full automated gates:** `pnpm test:e2e`, `pnpm check`, `git diff --check`. Expected all tests/checks pass; disclose existing warnings from fresh output. Build must use this worktree and must not contend with an existing dev server's `.next` output. Stop/request coordination instead of killing a user server or writing into another worktree. No `pnpm test:telegram`.
- [ ] **Capture and inspect** reveal before/during/after flourish plus compact/pending/target reached on phone/desktop; all palettes and 320px/reduced-motion examples. Use fictional quality/photo fixtures only. Look at actual intermediate frames or playback, not just CSS declarations: paper/clock style belongs to current website, movement is bounded, text is immediately readable, close/trigger are stationary, no opaque scenery covers content. Compact feature does not push the existing letter down or become a second full-screen theatre.
- [ ] **Manual browser checks:** keyboard-only open/Tab/Shift+Tab/Escape, original-focus restoration, open-dialog midnight focus, rapid repeat activation, gallery→iPad arbitration, real background/foreground and device sleep if available, 200% zoom/reflow, short landscape, live reduced-motion toggle. Distinguish synthetic visibility simulation from real OS sleep and screen-reader checks; report anything not actually verified.
- [ ] **Self-review the diff against spec and old birthday behavior.** Verify exactly one local config, no accidental secrets or fixture copies, no service changes, no new dependencies, no yearly recurrence, no price/delivery claims, no second dialog ownership system, no broad refactor. Record any unexpected touched file and why.
- [ ] **Report outcome and stop.** Link design, plan and inspected evidence; list verification commands/results and limitations. Leave all work uncommitted for user review. Do not open PR, push, merge or deploy.

## Planning review and current status

- [x] Approved design translated into placement, exact instant, manual purchase, truthful copy and fixed one-off states.
- [x] File responsibilities and signatures agree across tasks; no backend/test route/runtime override added.
- [x] Test-first steps cover date, DST, device zones, lifecycle, hydration, invalid config, historic navigation and native modal handoff.
- [x] All five Review Focus items map to explicit task assertions.
- [x] Visual mockups are concept-only; actual website styling and normal-motion inspection remain acceptance criteria.
- [x] Independent design builder review completed before design approval; implementation plan self-reviewed against design/source, no implementation agents dispatched.
- [x] Matching installed Next preview documentation available/read after explicit setup approval; blocker resolved.
- [x] User approves this implementation plan and chooses native execution.
- [x] Implementation and automated verification performed; fresh review/handoff recorded below.

The task checklists above are the original execution instructions. Actual results, including failed attempts and limitations, are recorded below and in `.superpowers/sdd/2026-10-21-ipad-countdown/progress.md`.

### Setup-only follow-up — 2026-10-21

The user explicitly approved dependency setup, not implementation. `pnpm install --frozen-lockfile` succeeded using pnpm 11.17.0, installing the existing locked dependencies including Next 16.3.0-preview.6. No tracked manifest, lockfile or workspace configuration changed.

Read matching installed documentation:
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, client lifecycle/browser APIs and prerendering/hydration sections.
- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`.
- `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`, component styling/global CSS guidance.

These confirm client components are still prerendered on initial load: keep deterministic initial null and read the clock/browser APIs only after mounting. CSS may persist across route navigation: prefix every selector/keyframe in `ipad-countdown.css` with the feature namespace; no bare element selectors, root variable overrides or global animation names. Existing component-colocated stylesheet conventions can remain. No architecture change is required. Implementation approval is still pending.

### Native implementation verification — 2026-10-22

The user subsequently approved the plan and native implementation. All product changes remain in this feature worktree and uncommitted.

| Gate | Actual result |
| --- | --- |
| Existing birthday baseline | 46/46 passed. |
| Task 1 model | Missing-module RED; 32/32 initial GREEN. |
| Task 2 presentation | Missing-certificate RED; 42/42 initial GREEN; typecheck passed. |
| New feature checks | Missing-trigger RED; 122 checks passed across both projects, including strict invalid-status regression, real animation geometry, and exact existing hydration-diagnostic comparison. |
| Full suite | `pnpm test:e2e --workers=1`: **338/338 passed**, 13.1m, no skips. Latest full log: `.superpowers/sdd/2026-10-21-ipad-countdown/task-3-tests.log`. |
| Project gates | `pnpm check` passed: lint (eight existing warnings), formatting, typecheck, Knip, dependency-cruiser, optimized production build (8/8 static pages). Repeated after full browser suite via task-4 runner. |
| Whitespace | `git diff --check` passed. |

Preserved failed attempts: baseline command timeout left its own dev server with a blocked output pipe; only this session's verified processes were stopped. Focused regressions initially had 136 pass /2 fail because an existing fish-delivery test supplied an undefined custom-context baseURL; fixed that one line to use the configured URL. An earlier full run had236 pass /102 fail after server loss, including one earlier original scroll-restoration failure; that exact scroll case passed4 unchanged repetitions. The subsequent single-worker full suite is the complete green gate, not an assertion that earlier attempts passed. Server-loss source is not conclusively established.

Implementation adjustments: Biome excludes generated `.superpowers` mockup/ledger scratch, matching report exclusions. Placement/content type aliases remain internal to the exported model to satisfy Knip. Purchase status requires exact string enum equality (a coercible object is invalid). No old date, gallery, dialog, puzzle, data or service logic was rewritten.

Synthetic screenshots and inspected animation frames: `playwright-report/ipad-countdown/reveal-{phone,desktop}-{0,350,700}.png`, `compact-{phone,desktop}.png`, and `shopping-{phone,desktop}.png`. The paper, clock and fish use the app's current illustrated language and typography. Close/control geometry stays fixed; all information is immediately visible. Compact placement does not move the earlier weekly letter.

Browser tests exercised keyboard opening/Tab/Escape, focus restoration and midnight fallback focus, native gallery arbitration, repeated activation,320px and short landscape, theme surface contrast ≥4.5:1, reduced motion (including preference changes), and simulated visibility/sleep/resume. These are browser automation, not OS assistive-technology certification. Real OS screen readers, real device sleep, physical iPad/Safari and manual browser200%zoom remain unverified. Existing synthetic-date versus server-date birthday/calendar hydration diagnostics remain disclosed; the new feature itself renders deterministic initial null, and its dedicated historical-calendar diagnostic comparison passes without a broader allowance.

Fresh-context review: **approved**, with no Critical, Important or Minor findings after reviewing actual uncommitted filesystem files, birthday/dialog integration and screenshots. Reviewer did not rerun the suite or claim real-device/screen-reader certification. No product edits after the passing full suite.

Supplementary evidence: all eight reduced-motion320px reveal/compact screenshots for day/dawn/dusk/night captured and visually inspected under `playwright-report/ipad-countdown/supplementary/`. They preserve readable surfaces, illustration and controls; manual200%browser zoom remains unverified. The capture-only local server was stopped afterward; no user server touched.

No staging, commits, pushes, PRs, merges, deployments, environment-file reads or live private API calls. Configure a real purchase later by deliberately changing `purchaseStatus` in `src/data/ipadCountdown.ts` to `"purchased"`; there is no public purchase control. Worktree and uncommitted work remain preserved.

### PR-preparation checks — 2026-10-22

The user subsequently requested committing, rerunning all checks and opening a PR (not merging or deploying). Fresh full run:337/338 passed; the only failure was the existing birthday handoff's scroll expectation. Twelve traced repetitions reproduced it six times and proved the browser automation sometimes scrolled100→0 **before** pointerdown and `showModal`; the dialog then correctly saved/restored0. The test had sampled its expected100 before Playwright's implicit pointer-click scrolling.

Corrected only this test's first activation: focus the real hint with `preventScroll`, then DOM-click it, matching the explicit DOM clicks already used for the timed handoff. The native dialog still must be visible, focus its input, return focus to the original hint and restore the exact chosen100px scroll. No application dialog behavior or assertions were relaxed. Omitting explicit focus in the first test-only correction correctly failed focus restoration; adding it preserved the full original contract. The corrected case passed **24/24 repeated phone/desktop runs**. Trace artifacts remain local; the temporary investigation spec was removed. Fresh full-suite/project checks are rerunning before PR publication.
