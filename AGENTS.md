# Tor Landa Agent Guide

## Project Overview

- Stack: Next.js 16.3 (preview) App Router, React 19, TypeScript 7 (native Go compiler), Tailwind CSS v4, Framer Motion 12.
- Purpose: display weekly quality messages from Notion with a playful surrealist UI.
- Main runtime paths:
- `src/app/page.tsx` renders the home page.
- `src/sections/QualityTracker.tsx` contains the main user flow.
- `src/context/QualityContext.tsx` loads `/api/quality` on the client.
- `src/app/api/quality/route.ts` and `src/services/notionService.ts` handle Notion-backed data.
- `src/app/api/birthday-photos/route.ts` serves birthday gallery photos from Notion.
- `src/app/api/notify/route.ts` validates Notion webhook signatures and sends Telegram notifications.

## First Files To Read

- `AGENTS.md` for repo-specific guardrails.
- `CLAUDE.md` for a compact architecture and workflow summary.
- `src/sections/QualityTracker.tsx` before changing the primary UI flow.
- `src/services/notionService.ts` before changing Notion reads or data mapping.
- `src/app/api/notify/route.ts` and `src/services/telegramService.ts` before changing notification behavior.

## Working Rules

- Prefer small changes that preserve the existing surrealist visual language and Spanish user-facing copy.
- Keep new logic close to current feature code unless it is clearly reusable.
- Do not hardcode secrets. Use `.env.local` and `.env.local.example` only.
- Treat this repo as App Router only. New API endpoints belong under `src/app/api/**/route.ts`.
- Follow the existing alias style: import from `@/` for `src/*` modules.

## Commands

- Install: `pnpm install`
- Dev server: `pnpm dev`
- Lint: `pnpm lint`
- Production build: `pnpm build`
- Telegram smoke test: `pnpm test:telegram`

## Environment

- Required for Notion quality data: `NOTION_API_KEY`, `NOTION_DB_ID`
- Required for birthday gallery: `BIRTHDAY_PHOTOS_DB_ID`
- Required for Telegram notifications: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NOTION_WEBHOOK_VERIFICATION_TOKEN`
- Public app URL used in notifications: `NEXT_PUBLIC_APP_URL`

## Validation

- For UI changes, verify `QualityTracker` on desktop and mobile.
- For data changes, test `/api/quality` and `/api/birthday-photos`.
- For notification changes, test the webhook route and `pnpm test:telegram`.
- Run `pnpm lint` before handing off substantial code changes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
