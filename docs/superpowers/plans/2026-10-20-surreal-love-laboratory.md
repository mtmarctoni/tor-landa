# Surreal Love Laboratory Implementation Plan

> **For agentic workers:** Use subagent-driven-development to implement the two sequential passes, with a visual and code review between them.

**Goal:** Make this girlfriend's weekly love-letter website radically weirder, funnier, and more animated, then push that implementation further in a second pass.

**Architecture:** Preserve the existing Next.js/React/Tailwind/Framer Motion application and its message, archive, birthday, gallery, and surprise flows. Add handcrafted surreal characters and playful opt-in reactions around a protected reading area. No new dependencies or external image services.

**Tech Stack:** Existing Next.js 16.3 preview, React 19, TypeScript, Tailwind 4, Framer Motion 12, Playwright.

**Spec:** The design direction and constraints below capture the user's request and the builder's visual choices. The user previously opted out of further design questions and requested autonomous implementation.

## Design direction

“A love letter escaped from a very silly dream.” Build on the colorful floating paintings, not the rejected formal journal. Picture a handmade romantic Dada playground: eyes in impossible places, a blushing lovesick moon, paintings with limbs, flying fish, a landscape that refuses gravity, wobbly ink, and affectionate Spanish absurdity. Avoid corporate cards, dashboards, formal gallery placards, generic gradients, and cruel or sexual jokes. The girlfriend is cherished, never mocked. Illustrations should feel authored and cohesive, not a pile of stock icons. Existing personal messages remain unchanged.

Pass one establishes the surreal cast and replaces the restrained masthead/composition with something visibly more expressive. Pass two must visibly escalate the first implementation: physical visual gags, scene reactions, strange little discoveries, and more animation, not just more text or a color adjustment. Composition, responsive placement, and the exact jokes are delegated design choices.

## Global constraints

- Base: `4b49ce7fe596f0ca092c0478a17c7e6277f4ff9c`, in a new worktree; original PR stays untouched.
- Spanish user-facing copy; readable weekly messages remain the emotional center.
- Keep all existing API/data, storage, date, password, gallery, modal ownership, export, and keyboard semantics.
- No real personal-service calls, new dependencies, autoplay audio, flashing, cursor hijacking, or controls that run away from touch/focus.
- Reduced-motion users get the same jokes and actions without animated travel, spinning, or scaling. Decorative illustration is hidden from assistive tech; intentional actions use stationary, labelled buttons.
- Mobile-first: message visible near the top, generous touch targets, no horizontal overflow at 320px; desktop must use the surrounding space rather than merely stretch the phone UI.
- Keep existing four paintings recognizable; no new third-party artwork rights assumptions.
- No commits, pushes, PRs, or deployment for this experiment without separate authorization. Checkpoints are local source snapshots and synthetic screenshots.

## Review Focus

- Long messages and narrow phones: decorations never obstruct text or touch controls.
- Reduced-motion and keyboard users: every joke is available without motion or hover.
- Dialogs and input fields: new interactions must not steal focus, react to typing, or stack dialogs.
- Repeated interaction and navigation: bounded effects, cleaned timers/listeners, no leaking particles.
- Existing archive, birthday and gallery states: no regressions, no live private data in evidence.

### Task 1: First implementation — the dream gets silly

**Files:** Existing `src/sections/Header.tsx`, `src/components/SurrealistBackground.tsx`, `src/components/QualityCard.tsx`, `src/app/layout.tsx` as needed; create focused scene/interaction component(s) and stylesheet(s) near them; tests in `tests/e2e/love-laboratory.spec.ts`.

**Interfaces:** Preserve existing component props, semantic labels, fixture selectors, four `data-painting` elements and four original `data-dream-object` identifiers. New motifs use a different attribute. Preserve existing dance-button feedback for compatibility; add jokes alongside it.

- [x] Add a failing synthetic Playwright test for new visible characters and a genuinely funny accessible interaction; demonstrate failure before implementation.
- [x] Build the first complete design. Prefer original CSS/SVG character work, a bold but compact title, expressive visual depth, and a deterministic scene that does not hydrate randomly. Put scene styles in a new focused file rather than adding another large unstructured block to globals.css.
- [x] Verify the new tests plus existing home/surreal/visual-system tests on phone and desktop. Inspect screenshots in both sizes, normal/reduced motion and day/night.
- [x] Save a source checkpoint and synthetic screenshots under ignored `playwright-report/laboratory/pass-1/`; do not commit it.
- [x] Review the first pass for spec, visual quality, accessibility, and regression risks before proceeding.

### Task 2: Second implementation — absolutely no sensible explanation

**Files:** Task 1 components/styles; `tests/e2e/love-laboratory.spec.ts`; documented handoff in this plan.

**Interfaces:** Consume the first pass, preserve its readable layout and public component props; add independent, bounded scene reactions without changing message/data state or dialog ownership.

- [x] Add failing tests for new second-pass interactions and reduced-motion equivalents; run them to confirm the specific missing behavior.
- [x] Escalate the first design with additional original physical surreal gags and richer orchestrated reactions. Make mobile and desktop both visibly stranger. Do not just increase decorative density or repeat the same joke.
- [x] Verify repeated activation, touch/keyboard access, reduced motion, responsive overflow, long messages, and focus while dialogs are open.
- [x] Capture final synthetic phone/desktop screenshots and compare with pass one; inspect the actual images.
- [x] Run the entire Playwright suite and the entire `pnpm check` command set (lint, formatting, typecheck, Knip, dependency cruiser, production build).
- [x] Independent whole-diff review; fix important findings, then report preview instructions, screenshots, check results, and honest limitations. Leave the experiment uncommitted and the original PR untouched.

## Handoff

Both sequential implementations completed on `feat/surreal-love-laboratory`, based on the exact latest PR head. Preview: `http://127.0.0.1:3210/`. Local source checkpoints and synthetic phone/desktop day/night screenshots: `playwright-report/laboratory/pass-1/` and `playwright-report/laboratory/pass-2/`.

Fresh controller verification: 168/168 Playwright tests and full `pnpm check` pass, including production build. Eight baseline lint warnings remain. Independent reviews approved both passes. No existing tests were weakened. Physical devices, non-Chromium browsers, screen readers and live private integrations remain unverified. The known synthetic browser-date/server-date development hydration diagnostic remains disclosed. Work is uncommitted; original PR and its branch remain untouched.
