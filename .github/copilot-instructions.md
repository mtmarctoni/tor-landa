# Tor Landa - Weekly Quality Tracker

Tor Landa is a modern, interactive web application for tracking and sharing weekly quality messages. Built with Next.js 15.4.6, TypeScript, and Notion as a backend, it features a surrealist-inspired UI with smooth animations and keyboard navigation.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Bootstrap and Install Dependencies
- Install pnpm globally: `npm install -g pnpm`
- Install project dependencies: `pnpm install` -- takes ~55 seconds. NEVER CANCEL. Set timeout to 120+ seconds.
- Verify installation: `pnpm --version` (should show 10.14.0+)

### Environment Setup
- Copy environment file: `cp .env.local.example .env.local`
- For development/testing, use mock values:
  ```
  NOTION_API_KEY=mock_api_key_for_build
  NOTION_DB_ID=mock_db_id_for_build
  ```
- For production, you need actual Notion API credentials

### Development Server
- Start development server: `pnpm run dev` -- starts in ~1 second with Turbopack
- Access at: `http://localhost:3000`
- Uses Next.js 15.4.6 with Turbopack for fast hot reloading

### Building and Production
- **CRITICAL NETWORK LIMITATION**: Build fails with Google Fonts due to network restrictions
- **WORKAROUND**: Temporarily modify `src/app/layout.tsx` to use system fonts:
  ```typescript
  // Replace Google Fonts imports with:
  import type { Metadata } from "next";
  import "./globals.css";
  
  // And update the body className to:
  className="antialiased font-sans"
  ```
- Build command: `pnpm run build` -- takes ~20 seconds with font workaround. NEVER CANCEL. Set timeout to 300+ seconds.
- Start production: `pnpm run start` -- starts in ~600ms
- **RESTORE ORIGINAL FONTS** after successful build/test cycle

### Linting and Code Quality  
- Run linter: `pnpm run lint` -- takes ~3 seconds. NEVER CANCEL. Set timeout to 60+ seconds.
- ALWAYS run linting before committing changes
- Uses ESLint with Next.js TypeScript configuration

## Validation Requirements

### Manual Testing Scenarios
- **ALWAYS** test the main application flow after making changes:
  1. Start dev server: `pnpm run dev` 
  2. Navigate to `http://localhost:3000`
  3. Verify the surrealist UI loads with floating animations
  4. Check that the quality tracker shows "Cargando el mensaje..." (loading state)
  5. Test navigation buttons (previous/next week)
  6. Verify footer icons are interactive and hover effects work
  7. Test responsive design on different viewport sizes

### API Testing
- Test quality API: `curl "http://localhost:3000/api/quality?week=1&year=2025"`
- Expected response with mock env: `{"error":"Failed to fetch quality messages: TypeError: fetch failed"}`
- This is normal behavior without real Notion API credentials

### Build Testing Workflow
1. Apply font workaround in `src/app/layout.tsx`
2. Run `pnpm run build` (wait for full completion ~20 seconds)
3. Run `pnpm run start` to test production build
4. Test production server with `curl http://localhost:3000`
5. Verify production HTML includes proper meta tags and structure
6. Stop production server and restore original fonts

## Codebase Structure

### Key Directories
- `/src/app/` - Next.js App Router pages and API routes
- `/src/components/` - Reusable UI components (7 files)
  - `EasterEggModal.tsx`, `FloatingIcons.tsx`, `LoadingQuality.tsx`
  - `NoQualityInPast.tsx`, `QualityCard.tsx`, `SurrealistContainer.tsx`, `WaitingForQuality.tsx`
- `/src/context/` - React Context for state management (`QualityContext.tsx`)
- `/src/types/` - TypeScript definitions (`index.d.ts`, `notion.d.ts`)
- `/src/utils/` - Utility functions (`dateFormatter.ts`, `footerIcons.ts`, `qualityColorCombos.ts`)
- `/src/app/sections/` - Page sections (`Header.tsx`, `Footer.tsx`, `QualityTracker.tsx`)
- `/public/images/` - Static assets (Dalí and surrealist artwork)

### Important Files
- `src/app/layout.tsx` - Root layout with font configuration (Google Fonts issue here)
- `src/app/page.tsx` - Main homepage with surrealist background
- `src/app/api/quality/route.ts` - Notion API integration
- `src/app/globals.css` - Tailwind CSS v4 with custom theme and animations
- `next.config.ts` - Next.js configuration with environment variables
- `eslint.config.mjs` - ESLint configuration
- `tsconfig.json` - TypeScript configuration with path aliases

### Technology Stack
- **Framework**: Next.js 15.4.6 with App Router
- **Runtime**: React 19.1.0  
- **Language**: TypeScript 5.9.2
- **Styling**: Tailwind CSS v4.1.11 with custom theme
- **Animations**: Framer Motion 11.18.2
- **Icons**: Lucide React 0.344.0
- **Backend**: Notion API (@notionhq/client 4.0.1)
- **Package Manager**: pnpm 10.14.0 (preferred) or npm

### Custom Theme and Design
- Surrealist/dream-inspired color palette (dream-50 through dream-900)
- Custom animations: float, drift, morph, blob-morph
- Gradient backgrounds and glass morphism effects
- Responsive design with mobile-first approach

## Known Issues and Workarounds

### Google Fonts Network Issue
- **Problem**: Build fails when fetching Geist fonts from Google Fonts
- **Error**: `getaddrinfo ENOTFOUND fonts.googleapis.com`
- **Workaround**: Temporarily use system fonts during build, restore after
- **Status**: Affects production builds in network-restricted environments

### Environment Variables
- **Required**: `NOTION_API_KEY` and `NOTION_DB_ID` for Notion integration
- **Testing**: Use mock values for build testing
- **Production**: Requires actual Notion workspace setup with database

### No Testing Framework
- **Status**: No automated tests configured
- **Validation**: Relies on manual testing scenarios above
- **Recommendation**: Always follow manual validation steps

## Common Tasks

### Making Changes
1. ALWAYS run `pnpm run dev` to start development server
2. Make your changes to the codebase
3. Verify changes work in browser at `http://localhost:3000`
4. Run `pnpm run lint` to check code quality
5. Test build process with font workaround if needed
6. Follow manual validation scenarios before committing

### Adding New Features
- Components go in `/src/components/`
- Utility functions in `/src/utils/`
- Types in `/src/types/`
- API routes in `/src/app/api/`
- Follow existing patterns and naming conventions

### Styling Guidelines
- Use Tailwind CSS classes with custom theme variables
- Leverage existing animations (animate-float, animate-drift, etc.)
- Follow surrealist design aesthetic with dream color palette
- Test responsive design across viewport sizes

## Package Manager Commands Reference
```bash
# Dependencies
pnpm install          # ~55 seconds
npm install           # Alternative if pnpm unavailable

# Development
pnpm run dev          # Start dev server (~1 second)
pnpm run lint         # Run linter (~3 seconds)

# Production (with font workaround)
pnpm run build        # Build app (~20 seconds)
pnpm run start        # Start production server (~600ms)
```

## Critical Reminders
- **NEVER CANCEL** build or install commands - they may take time but will complete
- **ALWAYS** apply Google Fonts workaround before building in restricted environments
- **MANDATORY** manual validation after any changes
- **ESSENTIAL** to test both development and production modes
- **REQUIRED** to run linting before committing any changes