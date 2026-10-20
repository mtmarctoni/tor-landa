# Cualidades de Landa: painted dream journal redesign

> **Approved revision and completed implementation, 2026-10-19:** The user approved the exaggerated floating-painting home and authorized completing history, birthday/gallery, surprises and accessibility. The binding direction is “always go with more or extra surrealism”; see `.superpowers/sdd/2026-10-18-painted-dream-journal-redesign/continuation-context.md`. Implementation is complete; current verification and remaining manual/platform limitations are in `docs/superpowers/plans/2026-10-18-redesign-verification.md`. The beige, formal, stationary journal and single doorway were rejected. Historical prescriptions below are not current aesthetic acceptance criteria; behavioral preservation remains required.

## Status and approved brief

- Date: 2026-10-18.
- Status: revised visual direction approved; implementation complete, with final review/verification recorded separately (no merge or deployment authorization).
- Primary audience: Landa, returning to read the weekly message.
- Design direction: a painted dream journal, intimate and deliberately surrealist.
- Scope: full visual redesign of home, history, birthday experiences, galleries, hidden surprises, and UI states.
- First review gate: satisfied by user approval of the exaggerated mobile home; archive and birthday/gallery extension authorized and implemented.

This plan authorizes no deployment, commit, push, or merge. Implementation stays on the feature branch and preserves unrelated work, including the existing change to `pnpm-workspace.yaml`.

## Outcome

Make opening the site feel like discovering a personal note inside an impossible landscape. The message is the protagonist; the artwork establishes the world around it.

The experience must be mobile-first in structure and interaction, not simply a desktop composition squeezed onto a phone. Desktop should expand the same idea with more space and art, without changing the reading order.

## Current problems to address

- `QualityTracker` places a large navigation and utility panel before the message. Controls dominate the mobile reading experience.
- `SurrealistBackground` fades, blurs, and circularly crops the existing artwork, making the paintings less recognizable than the gradients and glass surfaces.
- Repeated panels, pill buttons, glowing borders, morphing shapes, and continuous animation dilute the visual hierarchy.
- Home, history, birthday dialogs, and gallery need one coherent design system.
- Some surprises rely on hover or keyboard interactions. They need deliberate touch and accessible keyboard equivalents.

These observations come from the implementation and bundled artwork. Capture a rendered baseline before implementation to confirm layout behavior and avoid mistaking assumptions for measured issues.

## Design principles

1. **Read before operating.** Put the selected message ahead of tools and metadata.
2. **Surrealism through composition.** Use impossible scale, landscapes, doorways, and shadows rather than adding more effects everywhere.
3. **Quiet interface, expressive world.** Keep text and controls stable while art provides the unusual moments.
4. **Personal, not promotional.** No marketing hero, dashboard statistics, or explanatory onboarding for a wider audience.
5. **Preserve the ritual.** Keep Spanish copy, existing messages, birthday timing, memories, and surprises.
6. **Progressive enhancement.** Content remains usable without animation, hover, or successful decorative-image loading.

## Visual system

### Palette and surfaces

- Warm ivory/paper for the main reading surface.
- Deep ink blue for primary text and navigation.
- Ochre for emphasis and selected details; restrained terracotta for warmth and celebration.
- Treat these as roles, not final color values. Select exact tokens after checking contrast in all four time-of-day themes.
- Use subtle paper grain, fine rules, and restrained shadows. Avoid large blurred glass panels and excessive gradients.
- Retain the dawn/day/dusk/night concept, adapting the surrounding scene and reading surfaces so every combination stays legible.

### Typography and spacing

- Choose a distinctive, Spanish-capable display serif and a readable companion for body text and controls.
- Use the existing Next.js font infrastructure; keep font families and weights minimal.
- Body text starts at a comfortable 16-18px on mobile, with generous line height and a bounded reading width on larger screens.
- Use fluid type and spacing, not oversized fixed desktop headings.
- Preserve message paragraphs and explicit line breaks. Long messages grow naturally; never clamp or force them into decorative shapes.

### Artwork

- Recurring motif: a doorway into an impossible landscape.
- Recompose the existing Dalí images as recognizable scenes, with crops chosen separately for narrow and wide screens.
- Inventory `public/images/dali1.webp`, `public/images/dali2.webp`, and `public/images/thekiss.jpg`, including actual dimensions, quality, provenance, and usage rights. Do not assume existing files are cleared for reuse.
- Add a small family of original lightweight SVG illustrations where useful: floating stones, distant moons, impossible shadows, and the doorway. Use authored SVG/CSS rather than depending on unavailable image-generation tools.
- Add external artwork only after verifying its source and reuse terms; record attribution and licenses alongside new assets.
- Do not make a larger image library or an artwork carousel a prerequisite for the redesign.
- Keep art outside the text's contrast zone. Decorative images use empty alternative text; meaningful artwork receives an appropriate description and attribution.

### Motion

- One gentle entrance sequence and short, directional week transitions.
- At most a few slow atmospheric movements; no continuous morphing of the reading container.
- Keep week changes free of horizontal page overflow and disruptive height jumps.
- Implement reduced-motion handling for both CSS and Framer Motion; a CSS media query alone does not cover JavaScript-driven animation.
- Do not make reading, discovering controls, or opening a surprise depend on catching a moving target.

## Information architecture and interaction

### Home: mobile reading order

1. Compact site identity: “Cualidades de Landa”.
2. Selected week and year; an unobtrusive birthday notice when applicable.
3. Weekly message, or the appropriate loading/waiting/error state.
4. Previous and next week controls immediately after the message.
5. Secondary actions: copy message, random saved week, and archive.
6. A secondary details area for recent saved-week shortcuts, refresh, and synchronization time.
7. Quiet footer with an intentional, stationary surprise trigger.

On a fresh visit, show the current week. Preserve the existing last-viewed-week restoration behavior for returning sessions; clearly label the selected week and expose “Volver al presente” when it is not current. Do not silently remove persistence as part of a visual redesign.

- Keep the start of a typical message visible in the initial 390x844 viewport; do not require the whole message or every action to fit above the fold.
- Keep previous/next labels understandable and touch targets comfortably sized. Buttons remain the primary interaction; swipe is not required.
- Keep “Volver al presente” near the week context when browsing other weeks.
- Copy exposes success and failure feedback without replacing the message or shifting the layout unnecessarily.
- Random selection still chooses an existing saved entry. Recent saved-week shortcuts remain available but no longer dominate the screen.
- Refresh remains available, especially for errors, without being a primary reading action.
- Replace the prominent annual progress bar with quiet year-position metadata in the secondary details area. Preserve context without inventing a completion goal.
- Rework the floating quote as an intentional, activatable memory detail; preserve rediscovery and its surprise, without drifting text across the main reading area.

### History

- Keep the `/history` route and an obvious route back home.
- Present entries as journal pages or dated notes rather than repetitive dashboard cards.
- Keep full messages readable, with clear week/year context and restrained separators.
- Preserve search, year filtering, newest/oldest ordering, result counts, clear-filters actions, and JSON/TXT export of the filtered results.
- Keep search prominent. Group filters, sorting, and exports compactly; controls must wrap or stack on phones.
- Distinguish an empty archive, no search results, loading, and fetch failure.
- Do not change week numbering or date semantics during this redesign. If displaying new date ranges, align them with existing data conventions first; do not introduce an implicit ISO-week migration.

### Birthday and hidden experiences

- Make the birthday view a special edition of the journal, not a separate visual theme.
- Preserve the countdown visibility window, before-birthday waiting state, birthday message timing, secret hints, password flow, and gallery access.
- Render clickable message hints as semantic buttons that work with touch and keyboard while retaining their inline appearance.
- Keep the gallery focused on photos and captions. On phones, use a full-height dialog with safe-area-aware controls and no clipped caption or close action.
- Preserve previous/next photo navigation, loading feedback, and existing data/preloading behavior unless a separately justified fix is needed.
- Give gallery empty/error conditions a coherent visual treatment and safe navigation.
- Preserve the footer surprise and the AMOR keyboard sequence; provide an equivalent subtle touch trigger for keyboard-only content.
- All dialogs need an accessible name, initial focus, focus containment, Escape dismissal, focus restoration, and background scroll management. Global week shortcuts must not operate behind an open dialog.

## Technical boundaries

- Keep Next.js App Router, React, TypeScript, Tailwind v4, and the existing Framer Motion dependency.
- Reuse `QualityContext`, `TimeShiftContext`, `useWeekNavigator`, and the existing birthday/photo hooks. No parallel data-fetching or navigation state system.
- Keep shared design tokens in `src/app/globals.css`; extract small presentation components only where they simplify the existing feature code.
- Preserve `/api/quality`, `/api/birthday-photos`, `/api/notify`, Notion mappings, Telegram behavior, environment variables, and secret handling.
- Do not rewrite calendar logic, add authentication, introduce a CMS, change deployment configuration, or upgrade dependencies for this task.
- If existing behavior blocks the redesign, document it and keep any required fix narrow and verified rather than folding unrelated refactors into the work.
- No new analytics or transmission of personal messages/photos to third-party services.

## Implementation phases

### Phase 0: baseline and assets

- [ ] Run the existing app and capture home/history at phone and desktop sizes.
- [ ] Record baseline lint, typecheck, and build results so pre-existing failures are distinguishable.
- [ ] Inventory UI states and existing surprises, including the two Easter egg dialogs and birthday secret/gallery flow.
- [ ] Inventory image dimensions, file sizes, provenance, and license constraints; choose reuse or original replacements.
- [ ] Select fonts and preliminary design tokens with contrast checks.

**Exit:** baseline evidence, feature-preservation checklist, and a concrete asset/typography direction. No secret values or private photos in public documentation.

### Phase 1: mobile home and visual foundation

Primary files:

- `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`
- `src/sections/Header.tsx`, `src/sections/Footer.tsx`, `src/sections/QualityTracker.tsx`
- `src/components/QualityCard.tsx`, `src/components/SurrealistBackground.tsx`
- `src/components/HistoryButton.tsx`, `src/components/FloatingQuote.tsx`, `src/components/FloatingIcons.tsx`
- `src/utils/qualityColorCombos.ts` if its existing role needs to be adapted to the new tokens
- `public/images/` for approved or original artwork

Tasks:

- [ ] Implement palette, type, spacing, focus states, and time-of-day variants.
- [ ] Build the compact identity, message-first composition, and recognizable landscape/doorway artwork.
- [ ] Remove the morphing reading shape and simplify the navigation hierarchy.
- [ ] Keep all week actions, copy feedback, saved shortcuts, and refresh available at the appropriate priority.
- [ ] Use valid link/button semantics; do not nest a button inside the archive link.
- [ ] Restyle home loading, waiting, and error states enough to validate the whole home experience.
- [ ] Confirm desktop expansion and smoke-test other screens affected by shared styles.

**Review gate:** present the home at 390x844 and a desktop width, including a long-message state. Pause for visual approval before extending the design to history and birthday/gallery screens.

### Phase 2: journal archive

Primary files: `src/app/history/page.tsx` and `src/components/MessageHistory.tsx`.

- [ ] Implement the journal entry layout, compact filter tools, and matching navigation.
- [ ] Preserve filtering, sorting, exports, and result counts.
- [ ] Add explicit input/select labels and clear no-results recovery.
- [ ] Avoid per-entry animation delays that make a long archive take progressively longer to appear.

**Exit:** home and archive look related; all existing archive operations work at phone and desktop widths.

### Phase 3: birthday, gallery, and surprises

Primary files:

- `src/components/BirthdayCountdown.tsx`, `src/components/BirthdayConfetti.tsx`
- `src/components/BirthdaySecretModal.tsx`, `src/components/BirthdayGalleryModal.tsx`
- `src/components/PhotoViewer.tsx`, `src/components/PhotoCaption.tsx`, `src/components/GalleryLoading.tsx`
- `src/components/EasterEggModal.tsx`, `src/components/AmorEasterEggModal.tsx`, `src/components/EasterEggKeyboardListener.tsx`
- Inline birthday hints in `src/components/QualityCard.tsx` and the footer trigger in `src/sections/Footer.tsx`
- `src/hooks/useWeekNavigator.ts` only as needed to prevent shortcut conflicts with dialogs

- [ ] Carry the journal language through celebration, unlock flow, photos, and hidden content.
- [ ] Add touch equivalents for keyboard-only surprises and accessible inline hints.
- [ ] Verify modal focus, Escape, focus return, scroll behavior, and close controls.
- [ ] Keep birthday timing and unlock semantics unchanged.
- [ ] Verify photo navigation, captions, loading, and empty/error handling.

**Exit:** all personal moments remain reachable and usable on phones, with keyboard accessibility on desktop.

### Phase 4: state consistency, motion, and performance

Primary files: `src/components/StatusState.tsx`, `src/components/LoadingQuality.tsx`, `src/components/WaitingForQuality.tsx`, `src/components/NoQualityInPast.tsx`, `src/components/WaitingForBirthday.tsx`, plus the redesigned screens.

- [ ] Unify loading, waiting, empty, error, and retry treatments with Spanish copy.
- [ ] Check contrast and component colors in dawn, day, dusk, and night; remove hardcoded legacy colors that break them.
- [ ] Apply reduced-motion behavior to all CSS and Framer Motion sequences, including confetti and dialogs.
- [ ] Optimize image formats, responsive sizing, and loading priority. Reserve image space to prevent layout shifts.
- [ ] Keep decorative layers non-interactive and out of the accessibility tree.
- [ ] Remove obsolete styling/assets only after verifying that no preserved feature uses them.

**Exit:** coherent UI states, stable reading layout, and no dependency on expensive effects for the intended appearance.

### Phase 5: verification and handoff

- [ ] Complete the matrix below and record actual results, not just intended checks.
- [ ] Run `pnpm lint`, `pnpm typecheck`, and `pnpm build`; explain any baseline failures separately.
- [ ] Review the diff for accidental data/API changes and unrelated file edits.
- [ ] Provide final mobile/desktop screenshots and a brief change summary with any remaining limitations.
- [ ] Leave commit, PR, and deployment actions for a separate explicit request.

## Verification matrix

| Area | Cases | Pass condition |
| --- | --- | --- |
| Responsive layout | 320px, 390px, 430px, 768px, and 1440px widths; phone landscape | No page-level horizontal overflow, clipped controls, or art covering text. Desktop preserves the mobile reading order. |
| First view | 390x844, ordinary current-week message | Identity, selected week, and start of the message appear without scrolling through tools. |
| Text resilience | Short, multiline, very long, accented Spanish, long unbroken text, and 200% zoom | Natural layout growth, readable text, reachable actions, no truncation. |
| Week navigation | Previous, next, current, random, recent shortcut, reload with saved selection, year boundary | Existing selection behavior preserved; current/selected context is clear. Record pre-existing calendar issues rather than silently changing conventions. |
| Copy and refresh | Clipboard success/failure; refresh success/failure | Clear non-disruptive feedback and a reachable retry action. |
| Data states | Loading, empty dataset, missing past week, missing current/future week, API error | Correct distinct state; no stale message masquerading as the selected week. |
| Archive | Search, year filter, combined filters, sort, clear, no results, JSON/TXT export | Correct results/counts and exported filtered content; all controls usable on mobile. |
| Birthday | Outside countdown window, countdown active, birthday week before Oct 23, birthday day, unlocked historical birthday entry | Existing visibility rules preserved; message/secret/gallery flow works. |
| Gallery | Open, close, next/previous, captions, slow images, zero photos, fetch failure | No broken navigation, trapped scrolling, or unreachable close button. |
| Surprises | Floating-memory replacement, footer surprise, AMOR keyboard sequence, equivalent touch trigger | Existing content remains reachable without hover or a physical keyboard. |
| Time of day | `/?time=dawn`, `/?time=day`, `/?time=dusk`, `/?time=night`, and corresponding `/history?time=...` URLs | Art, text, surfaces, controls, and dialogs remain coherent and readable. |
| Accessibility | Keyboard-only navigation, screen-reader smoke test, visible focus, dialog focus lifecycle | Semantic controls, named inputs, status feedback, 44x44px target design goal, 4.5:1 normal-text contrast, and no background shortcuts firing behind dialogs. |
| Reduced motion | OS/browser reduced-motion preference | No continuous atmospheric motion, morphing, confetti motion, or sliding transitions; content remains visible. |
| Performance | Mobile page-load comparison against baseline | Responsive art/fonts, no avoidable layout shift, and no new heavy UI or animation dependency. Investigate regressions before handoff. |
| Integration | `/api/quality` and `/api/birthday-photos` in the existing environment | Response contracts unchanged. Do not expose private API responses or trigger Telegram notifications during UI verification. |

There is currently no general automated test runner or browser-test script in `package.json`. Use the existing lint/typecheck/build commands plus explicit browser verification. Use local, non-committed fixtures or a browser clock override for otherwise hard-to-reach date/data states; never alter production dates or personal data to make a test pass. If browser tooling is unavailable, report the unverified checks instead of claiming completion.

## Definition of done

- Landa can open the site and begin reading before interacting with navigation tools.
- The painted dream journal identity is recognizable on every screen, with surrealism expressed through curated art and composition.
- Home, history, birthday, galleries, surprises, and all state variants are visually consistent and usable on phones.
- Existing features and backend behavior remain intact; no removal is hidden inside a visual simplification.
- Accessibility, reduced motion, time-of-day themes, long content, and small screens are explicitly verified.
- The approved home review gate and final verification results are recorded before handoff.
