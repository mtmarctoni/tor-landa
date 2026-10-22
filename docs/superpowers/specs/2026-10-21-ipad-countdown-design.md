# iPad countdown — design for approval

Status: user approved the complete design in conversation; not authorization to implement. Date: 2026-10-21.

## Intent and scope

A real birthday promise becomes an affectionate running joke while waiting to shop for an iPad on Black Friday. This is not a sale, price tracker, delivery estimate, or guarantee of a discount. The weekly love letter remains the emotional center.

Use the existing React/TypeScript, CSS, Framer Motion and native dialog patterns. No dependencies, API changes, backend, storage, scheduled work, authentication changes, retailer links, notifications, or purchase automation. No private-shoebox work. No commits, pushes, PRs, deployment or live-service changes without separate permission.

Work only in `/Users/mtm/.local/share/opencode/worktree/bc1d6b/ipad-countdown`, branch `feat/ipad-countdown`. Initial git status was clean. Only planning documents and explicitly requested throwaway visual companion files have been written.

## Decisions supplied by the user

- The countdown concept is approved in principle.
- October 23 is the surprise day: a “¿Y mi iPad?” interaction is enough for the first discovery.
- After October 23 the countdown may be always visible, rather than hidden in the birthday experience.
- Target: **2026-11-27 00:00 Europe/Madrid**, Palma de Mallorca local time. The user explicitly confirmed year and midnight.
- Exact target instant: **2026-11-26T23:00:00Z**, equivalently `2026-11-27T00:00:00+01:00`.
- Black Friday 2026 is November 27, verified against https://www.timeanddate.com/holidays/us/black-friday (checked during this conversation).
- Include a simple manually configured purchased state, not a public control.
- The “Departamento de Promesas Pendientes” idea and increased surrealism are welcomed, but the final implementation must retain **the website's own existing style**, not transplant the mockup's visual styling.

The remaining defaults below are recommendations for approval with this document, not earlier user decisions.

## Existing behavior that must be preserved

`src/utils/dateFormatter.ts` defines Landa's birthday as October 23. Its birthday-week calculation is the app's own non-ISO week convention. `isLandaBirthdayWeek` requires the selected birthday week/year and real current time at or after October 23 midnight in the device timezone. Historical birthday weeks remain eligible after their date. Do not replace these rules or assume “week 43” is universal.

`QualityTracker` gates the selected birthday week's message before its birthday. `QualityCard` exposes the puzzle only through particular phrases in a released birthday message. The puzzle is browser-side play, not secure authentication. Successful completion closes the puzzle and opens the photo gallery after a guarded 280ms handoff. The shared dialog acquisition version cancels an obsolete handoff if a newer dialog acquired ownership. Native `JournalDialog` owns Escape, initial focus, scroll locking, and restoration.

The separate `BirthdayCountdown` recurs annually and is shown near the birthday; it is not the iPad countdown. Leave it and the weekly navigator, saved-week restoration, history, data loading and photo flow unchanged.

Relevant existing evidence: `tests/e2e/birthday.spec.ts`, `tests/e2e/journal.fixture.ts`, redesign verification and the impossible-post-office / fish-delivery plans in `docs/superpowers/plans/`. The redesign verification documents pre-existing fake-browser-date versus server-date hydration diagnostics. Do not hide these or use them to excuse a new feature-specific mismatch.

## Placement and access — proposed defaults

This is a **one-off 2026 experience**, not an annual birthday feature.

1. Before `2026-10-23T00:00:00+02:00`: no iPad teaser or countdown.
2. During October 23 in Palma (`2026-10-22T22:00:00Z` inclusive through `2026-10-23T22:00:00Z` exclusive): show a stationary “¿Y mi iPad?” button in a small birthday-adjacent slot on the homepage, after the main weekly card. Activation opens the full promise certificate in a `JournalDialog`.
3. From October 24 at Palma midnight (`2026-10-23T22:00:00Z`): replace the button with an always-rendered compact certificate in the same slot. It is ordinary page content, not sticky, fixed, automatically scrolled into view, or automatically opened as a dialog. Keep the full reveal as the birthday-day presentation only.
4. Access is independent of selected week, available messages, matching puzzle phrases, and photo loading. An old selected week must not conceal the real 2026 promise. This does not change the existing message/puzzle gates.
5. No persistent “seen” flag or automatic opening. The button may be used again on October 23; there is no automatic replay or surprise on future visits. Someone who misses October 23 can read the compact version on October 24.
6. The certificate remains visible after the target and after manual purchase, using settled copy; no expiration or annual rollover. A future removal is a deliberate code change, not a new lifecycle subsystem.

The new one-off release schedule uses Palma instants on all devices. Existing birthday utilities retain their device-local convention. Thus a traveler can see the iPad entry while the legacy birthday message is still gated locally, or vice versa: this is deliberate isolation, not a change to birthday release rules. Explain this in regression tests.

## One coherent visual story

**Departamento de Promesas Pendientes**, a small impossible extension of Correos imposibles. The promise certificate melts over its own skewed drawer; a soft clock has lost the ability to stand upright. The familiar postal fish reluctantly witnesses the promise. A miniature label, clearly not a delivery, is the joke. It is one composition, not a separate carnival of every existing character.

Use the app's current `--journal-ink`, `--dream-cloud` and related theme tokens, current journal serif/sans fonts, illustrated outlined SVG/CSS language, postal paper, existing palette and dawn/day/dusk/night treatments. No new fonts, image sources, icon pack, gradients or replacement design system. Do not copy the mockup's hardcoded full-screen background, typography, oversized scenery, or layout literally. Keep the compact version substantially smaller than the full reveal and below the weekly experience, without changing the weekly letter's current reading position.

The full certificate can afford more visual depth; compact uses the same recognizable paper/clock silhouette with reduced scenery. Numeric text sits on a stable opaque readable paper area, never follows the melted edge or travels with the fish. No four digital tiles. Decorative elements are hidden from assistive technology.

Visual companion iterations are disposable concept evidence in `.superpowers/brainstorm/31171-1792605836/content/`. They contain fictional text and static sample numbers. They are not production scaffolding or final visual approval of CSS.

## Copy and state transitions — proposed final wording

Shared identity: “Departamento de Promesas Pendientes”; seal “PROMETIDO. NO OLVIDADO.”

**Before target, pending purchase:**

- Full title: “Tu iPad no se ha perdido.”
- Body: “He prometido un iPad. El tiempo ha presentado una reclamación.”
- Compact title: “Lo del iPad sigue en pie. El reloj, no.”
- Timer: “35 días, 8 horas y 12 minutos para salir a buscarlo.” (example only; correct singular/plural in actual output).
- Date label: “27 noviembre 2026 · 00:00 · hora de Palma”.
- Clarification: “Esperamos ofertas. No las fabricamos.”
- Optional fish aside in full view: “Yo reparto cartas. Lo de las compras no venía en mi contrato.”

**Exactly at and after target, still pending purchase:**

- Heading: “Se abre el plazo de cumplir la promesa.”
- Body: “Hoy toca buscar tu iPad. El pez no garantiza ofertas, pero yo no me he olvidado.”
- After the target's Palma calendar day, replace “Hoy toca buscar tu iPad.” with “Ya podemos buscar tu iPad.” so the message does not falsely claim every later day is the target day.
- No remaining timer, negative number, next-year target, purchase stamp, delivery animation, or automatic gallery opening.

**Explicitly configured purchased, at any time after release:**

- Seal: “COMPRADO”.
- Heading: “Comprado. El departamento puede respirar.”
- Body: “Tu iPad ya está comprado.”
- Omit a claim that delivery is still pending: the approved purchase flag alone cannot tell us whether it has arrived.
- No remaining countdown or assumption about arrival. The purchase state overrides the timer, never the release date.

**Invalid or missing configuration:** no fabricated numbers, `NaN`, dates or success state. After a valid release schedule, display “La promesa sigue en pie. El reloj está de papeleo.” with no timer. If the fixed release schedule itself is invalid, render no feature (fail closed before any surprise). Validate the entire local configuration, including purchase status; do not treat an unknown status as purchased.

## Configuration and time model

A small local typed configuration holds the fixed reveal start, inline start, target ISO instant with explicit offset, IANA display timezone `Europe/Madrid`, and status `pending | purchased`. Initial production status is `pending`; a deliberate code edit marks it purchased. No environment variable, API, public toggle, local storage, purchase date, or generic event engine.

Keep the feature's pure date/state derivation separate from legacy birthday helpers. It accepts configuration and a timestamp, and returns hidden / birthday-reveal / inline placement plus pending / shopping-open / purchased / invalid content. This allows deterministic tests and avoids leaking selected historical week/year into the shopping date.

Precision: whole days/hours/minutes, no displayed seconds. Calculate from `max(0, targetMs - nowMs)` afresh; round remaining minutes upward before decomposing so the UI does not say all-zero minutes before the actual instant. Days are elapsed 24-hour units, not local calendar-day counts; the October DST transition is handled by timestamp arithmetic. The terminal state switches at `nowMs >= targetMs`, even if the display is minute-precision. The next scheduled update must not overshoot a known target or placement boundary by waiting a full extra minute.

Client clock is sufficient. No server synchronization. Do not derive the initial rendered feature from either a server clock or a client-only timestamp during hydration: start with the same empty feature slot, then resolve from the client timestamp after mounting. Existing server-rendered weekly content is unchanged. The iPad feature itself must add no hydration warnings.

While the page is visible, update on minute boundaries and the next relevant release/inline/target/day-copy boundary, whichever is sooner. Recompute immediately on visibility restoration and window focus; use current timestamps, not accumulated decrements. In a background tab suspend recurring updates, then catch up on resume. The closed birthday reveal has no running countdown ticker, but a lightweight page-level schedule still detects October 24 and release boundaries while the page is visible. Prior to release, only schedule the next release boundary, not a per-minute hidden ticker. The inline certificate updates while visible on the page, including if below the viewport; no IntersectionObserver is necessary.

Clean up all timeouts and visibility/focus listeners on unmount/navigation and stop modal-specific work on close. Long sleeps and throttled callbacks recompute from now and settle directly to the right state. Bound scheduled delays safely rather than assuming an indefinitely long timeout works.

## Dialog, motion and accessibility

- Reuse `JournalDialog`; no new overlay ownership system and no nested dialogs. On October 23, existing open dialogs prevent activation through native modal inertness. A newer iPad dialog acquisition must invalidate a pending gallery handoff through the existing ownership version. Do not reopen either dialog after dismissal.
- If midnight changes the reveal into inline content while its dialog is open, close the reveal, render the inline certificate, and restore focus to a stable, programmatically focusable feature heading because the original button no longer exists. Do not steal focus on an ordinary inline midnight update when no feature dialog is open.
- Optional single decorative clock slump/stamp flourish, total at most 800ms, with information and close control available from the first frame. No essential sequencing, delayed callbacks, replay system, looping movement, autoplay audio, flashing, or scroll/focus choreography. Reduced motion shows the final static illustration immediately. No skip/pause control is needed for this short nonblocking flourish; if implementation expands it, revisit that decision rather than silently adding a sequence.
- Essential controls remain stationary and at least 44px touch targets. Preserve Escape, Tab order, background inertness, focus/scroll restoration and suppression of week shortcuts inside dialogs.
- Timer text has no ticking live region. A separate polite, atomic status can announce the transition to shopping-open once while the feature is active, not every minute or again on each resume. Purchased is explicitly configured content, not a runtime notification system.
- Spanish semantic headings/text, visible focus and sufficient contrast across existing palettes. At 320px the timer wraps naturally without clipping or horizontal scrolling. Expanded illustration must not obstruct controls or long content, including short landscape and zoom/reflow.

## File responsibilities (to refine in the implementation plan)

- Local `src/data/ipadCountdown.ts`: explicit one-off configuration and exported type.
- `src/utils/ipadCountdown.ts`: pure validation, placement/state and remaining-time derivation; no mutation of existing birthday utilities.
- `src/components/IpadCountdown.tsx`: compact and birthday reveal composition, with one focused local scheduling hook only if needed for readability.
- `src/components/ipad-countdown.css`: scoped illustration and responsive/motion styles using current site tokens.
- `src/sections/QualityTracker.tsx`: one feature slot after the existing main card and before the old birthday countdown; do not remount the weekly card or gallery. Component may own its own reveal boolean; native dialog ownership remains shared.
- Tests under `tests/e2e/`: pure date tests can use Playwright's existing runner without adding a unit-test dependency; browser coverage uses existing synthetic routing and fixed clocks.

Exact component/helper signatures and whether a small hook is worth extracting are builder calls for the plan, not an invitation to a generic countdown framework.

## Verification acceptance

Test first with fixed/mocked dates, no dependency on today. Cover release minus 1ms / exact / plus 1ms, October 24 boundary, target minus 1ms / exact / plus 1ms, later Palma days and later years, DST span, invalid and missing config, unknown purchase status, purchased before/after target, no recurrence, and equal instants in Madrid/UTC/America/New_York/Asia/Tokyo browser timezones.

Browser coverage: button-only birthday discovery; independent inline display afterward; missed birthday; historical week selection; data loading/error; existing birthday gate and puzzle/gallery behavior; newer dialog canceling pending handoff; rapid repeated activation; Escape/focus restoration; open reveal crossing midnight; close/navigation cleanup; background/resume and sleep catch-up; current-timestamp recalculation rather than drift; no timer while modal closed; minute wrap and exact terminal transition; purchased and invalid displays.

Use deterministic time control appropriate to ticking tests (`page.clock.install`/advance rather than relying only on the existing fixture's fixed Date). Configuration variants are pure helper inputs or test-local interception of the imported configuration module at build/test boundaries if genuinely necessary; never add a public query-string purchase override. The plan must settle a small concrete test seam without adding runtime infrastructure.

Check 320px, standard phone and desktop, short landscape, keyboard, all existing time-of-day palettes and reduced motion. Actual browser observation of normal motion is required: inspect screenshots plus animation playback to confirm readable content, stable controls and coherent website styling, not just passing selectors.

Run existing birthday, surprise, postal-delivery and navigation regressions, then the full suite and project checks at implementation time. No live Notion, Telegram, remote optimizer fetches, or private photos in browser evidence. Do not run the Telegram smoke test for this presentation feature.

## Prerequisite and approval gates

The installed Next.js preview docs at `node_modules/next/dist/docs/` are **not present in this worktree** (checked). No dependency installation was attempted. Before framework-specific implementation details are finalized, an approved dependency setup must make the matching installed preview documentation available, then read the relevant client-rendering/hydration guidance. Current architecture is deliberately expressed as React/client behavior and existing repository patterns, not a claim about uninspected preview-specific APIs.

Setup follow-up: the user subsequently approved `pnpm install --frozen-lockfile`, which succeeded without tracked dependency-file changes. Matching Next 16.3.0-preview.6 client/prerendering and CSS docs have now been read (paths recorded in the implementation plan). The documentation blocker is resolved; deterministic initial rendering and feature-namespaced styles remain appropriate. This setup approval is not implementation approval.

Checklist:
- [x] Verify worktree, branch and initial status; inspect birthday flow and redesign context.
- [x] Resolve target instant and manual purchased state with user.
- [x] Explore visual concept; user requests retaining actual website styling.
- [x] Write design draft.
- [x] Independent builder check: no product ambiguities beyond approving these defaults; matching installed Next documentation remains an explicit planning prerequisite, with no dependency setup authorized.
- [x] User approves this complete design document, including proposed defaults.
- [x] Invoke writing-plans, write and review the test-first implementation plan.
- [x] Present plan and stop for explicit implementation approval; user subsequently approved native implementation.

No product code, scaffolding, dependencies or service resources are authorized by this document.
