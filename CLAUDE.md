# Claude Notes

## What This App Does

Tor Landa is a small personal web app that shows weekly Notion-backed quality messages, includes birthday-related UI states, and can notify Telegram when Notion emits a webhook event for a new page.

## Architecture

- `src/app/layout.tsx`: global layout, fonts, shared background, provider wiring.
- `src/app/page.tsx`: homepage shell.
- `src/app/history/page.tsx`: alternate history view.
- `src/sections/QualityTracker.tsx`: main interactive screen and week navigation controls.
- `src/context/QualityContext.tsx`: client fetch state for quality messages.
- `src/hooks/useWeekNavigator.ts`: week-to-week navigation behavior.
- `src/services/notionService.ts`: Notion database queries and mapping into app types.
- `src/app/api/quality/route.ts`: returns mock data when Notion is not configured.
- `src/app/api/birthday-photos/route.ts`: returns configured birthday gallery data.
- `src/app/api/notify/route.ts`: validates Notion webhook signatures and sends Telegram messages.
- `src/services/telegramService.ts`: low-level Telegram Bot API sender.

## Conventions

- User-facing text is primarily Spanish.
- Visual changes should match the existing dreamy, surrealist style rather than introducing a new design language.
- Use TypeScript throughout; keep types explicit at API and service boundaries.
- Reuse existing utilities and context instead of introducing parallel state paths.
- Prefer the existing App Router file layout and `@/` imports.

## Local Workflow

1. `pnpm install`
2. `pnpm dev`
3. Make the smallest correct change.
4. `pnpm lint`
5. If touching notifications, run `pnpm test:telegram` once environment variables are configured.

## Environment Reference

- `NEXT_PUBLIC_APP_URL`
- `NOTION_API_KEY`
- `NOTION_DB_ID`
- `BIRTHDAY_PHOTOS_DB_ID`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `NOTION_WEBHOOK_VERIFICATION_TOKEN`

## Review Baseline

- Review only changed code, but read full files for context.
- Prioritize real behavioral regressions, broken edge cases, security mistakes, and mismatches with existing patterns.
- Do not flag style-only issues unless they conflict with established repo conventions.

## Notes

- `.github/copilot-instructions.md` is partially stale and still references older dependency versions.
- `.agents/instructions/add-telegram-notifier.md` is historical context only; the current notifier implementation uses HMAC signature validation, not a query-param secret.
