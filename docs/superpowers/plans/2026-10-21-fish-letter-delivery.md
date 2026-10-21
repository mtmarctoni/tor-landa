# Fish and Letter Delivery Implementation Plan

> **For agentic workers:** Use subagent-driven-development for this focused motion sequence, followed by independent source and actual-motion review.

**Goal:** Deliver the sequence the user approved: fish visibly flies with a sealed oversized envelope, lands it with a silly bounce, the flap unfolds and letter emerges, then the teacup stamps it and the fish catches its breath.

**Architecture:** Keep the existing post-office prototype and authoritative tracker week/data logic. Add a bounded presentation-only delivery sequence, with a shared moving fish/cargo composition, an actual animated envelope flap, and a letter reveal. Controls and layout stay stationary. Reduced motion and skipping settle immediately to the open, readable letter.

**Tech Stack:** Existing Next.js/React/TypeScript/Framer Motion/CSS/Playwright. No new dependencies.

**Spec:** The user's latest approval explicitly requests the full fish-carrying-envelope/opening/reveal sequence, correcting the prior 25px/850ms fish-only motion. This supersedes the previous prototype's always-open-envelope requirement for normal motion. Preserve prior versions for comparison; no commits or remote changes.

## Global Constraints

- Current isolated branch `feat/surreal-love-laboratory`, uncommitted prior work. Preserve all historical checkpoints, plans and evidence. New evidence under `playwright-report/fish-delivery/`.
- Normal delivery: a clearly visible shared trip of at least 120px on phone and 220px on desktop; fish and actual envelope must both travel together, not just the fish or a tiny icon.
- Sequence completes within 3 seconds after resolved message availability; letter reveal begins within 2 seconds. Previous and next deliveries visibly enter from opposite sides. Real week changes, successful retry and same-week explicit random requests can trigger/retrigger; never fabricate a successful delivery for loading/error/missing/birthday-gated content.
- Actual sealed-envelope front/flap covers the message during travel, unfolds in 3D or a convincing paper-fold equivalent, and the letter visibly emerges into its final reading position. Short normal reveal is now user-approved; no artificial API/loading delay. Skip is always immediately available while running.
- `Saltar animación` is a stationary native 44px control, keyboard/touch accessible. Skipping removes all delivery travel/fold delays immediately without changing the selected message or focus unexpectedly. Avoid removing a focused element; a stable completed-state/replay button is acceptable.
- Reduced motion: fully open/readable message immediately, no flying/bounce/folding/scaling; changing OS preference mid-flight also settles. Preserve all jokes and real controls. Fail safe to readable content if animation completion events do not arrive.
- No message duplication visible to screen readers, focusable hidden contents, layout jumps, overflow at 320px, unbounded queued deliveries/timers/listeners, audio, flashing or focus theft. Long messages reserve their natural height. Navigation and modal ownership remain authoritative.
- Spanish affectionate absurdity and existing original paintings retained. No new dependencies, live private-service calls, environment reads, commits, staging, pushes, PRs or deployments.
- Existing user server `http://localhost:3021/`; use explicit `E2E_BASE_URL`, never kill or restart it.

## Review Focus

- Motion actually exists: prove substantial shared fish/envelope displacement and visible sealed → landed → open → stamped stages, not just CSS names or data attributes.
- Rapid previous/next/random actions and route changes: latest selection wins; old completion callbacks cannot open/stamp a new letter or leak timers.
- Skip/focus/reduced-motion toggles: immediate final geometry and readable message, no moving control or orphan focus.
- Loading/error/retry/birthday gate: real content availability is separate from animation completion and postal stamp semantics.
- Phone/desktop/day/night/320px/long text: believable choreography, stable targets, first-screen reading after completion, no visual or keyboard obstruction.

### Task 1: Actual shared delivery, opening and reveal

**Files:** `src/components/PostOffice.tsx`, `src/components/post-office.css`; create a focused delivery component/hook/style if needed. `src/sections/QualityTracker.tsx` only if presentation cue wiring needs it. Add `tests/e2e/fish-delivery.spec.ts`; adapt only superseded experimental postal/laboratory assertions. No data, API, date, storage or navigation-hook rewrite.

**Interfaces:** Consume selected week/year/direction, resolved message availability, and explicit random cue from current PostOffice props. Keep lunar controls/state outside animation remounts; only current delivery gets cancellation/restart identity. Preserve existing message, hint, star and navigation semantics.

- [x] Verify prior postal checkpoint and preserve a pre-delivery snapshot. Read current Next client/CSS guidance and inspect prior screenshots/video.
- [x] Write failing tests for substantial shared flight, sealed-to-open flap/reveal, opposite entry directions, stamping after arrival, skip, reduced motion and interrupted navigation. Run to show the existing tiny fish-only effect fails.
- [x] Implement the approved sequence with a brief but unmistakable shared flight, weight/swing, landing bounce, flap opening, emerging paper, stamp and exhausted-fish payoff. Keep the underlying layout stable.
- [x] Add/prove edge coverage: same-week random, retry/gated states, rapid navigation, cleanup/unmount, live reduced-motion toggle, skipped/completed focus, 320px long text and modal inertness. Update experimental tests whose immediate-animation assumptions are intentionally superseded without dropping their functional guarantees.
- [x] Capture an actual synthetic phone and desktop action video plus condition-sampled flight/landing/fold/open/stamp screenshots. Inspect intermediate frames, not only final screenshots; keep before/after source snapshots with hashes.
- [x] Run all browser tests and full `pnpm check`; independent source/motion review and fix important findings. Preserve the original 156 tests unless an explicitly documented changed visual requirement genuinely needs a test update.
- [x] Handoff as an uncommitted experiment with the working local preview, tested timing/movement facts and honest limitations. No release or remote actions.

## Handoff

Preview: `http://localhost:3021/`. Normal delivery completes in 2.7 seconds with shared fish/envelope travel, landing bounce, actual flap opening, paper emergence and stylized stamping/exhausted-fish payoff. Use `Repetir entrega` to replay or `Saltar animación` to settle immediately. Reduced motion is immediately open/static; native modal acquisition cancels to a fully readable static letter. Skip remains visible above long letters.

Fresh controller verification: **216 tests passed (6.7m)** and all six `pnpm check` gates passed, including optimized production build. Independent review identified two P2s (long-letter Skip reachability and modal CSS/semantic clock mismatch); both fixed and accepted on scoped re-review. Original tracked tests unchanged. One old experimental 1300ms cleanup wait was replaced with an actual-completion condition to accommodate the user-approved 2.7s sequence without dropping its cleanup assertions.

Actual intermediate frames, source/hash checkpoints and synthetic phone/desktop videos are in `playwright-report/fish-delivery/`, with fixed-layout/modal evidence under `fix/`. Historical source checkpoints preserved. Video files exist; actual motion assessed using intermediate browser PNGs and computed geometry because the image reader cannot replay WebM.

Eight baseline warnings and the known synthetic-date/server-date development hydration diagnostic remain. Physical devices, non-Chromium engines, OS screen readers and live private services are unverified. Existing artwork rights caveats unchanged. Everything remains uncommitted in the experiment worktree; original PR and its branch untouched. No remote changes or deployment.
