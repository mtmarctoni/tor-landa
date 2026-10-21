# Impossible Post Office Prototype Implementation Plan

> **For agentic workers:** Use subagent-driven-development for the focused prototype and an independent whole-diff review. This is an exploratory prototype, not a release or an expansion to every page.

**Goal:** Turn the existing illustrated love-letter website into one connected absurd postal scene, with characters responding to actual weekly reading actions.

**Architecture:** Preserve the current Next.js/React/Framer Motion app and its authoritative week/data logic. A small presentation-only scene state consumes real selected-week/direction/loading information and explicit random-memory requests. Recompose the existing fish, moon, painting, clock and teacup around the letter rather than adding another attraction below the controls.

**Tech Stack:** Existing Next.js 16.3 preview, React 19, TypeScript, CSS, Framer Motion and Playwright. No new dependencies.

**Spec:** User-approved description: “Landa's impossible post office.” The fish delivers an impossibly large letter; changing weeks reverses the clock, makes the painting peek, and changes the delivery direction; requesting a random saved week makes the moon jealous. Integrate the teacup into this shared scene, not a standalone theatre. Keep message and controls immediately usable. Preserve the current version for comparison and test the feeling on mobile before expanding history/birthdays/gallery.

## Global Constraints

- Work only in the existing `feat/surreal-love-laboratory` worktree. No commits, pushes, PRs, deployments or modification of the original PR branch.
- Before this prototype, the nine current source/config/test files were verified byte-identical to the preserved pass-two checkpoint under `playwright-report/laboratory/pass-2/source/`; keep that checkpoint intact.
- Spanish affectionate humor, readable unchanged personal messages, recognizable original paintings. No invented private relationship details.
- Keep existing APIs, date rules, storage, calendar keyboard behavior, birthday password, gallery handoff, dialog ownership, exports and archive functionality.
- No extra delay before reading, auto-changing weeks, unbounded effects, global keyboard capture, audio, flashing, moving focus targets or blocking overlays.
- Reduced-motion users receive immediate static equivalents of every visual joke. Touch and keyboard actions stay available and controls stationary, at least 44px high.
- Short weekly message begins within the first 500px on a 390px phone; no overflow at 320px and no scenery over long text or real controls. One shared scene must replace the separate tall theatre, not increase page length.
- No live private-service requests or environment-file reads; all browser evidence uses existing synthetic fixtures.

## Review Focus

- Navigation input parity: previous/next buttons, arrow keys, current-week return, saved shortcuts and random selection must all update the scene appropriately without changing authoritative navigation behavior.
- Repeated random selection: the moon reacts even if the chosen saved week is the same; an attempted disabled action does nothing.
- Real data state: loading, failed, missing and birthday-gated entries must not be misrepresented as delivered messages; successful retries can deliver without a week change.
- Rapid actions, route changes and dialogs: latest cue wins, bounded nodes/timers, no stale focus or delayed character reaction over a modal.
- Small screens, long messages and reduced motion: readable text, unobstructed static controls and the same visual punchlines without animated travel.

### Task 1: One connected postal scene

**Files:** Focused scene component/hook and stylesheet under `src/components/`; adapt `LunarDepartment.tsx`, `GravityTheatre.tsx`, `SurrealistBackground.tsx`, `src/sections/Header.tsx`, `src/sections/QualityTracker.tsx` and `src/app/layout.tsx` only as necessary. Add `tests/e2e/post-office.spec.ts`. Update `tests/e2e/love-laboratory.spec.ts` to replace only superseded standalone-theatre assertions; preserve relevant bounded-state, accessibility and narrow-phone coverage. Original 156 tests remain unchanged unless a real intentional behavior change requires a documented ruling.

**Interfaces:** Read authoritative selected `week`, `year`, `direction`, and resolved message availability from `QualityTracker`; random-memory cue is explicit and independent of whether selection changes. Keep presentation independent of data selection and modal ownership. Prefer direct React props/context to document events or DOM mutation. Scope any page-wide reaction styling to the home scene, not archive.

- [x] Preserve prior source checkpoint and inspect actual previous phone/desktop screenshots.
- [x] Write and run failing tests for fish delivery, previous/next/keyboard reactions, same-week random jealousy, and scene integration replacing the separate theatre.
- [x] Implement the connected scene. Make the letter visibly part of the postal world, with a fish carrying an oversized envelope, supporting teacup, responsive moon and peeking painting. Existing whimsical extras can be repurposed; remove unused experimental code only after checking references and relying on preserved checkpoints.
- [x] Prove normal/reduced motion, repeated actions, loading/error/retry, long text at 320px, current/saved navigation, dialog inertness, unchanged messages and immediate usability.
- [x] Run all browser tests and `pnpm check` (lint, formatting, typecheck, Knip, dependency cruiser, production build); do not weaken checks.
- [x] Capture and inspect phone/desktop day/night and action-state screenshots in `playwright-report/post-office/`; include a short synthetic animation recording if practical.
- [x] Independent source and visual review against the approved concept; fix important findings and reverify.
- [x] Handoff as an uncommitted prototype, with preserved before/after evidence and honest limitations. Do not extend archive, birthday, or gallery aesthetics in this iteration.

## Prototype handoff

Preview: `http://localhost:3021/`. New scene evidence and synthetic action video: `playwright-report/post-office/`. Prior source checkpoint and screenshots remain under `playwright-report/laboratory/pass-2/`.

Fresh controller verification: **182 tests passed**, full `pnpm check` passed including optimized production build. Eight existing lint warnings remain. Independent review and scoped re-review accepted; three small visual/coverage findings resolved. Original 156 tests unchanged. An intermittent new loading-test failure was traced to detached-node style sampling during known synthetic-date hydration replacement and fixed with explicit live-locator assertions, not application/console suppression.

This is an uncommitted homepage prototype, not release approval or a full-site redesign. Physical devices, non-Chromium engines, OS screen readers and live private integrations remain unverified. The existing synthetic-date/server-date development hydration diagnostic and artwork-rights caveats remain disclosed. No commits, pushes, merges or deployments; original PR branch remains untouched.
