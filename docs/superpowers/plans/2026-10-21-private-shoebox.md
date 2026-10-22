# Private Shoebox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execution method has not been chosen; do not dispatch implementation agents now.

**Goal:** Build a private, phone-friendly, gloriously absurd shared archive of photos, audio and tiny written memories for two people.

**Architecture:** Server-guard `/shoebox` and independently authenticate every API/media request using a shared-password session. Store records and one file per media memory in a separate private Notion database; keep media behind bounded same-origin authenticated endpoints with range support. Use semantic, paginated document flow dressed as crooked scraps and voice jars, not an unbounded canvas.

**Tech Stack:** Existing Next.js 16.3.0-preview.6 App Router, React 19, TypeScript 7, Tailwind v4, Framer Motion, Notion SDK and Playwright. Proposed additions, only after implementation approval: `jose` for signed sessions; direct `sharp` for server JPEG normalization; `mediabunny` for bounded container/track/packet inspection; `server-only` for import boundaries; dev-only `vitest` for server/unit tests. No new hosted service, database, ffmpeg, transcoder, accounts or auth platform.

**Spec:** `docs/superpowers/specs/2026-10-21-private-shoebox-design.md`, approved 2026-10-21. Read it with this plan. Plan status: **FOR REVIEW; implementation NOT approved**.

## Global Constraints

- Use only `/Users/mtm/.local/share/opencode/worktree/bc1d6b/private-shoebox`, branch `feat/private-shoebox`; preserve all existing work; no new worktree.
- No countdown changes, main-branch edits, commits, pushes, PRs, merge, deployment, live Notion changes, credential inspection or live personal-data tests without separate explicit approval. Omit the skill's usual commit steps under this user instruction.
- Until implementation approval: planning documents only; no dependency installation/scaffolding/product code/service resources. Commands below are future instructions, not commands run during planning.
- NO VIDEO. One attachment; actual file bytes `<= 4,000,000`; multipart total `<= 4,200,000`; login JSON `<= 4,096`; other mutation JSON `<= 16,384` bytes.
- Recording and uploaded audio: `0 < duration <= 60` seconds; no autoplay or microphone access before a tap; no background recording/automatic upload.
- Saved JPEG: longest edge `<= 2,048`; browser source `<= 20,000,000` bytes and `<= 40,000,000` pixels where detectable; server JPEG decoder max `4,194,304` pixels (2,048²), strip metadata; originals not stored.
- Text `1–2,000` characters; caption `0–500`; date-only `YYYY-MM-DD`, defaults to local today; one batch `<= 12`, sorted by memory date then creation time descending.
- Seven-day absolute sessions (`604,800` seconds), Secure/HttpOnly/SameSite=Strict `__Host-shoebox`, Path=/, no Domain. Separate local-only development cookie; never silently use it on a deployment.
- Every private page/RSC/API/media/error response private/no-store; no raw Notion bearer URLs in browser responses, no private image optimizer, no analytics or persisted drafts.
- Either person may correct text/caption/date or confirm trash removal; no media replacement API, author attribution, version history, social mechanics or permanent-erasure promise.
- Stationary 44px essential targets; semantic chronological order; readable Spanish; bounded decorative mischief `< 3s`; reduced motion overrides animation; ambient pause includes inherited scenery.
- Single-member private Notion Free workspace; dedicated Memories database, existing integration reused only server-side. Free file cap 5 MiB; Vercel payload cap 4.5 MB. Never use streaming/public links to evade privacy/limits.
- Strong shared password is access control, not E2EE; copied sessions, distributed guessing, ambiguous creates, browser suspension and Notion retention have documented limits.

## Review Focus

1. Late success after cancellation/expiry must not resurrect private content, microphone streams, or an obsolete request; Task 8 and Task 9 pin generation guards and late-permission cleanup.
2. Metadata-less WebM and fragmented MP4 from real recorders must validate duration without trusting declared headers or accepting hidden video; Task 4 pins packet-derived duration/track inspection fixtures.
3. Back/forward restoration, RSC prefetch, optimizer requests, HEAD/ranges and error paths must never become a cache/auth bypass; Tasks 2, 6 and 10 exercise each surface.
4. A save may have succeeded when the connection died; Task 5 and Task 8 reconcile the same Request ID and represent unknown outcomes instead of automatically duplicating a memory.
5. Corrections/removals and cursor shifts by the other person must not strand focus or remove the wrong memory; Task 7 and Task 9 pin missing records, last-write-wins, batch boundaries and focus fallback.

## Execution and test conventions

Each task is a reviewable RED -> implementation -> GREEN unit; finish and inspect its diff before starting the next dependent task. Do not check off steps without evidence. Record actual failing assertions, commands, outcomes and limitations in `docs/superpowers/plans/2026-10-21-private-shoebox-verification.md` (create during approved implementation). Dependency/import errors are acceptable only for the very first missing-module RED; thereafter prove behavioral failures, not harness failures.

Use `pnpm test:unit tests/unit/shoebox/<name>.test.ts` for node tests, and `pnpm test:e2e tests/e2e/shoebox-<name>.spec.ts` for browser tests. Add a **separate** `playwright.shoebox.config.ts` for WebKit/Firefox coverage so the original Chromium phone/desktop baseline is unchanged. All tests use synthetic data. Browser mocking alone is insufficient for handler authentication; unit/integration tests call actual handler factories and a real local Next server.

No runtime baseline was run during planning: this worktree has no `node_modules`. Historical redesign evidence reports 216 tests/full check, eight warnings and a synthetic-date hydration diagnostic; remeasure rather than assuming those results still apply.

## File responsibility map

Exact feature files (create only when their owning task begins):

| Files | Responsibility / owner task |
| --- | --- |
| `src/types/shoebox.ts` | Browser-safe domain/API discriminated unions and error codes (1) |
| `src/features/shoebox/limits.ts`, `validation.ts` | Shared constants and pure strict metadata validation (1) |
| `src/features/shoebox/server/config.ts`, `errors.ts`, `http.ts`, `body.ts` | Server config, sanitized errors/private responses, origin checks, bounded request reads (1–2) |
| `src/features/shoebox/server/password.ts`, `session.ts`, `auth-handlers.ts` | Scrypt verification, JOSE sessions, injectable real login/logout/session handlers (2) |
| `src/features/shoebox/server/notion-gateway.ts`, `memory-service.ts` | SDK adapter/retries/schema resolution; mapping, membership, queries and mutations (3,5,7) |
| `src/features/shoebox/server/media-validation.ts`, `media-worker.mjs` | Bounded worker-based Sharp/Mediabunny validation; no network in worker (4) |
| `src/features/shoebox/server/memory-handlers.ts` | Injectable list/detail/create/status/correct/delete HTTP handlers (3,5,7) |
| `src/features/shoebox/server/media-source.ts`, `byte-range.ts`, `media-handler.ts` | Trusted Notion URL policy, bounded fetch, byte range grammar and authenticated response (6) |
| `src/features/shoebox/client/api.ts`, `photo-processing.ts`, `audio-preview.ts`, `recorder.ts` | Fetch/error normalization, local image/audio processing, recorder controller (4,8) |
| `src/features/shoebox/client/useShoeboxSession.ts`, `useMemoryArchive.ts`, `useVoiceRecorder.ts` | Client session gate, single-batch/request/draft lifecycle, React recording adapter (8–9) |
| `src/components/shoebox/{ShoeboxLogin,ShoeboxArchive,ShoeboxScene,MemoryScrap,MemoryComposer,MemoryDialog,VoiceRecorder,MemoryCorrection,RemovalConfirmation}.tsx` | Small focused visual/form components (2,8–9); minimal composer host in8, complete archive in9; one native dialog at a time |
| `src/components/shoebox/shoebox.css`, `useShoeboxMotion.ts` | Route-local surreal scene, stable layout, full ambient pause and bounded reaction (9) |
| `src/app/shoebox/page.tsx`, `login/page.tsx` | Server auth guard and generic login shell; static generic metadata/noindex, no private metadata (2) |
| `src/app/api/shoebox/session/route.ts`, `logout/route.ts` | GET/POST session and POST logout entry points (2) |
| `src/app/api/shoebox/memories/route.ts` | GET list, POST multipart create (3,5) |
| `src/app/api/shoebox/memories/[id]/route.ts` | GET single (for saved/backdated memory), PATCH correction, DELETE trash (3,7) |
| `src/app/api/shoebox/requests/[requestId]/route.ts` | GET reconciliation state (5) |
| `src/app/api/shoebox/memories/[id]/media/route.ts` | GET/HEAD media only (6) |
| `tests/unit/shoebox/*.test.ts`, `tests/helpers/{shoebox-fixtures,mock-notion,mock-media,safe-env}.ts` | Server/pure/controller tests; synthetic fixtures and offline transports |
| `tests/e2e/shoebox-*.spec.ts`, `tests/e2e/shoebox.fixture.ts`, `tests/fixtures/shoebox/*` | UI/auth/server smoke tests, generated non-personal media, fixture provenance |
| `scripts/{run-shoebox-checks,check-shoebox-bundle}.mjs`, `vitest.config.ts`, `playwright.shoebox.config.ts` | Isolated synthetic execution, client canary inspection, unit/multi-engine configuration |
| `docs/shoebox-setup.md` | Owner-only manual Notion/WAF/secret rotation/deployment/device runbook (10) |

Existing modifications are deliberately narrow: `package.json`/`pnpm-lock.yaml` for those additions/scripts; `next.config.ts` for removing `env`, headers, public local-image allowlist and worker tracing; `knip.json` for explicit worker/script test entry points if required; `.env.local.example` for names/placeholders only; `src/sections/Footer.tsx` for stable `prefetch={false}` entry link. Do not alter `JournalDialog.tsx` unless a concrete new regression proves necessary; its onClose callback can implement inline discard confirmation without changing the shared dialog. Do not modify `notionService.ts`, birthday handlers/gallery, countdown, global providers or existing artwork.

## Fixed contracts

In `src/types/shoebox.ts`:

```ts
type MemoryKind = "photo" | "audio" | "text";
type MemoryBase = { id: string; caption: string; memoryDate: string; createdAt: string };
type MemorySummary = MemoryBase & (
  | { kind: "text"; text: string }
  | { kind: "photo"; mediaPath: string; width: number; height: number }
  | { kind: "audio"; mediaPath: string; durationSeconds: number; mimeType: string }
);
type MemoryPage = { items: MemorySummary[]; nextCursor: string | null };
type MemoryFields = { kind: MemoryKind; text?: string; caption: string; memoryDate: string };
type MemoryCorrection = { text?: string; caption: string; memoryDate: string };
type ApiErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "INVALID_INPUT" | "TOO_LARGE"
  | "UNSUPPORTED_MEDIA" | "NOT_FOUND" | "REQUEST_CONFLICT" | "OUTCOME_UNKNOWN"
  | "RATE_LIMITED" | "UNAVAILABLE" | "SETUP_REQUIRED";
type ApiError = { error: { code: ApiErrorCode; message: string; diagnosticId: string; retryAfterSeconds?: number } };
type RequestStatus = { state: "found"; memory: MemorySummary }
  | { state: "not_found" } | { state: "ambiguous" };
```

Server-only types in their owning module: `Session = { id: string; issuedAt: number; expiresAt: number }` (epoch seconds); `ValidatedMedia = { bytes: Uint8Array; mimeType: string; filename: string; width?: number; height?: number; durationSeconds?: number }`; `CreateInput = MemoryFields & { requestId: string; media?: ValidatedMedia }`; `TrustedMedia = { kind: "photo"|"audio"; url: URL; expectedMimeType: string }`. `MemorySummary` cannot contain `url`, external IDs or upstream raw data. No type imports from server files in client components.

HTTP contract (all success/error responses no-store):

| Endpoint | Input -> success | Failure behavior |
| --- | --- | --- |
| GET `/api/shoebox/session` | cookie -> `{expiresAt:number}` | 401 no valid session; no refresh/rotation |
| POST `/api/shoebox/session` | JSON `{password:string}` -> `{expiresAt:number}` and cookie | 401 generic wrong password; 403 origin; 413 body; 503 config/busy |
| POST `/api/shoebox/logout` | empty same-origin -> 204, clear cookie | origin guard even if already logged out; idempotent |
| GET `/api/shoebox/memories?cursor=...` | session + optional opaque cursor <=1,024 bytes -> `MemoryPage` | 400 bad query; 503/429 safe error; no cross-site reads |
| POST `/api/shoebox/memories` | multipart `metadata` JSON `{requestId,...MemoryFields}` plus exactly one `file` for media, none for text -> 201 `{memory:MemorySummary,replayed:false}` | 200 `{memory,replayed:true}` after reconciliation; 202 `ApiError` OUTCOME_UNKNOWN; 409 incompatible reused ID; 413/415/422 validation |
| GET `/api/shoebox/requests/:requestId` | UUID -> `RequestStatus` | never creates/retries writes; multiple results -> ambiguous; no claimed “still pending” durable state |
| GET `/api/shoebox/memories/:id` | UUID -> `{memory:MemorySummary}` | 404 wrong source/trashed/missing/invalid; used by backdated-save link |
| PATCH `/api/shoebox/memories/:id` | strict JSON `MemoryCorrection` -> `{memory:MemorySummary}` | cannot set kind/Media/Request ID; fields required where relevant; 404 gone |
| DELETE `/api/shoebox/memories/:id` | empty body -> 204 | membership first; already trashed member -> 204; wrong source -> 404 |
| GET/HEAD `/api/shoebox/memories/:id/media` | session, optional one byte Range -> 200/206 | no URL/query input; invalid/multiple/unsatisfiable range ->416 `Content-Range: bytes */N`; 404 missing/invalid; bounded upstream failure ->503 |

Invalid JSON/boundaries/unknown fields ->400; semantic invalid date/text ->422 `INVALID_INPUT`; bad file kind/container ->415 `UNSUPPORTED_MEDIA`. Unauthorized API requests return 401 JSON, never redirect to login HTML. Unauthorized page requests redirect only to the fixed `/shoebox/login` path. Do not accept an arbitrary `next` redirect. Unexpected methods return 405 with Allow/private headers; OPTIONS exposes no CORS permissions. HEAD to JSON APIs returns no sensitive body and follows the GET auth path; do not allow framework-generated behavior to skip auth.

## Task 1: Offline baseline, strict inputs and private HTTP primitives

**Files:** Create `limits.ts`, `validation.ts`, server `config.ts`, `errors.ts`, `http.ts`, `body.ts`, `src/types/shoebox.ts`, `vitest.config.ts`, `tests/helpers/{safe-env,shoebox-fixtures}.ts`, `tests/unit/shoebox/{validation,http,body}.test.ts`, `scripts/run-shoebox-checks.mjs`; modify `package.json`, lockfile only when approved.

**Interfaces:** `validateFields(value: unknown): MemoryFields`; `validateCorrection(value: unknown, kind: MemoryKind): MemoryCorrection`; `readBodyLimited(request: Request, limit: number): Promise<Uint8Array>`; `readMultipart(request: Request): Promise<{fields: MemoryFields; requestId: string; file?: File}>`; `assertMutationOrigin(headers: Headers, origin: string): void`; `assertSameOriginRead(headers: Headers): void`; `privateJson(value: unknown, status?: number): Response`; `toErrorResponse(error: unknown): Response`. `getConfig()` reads only the five named server vars lazily; no module-load personal values.

Core RED assertions (tests supply valid baseline fields):
```ts
expect(() => validateFields({kind:"text",text:"x",caption:"",memoryDate:"2026-02-30"})).toThrow();
expect(() => validateFields({kind:"text",text:"x".repeat(2001),caption:"",memoryDate:"2026-10-21"})).toThrow();
expect(privateJson({}).headers.get("Cache-Control")).toContain("no-store");
```

- [ ] **1.1 Establish safe baseline before product edits.** Reverify path/branch/status; record pre-existing document changes, dependency absence, package manager/Node versions without dumping environment. After approval run `pnpm install --frozen-lockfile`; do not upgrade existing packages. Set all known Notion/Telegram/webhook/app env vars to explicit synthetic or empty values for checks (never inherit their personal values), then run `pnpm lint`, `pnpm typecheck`, `pnpm test:e2e`, `pnpm check`; record existing failures. Use no live smoke-test command. If the server runner could reach configured personal data, stop and fix the offline boundary first. Install browser engines only in approved implementation.
- [ ] **1.2 Add Vitest as the smallest server runner and write RED tests** in the listed paths: calendar validation rejects `2026-02-30`; date remains date-only across timezones; notes 2,000 pass/2,001 fail; caption 500/501; strict extra keys; zero/extra files; byte boundaries 4,000,000/4,000,001 and total 4,200,000/4,200,001; unknown Content-Length still enforced; false small length cannot bypass actual stream count; empty/null/foreign Origin fails, legitimate mutation origin passes; ordinary same-origin media GET without Origin passes; `cross-site` is denied. Test safe errors contain no synthetic URL/token/note canary.
- [ ] **1.3 Run RED:** `pnpm test:unit tests/unit/shoebox/validation.test.ts tests/unit/shoebox/http.test.ts tests/unit/shoebox/body.test.ts`; assert relevant boundary failures, not a network error.
- [ ] **1.4 Implement the interfaces.** Use date round-trip validation, Unicode code-point counts (not code units), strict JSON schemas via small explicit guards, no extra schema dependency. Count request stream bytes before parsing a bounded reconstructed multipart Request, cancel on overflow/abort, enforce metadata field <=16,384 bytes plus exact allowed fields. Check declared length early but never trust it. Add `server-only` boundary; in Vitest alias it to a test stub, not in product builds. Error messages are fixed Spanish strings; diagnostics use random UUIDs; never serialize raw SDK/errors. Headers: `Cache-Control: private, no-store, max-age=0`, `CDN-Cache-Control: no-store`, `Vercel-CDN-Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Resource-Policy: same-origin`. Origin match uses configured parsed origin, no Host trust.
- [ ] **1.5 Run GREEN** with the same test command and `pnpm lint && pnpm typecheck`. The safe runner whitelists non-sensitive process settings, supplies explicit fake app credentials, blocks non-loopback outbound transport in tests, starts only its own local server and cleans up only that child. No test-only bypass route or runtime `MOCK_NOTION` switch in production source.

## Task 2: Server password/session boundary and guarded page shell

**Files:** Server `password.ts`, `session.ts`, `auth-handlers.ts`; app shoebox/login pages and session/logout routes; `ShoeboxLogin.tsx`; `tests/unit/shoebox/{password,session,auth-handlers}.test.ts`; `tests/e2e/shoebox-auth.spec.ts`, `shoebox.fixture.ts`; modify `next.config.ts`, example env file and dependency files.

**Interfaces:** `verifyPassword(password: string, verifier: string): Promise<boolean>`; `issueSession(nowSeconds?: number): Promise<{token:string; session:Session}>`; `verifySession(token: string|undefined, nowSeconds?: number): Promise<Session|null>`; `requireRequestSession(request: Request): Promise<Session>`; `requireShoeboxSession(): Promise<Session>` using `await cookies()`; `createAuthHandlers(deps): {getSession; login; logout}` with `(request: Request) => Promise<Response>`. Tests inject config/clock/verifier, not an auth bypass.

Core RED assertions with synthetic config injected by the test:
```ts
const {token, session} = await issueSession(1_800_000_000);
expect(session.expiresAt - session.issuedAt).toBe(604_800);
expect(await verifySession(token, session.expiresAt)).toBeNull();
expect(await verifySession(`${token}x`, session.issuedAt)).toBeNull();
```

- [ ] **2.1 Write RED tests:** a valid session expires precisely at issuedAt+604,800; reject absent/forged/oversized token (>2,048 bytes), changed secret, wrong alg/audience/issuer, future iat, excessive lifetime and malformed version/id. Login only succeeds through real password verification; max 1,024 UTF-8 password bytes, no normalization/trimming; body <=4,096; same-origin/logout controls; cookies have the exact production flags and matched max-age; prod config cannot issue local cookie. No Notion call on unauthenticated page/API. Test page body/redirect and RSC request never contains synthetic private memory text. A wrong password gives the same status/body shape regardless of verifier details. No raw password/hash in error/logs.
- [ ] **2.2 Run RED:** `pnpm test:unit tests/unit/shoebox/password.test.ts tests/unit/shoebox/session.test.ts tests/unit/shoebox/auth-handlers.test.ts`; after shell exists, `pnpm test:e2e tests/e2e/shoebox-auth.spec.ts`.
- [ ] **2.3 Implement cryptography/config:** `jose` HS256 only, issuer `tor-landa:shoebox`, audience `shoebox`, payload version `1`, UUID jti, numeric iat/exp; decode a base64url secret of >=32 random bytes, do not derive it from password. Password verifier format `scrypt-v1$<base64url salt>$<base64url 64-byte key>`, fixed N=32,768/r=8/p=1/maxmem=64 MiB, >=16-byte salt, `crypto.scrypt` async and `timingSafeEqual`. Reject config that requests arbitrary cost parameters. Add a small per-instance maximum two concurrent scrypt jobs (503 when busy) as a resource guard, explicitly not durable rate limiting. Unknown/broken config fails closed with 503 SETUP_REQUIRED.
- [ ] **2.4 Implement page/HTTP guard:** Next Node runtime, `await cookies()`, dynamic page execution, no private SSR list in the shell; after server verification pass only `expiresAt` to the archive client. This makes UI mocking possible without a server Notion fixture switch. Generic noindex/nofollow/noarchive metadata; public entry does not prefetch. Login UI uses POST JSON and full navigation to fixed shoebox route. Logout clears the matching cookie. Pin local development mode to `NODE_ENV=development` plus configured loopback origin and absent Vercel deployment marker; all deployed/test production modes use secure cookie.
- [ ] **2.5 Harden `next.config.ts`:** remove all `env` entries, keep server environment usage; private headers for `/shoebox/:path*` and `/api/shoebox/:path*`, `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`, `Permissions-Policy: microphone=(self), camera=(), geolocation=()`. Keep existing image remote patterns for birthday; allow optimizer local paths only `/images/**` with empty search, denying `/api/shoebox/**` (existing synthetic optimizer fixture paths are intercepted before Next). No global CSP rewrite or birthday fix. Guard API routes even where Next auto-generates HEAD/OPTIONS behavior. Verify actual Next response headers, not just config objects.
- [ ] **2.6 Run GREEN** unit/auth commands, original `tests/e2e/birthday.spec.ts` and `tests/e2e/post-office.spec.ts`, lint/typecheck. Existing private birthday puzzle is not imported by shoebox. Unit tests prove resource cap; owner-run WAF verification remains mandatory Task 10.

## Task 3: Read-only Notion gateway, schema verification and pagination

**Files:** `server/notion-gateway.ts`, `memory-service.ts`, `memory-handlers.ts`; list and single-memory route files; `tests/helpers/mock-notion.ts`; `tests/unit/shoebox/{notion-reads,memory-reads}.test.ts`.

**Interfaces:** `createNotionGateway({client,clock,sleep}): NotionGateway` exposes database/source retrieval, query/retrieve/update/create page and upload methods, with SDK-compatible typed inputs (use SDK types, not `any`). `createMemoryService(gateway): {listMemories({cursor?}):Promise<MemoryPage>; getMemory(id:string):Promise<MemorySummary>; resolveMemoryMedia(id:string):Promise<TrustedMedia>}`; `createMemoryHandlers({service,requireSession,...httpDeps})` returns route handler functions. The service is an internal server-only dependency: handlers must verify session before constructing/calling it; no exported user-facing unguarded singleton, no import in client code. Tests may construct services directly using mocked transport.

Core RED assertions for the121-record fake gateway fixture:
```ts
const result = await service.listMemories({});
expect(result.items).toHaveLength(12);
expect(result.nextCursor).not.toBeNull();
expect(JSON.stringify(result)).not.toContain("https://");
```

- [ ] **3.1 Write RED tests** with 121 synthetic records: database has exactly one expected matching source/schema; two ambiguous sources/missing property types ->SETUP_REQUIRED; first page size=12 plus opaque next cursor, complete traversal finds all valid records beyond 100 without eager loading; descending Memory date then created_time; bounded cursor; no `file.url`/database ID/filename in JSON. Reject wrong database/source even with valid UUID, trashed, invalid kind, wrong media cardinality and external attachments. Invalid records are omitted without exposing raw errors, advancing the upstream cursor; can return an empty batch with a next cursor rather than looping without a budget. Handlers authenticate before SDK construction/query. Single-memory GET supports a valid backdated record absent from newest page.
- [ ] **3.2 Run RED:** `pnpm test:unit tests/unit/shoebox/notion-reads.test.ts tests/unit/shoebox/memory-reads.test.ts`.
- [ ] **3.3 Implement the read adapter/service:** lazy SDK client with existing server key, explicitly verify configured database/source/schema once per instance, page_size=12, sorts exactly above. Cache schema IDs only, never private records/responses. Validate rich-text lengths, date-only and finite media metadata; canonical local media path generated from UUID. Retain lockfile's installed `@notionhq/client` version; use explicit Notion API version `2026-03-11` for the new adapter, verified against its installed types, without changing existing service/API version behavior. Check installed SDK upload/page-trash signatures before coding rather than guessing. Split outgoing rich text into chunks <=1,000 Unicode code points (and <=2,000 UTF-16 units), so2,000-character emoji notes cannot breach Notion's per-rich-text-object limit; test join/round-trip.
- [ ] **3.4 Test and implement bounded retry in the gateway:** SDK `maxRetries:0` to prevent nested loops; max three attempts for safe reads and explicit 429/529, honor Retry-After, jitter fallback, do not retry `public_api_request_blocked` or block_creation 403. Operation deadlines: reads 15s; writes 45s (within configured route maxDuration=60). If wait exceeds remaining budget return 429/503 with bounded retry hint. Other transient read 500/502/503/504 retries permitted; ambiguous writes not repeated. Limit concurrent gateway operations per instance to two; no global limiter claim. Test long Retry-After, abort and sanitized errors with fake clock/transport. Query POST is a safe read, distinct from create-page POST.
- [ ] **3.5 Run GREEN**, `pnpm lint && pnpm typecheck`; confirm no changes to existing notionService/birthday API.

## Task 4: Safe photo/audio validation and local photo preparation

**Files:** Server `media-validation.ts`, `media-worker.mjs`; client `photo-processing.ts`, `audio-preview.ts`; `tests/unit/shoebox/{media-validation,photo-processing}.test.ts`; `tests/fixtures/shoebox/{README.md,...synthetic media}`; dependency/worker tracing config changes. Actual browser photo tests belong to Task8 once the composer is available, not a test-only application route.

**Interfaces:** `validateMedia(file: File, kind:"photo"|"audio", signal?:AbortSignal):Promise<ValidatedMedia>`; `inspectStoredMedia(bytes:Uint8Array, kind:"photo"|"audio", signal?:AbortSignal):Promise<Omit<ValidatedMedia,"bytes"|"filename">>` (does not re-encode bytes on downloads); `preparePhoto(file:File, signal?:AbortSignal):Promise<{file:File;width:number;height:number;previewUrl:string;dispose():void}>`; `inspectAudioPreview(blob:Blob, signal?:AbortSignal):Promise<{durationSeconds:number;mimeType:string}>`.

Core RED assertions with synthetic `webmNoDuration` and `hiddenVideoMp4` Files from the fixture manifest:
```ts
const media = await validateMedia(webmNoDuration, "audio");
expect(media.durationSeconds).toBeGreaterThan(0);
expect(media.durationSeconds).toBeLessThanOrEqual(60);
await expect(validateMedia(hiddenVideoMp4, "audio")).rejects.toMatchObject({code:"UNSUPPORTED_MEDIA"});
```

- [ ] **4.1 Write fixture provenance and RED tests:** generated JPEG with EXIF orientation/GPS, PNG transparency for browser conversion only, 2,048-edge JPEG, malformed/truncated JPEG, excessive dimensions; silent PCM WAV/MP3/Ogg/Opus, MP4/AAC and fragmented MP4, **WebM/Opus with no declared duration**; video-only and audio+video MP4/WebM hidden as `audio/*`, unsupported codecs, truncated atom/EBML, valid 59s, exactly60s and >60s, no/NaN/forged-short duration metadata with longer packets. All are synthetic, small and license-cleared; keep known expected packet lengths/hashes in README. No personal device capture fixture or runtime ffmpeg dependency. Tests assert no Notion call for rejection; corrupt/unknown audio cannot pass on MIME alone.
- [ ] **4.2 Run RED:** `pnpm test:unit tests/unit/shoebox/media-validation.test.ts tests/unit/shoebox/photo-processing.test.ts`. Mock canvas/bitmap APIs for unit algorithm tests; do not claim real-browser orientation compatibility until Task8/device checks.
- [ ] **4.3 Add direct Sharp and Mediabunny dependencies; implement worker boundary.** One short-lived Node worker per validation; max two concurrently per instance (overflow503); wall-clock5s deadline, worker resourceLimits maxOldGenerationSizeMb=64, terminate on deadline/abort. Transfer only capped media bytes/kind, never secrets. `media-worker.mjs` has static imports `sharp` and `mediabunny`, no arbitrary filesystem or URL inputs. Parent references its fixed project-relative path; use Next outputFileTracingIncludes for shoebox routes to retain worker and its dependencies, and production smoke-test the actual traced worker. If packaging fails, fix tracing—not a public-URL or unchecked-validation fallback.
- [ ] **4.4 Implement image/audio validation:** photo requires JPEG signature plus Sharp decode `failOn:'warning'`, limitInputPixels=4,194,304, no `unlimited`, max edge2,048, auto-orient, sRGB JPEG re-encode quality90, discard metadata, actual output <=4,000,000; reject oversized instead of server resizing a malicious oversized input. Mediabunny uses `Input` + `BufferSource`, **only** MP4/WEBM/OGG/MP3/WAVE input formats (not HLS/URL sources), enumerate tracks, require supported audio codec and zero video; inspect encoded packet timing/last packet and compute finite playback duration, rather than trusting declared container duration. Require one audio track for v1; codec allowlist per design. Bound to100,000 packets; reject nonfinite/impossible/backwards presentation timing or truncation, but account for legitimate AAC priming/pre-roll/edit-list timestamps through the parser's presentation timeline (do not reject valid Safari audio merely for negative codec pre-roll). Include that case in RED fixtures. Dispose Input in finally and terminate worker. Metadata parsing/packet inspection does not certify full decode/malware safety. Critical acceptance: metadata-less valid recorder WebM and fMP4 pass without WebCodecs/AudioDecoder/server transcode. If the pinned parser cannot do that, stop for a narrowly reviewed parser fix/replacement before continuing.
- [ ] **4.5 Implement browser photo processing:** max source20,000,000 bytes; orientation-aware `createImageBitmap` where supported with image-element fallback, dimension ceiling40MP after decode and early where inexpensive; do not claim pre-decode allocation is always avoidable. Flatten transparency to cream/white, max edge2,048, bounded JPEG quality attempts `[0.9,0.8,0.7]`, then long edge1,600 at0.75 as last attempt, fail if still >4,000,000. Do not upscale. Revoke source URL/close bitmap/reset canvas on every branch. Show saved local preview; server may re-encode at equivalent dimensions, so fidelity/metadata are normalized, not promised byte-identical. Decode failure text: “Esta foto no se puede abrir aquí. Prueba exportarla como JPEG o usar una captura.” No HEIC decoder installation or raw-source fallback. Audio client inspection dynamically imports the same packet parser for final local Blob validation, not `audio.duration` alone (which can be Infinity on recorder WebM); native playback still used for listening.
- [ ] **4.6 Run GREEN** plus a real Node worker test (not mocked parser). Test abort terminates worker/releases semaphore; falsified huge allocations hit deadline/resource guard. Node worker resourceLimits limit JS heap, not native/ArrayBuffer allocations: keep byte/pixel caps and Sharp decode timeout5s as additional controls, never claim a64MiB process memory cap. Browser preview orientation/HEIC cases run in Task8. Record package size/worker cold-start observation later, not a performance certification.

## Task 5: Multipart create, upload lifecycle and uncertain-outcome reconciliation

**Files:** Extend server gateway/service/handlers and memories route; create requests status route; `tests/unit/shoebox/{memory-create,request-status}.test.ts`; `tests/helpers/mock-media.ts`.

**Interfaces:** Extend service with `createMemory(input:CreateInput):Promise<{memory:MemorySummary;replayed:boolean}>`; `findRequest(requestId:string):Promise<RequestStatus>`; handler takes multipart through Task1 and `validateMedia` Task4. Query Request ID exact match with a small result cap to detect duplicates. All page/upload operations go through Task3 gateway/deadline.

Core RED assertions with a synthetic text `input` and observable fake Notion write counters:
```ts
const first = await service.createMemory(input);
const replay = await service.createMemory(input);
expect(replay).toEqual({memory:first.memory,replayed:true});
expect(fakeNotion.pageCreateCalls).toHaveLength(1);
expect(fakeNotion.fileUploadCalls).toHaveLength(0);
```

- [ ] **5.1 Write RED tests:** text creates no upload; photo/audio create-upload ->send multipart binary ->create page with files `file_upload.id`; attachment once within one hour; schema/types exact; no original filename/API key escapes. Invalid file fails before write. Simulate create/send/attach failure, expired upload, 429/529, timeout before/after page commit, Notion committed_resource_id/503 guidance. Replay same Request ID returns saved sanitized record without file reupload. Conflicting same ID + different text/date/caption/kind ->409; duplicate matches ->ambiguous/no automatic write. Unknown outcome ->202 OUTCOME_UNKNOWN; read-only status GET never uploads/creates. Missing status is not proof an old in-flight create cannot finish.
- [ ] **5.2 Run RED:** `pnpm test:unit tests/unit/shoebox/memory-create.test.ts tests/unit/shoebox/request-status.test.ts`.
- [ ] **5.3 Implement creation/reconciliation:** require auth/origin then bounded multipart and validation; check Request ID before network writes. Use installed SDK fileUploads API or explicit typed REST through adapter if a verified SDK gap requires it; filename generated `memory.jpg` / correct audio extension (`.weba` for audio/webm per Notion support), never user filename. Attach in a single page create with property values from schema section below. New name `Recuerdo <kind>` (not private text). No template/child blocks/status database. For uncertain final create, read committed ID when available then query Request ID; do not auto-repeat create on timeout/5xx. Retain unbound uploaded file only until automatic Notion expiry; do not invent a file-delete endpoint. One in-flight ID map per instance helps local repeats but is not durable correctness.
- [ ] **5.4 Define retry semantics:** after OUTCOME_UNKNOWN, client performs read-only status polling at1/2/4s, stops after3 attempts and shows “No sabemos todavía si se guardó. Comprobar de nuevo”. `found` completes; `ambiguous` shows recovery without deleting records; `not_found` keeps unknown until user explicitly retries after a warning, same ID and unchanged payload. Recheck ID immediately before retry. An explicit new/edited draft gets a new ID, but do not silently change ID for an uncertain draft. No strict exactly-once claim; no server auto-delete for rare duplicates. Store no media fingerprint property or extra database; compare available normalized fields on ID replay and document that original media identity cannot be proven after the fact.
- [ ] **5.5 Run GREEN** plus Task3/4 suites. Assert safe diagnostics include operation code/random ID only, and any fixture gateway send with external origin/auth token throws.

## Task 6: Authenticated bounded media, seeking and privacy-negative tests

**Files:** `server/media-source.ts`, `byte-range.ts`, `media-handler.ts`; media route; `tests/unit/shoebox/{media-source,byte-range,media-handler}.test.ts`; `tests/e2e/shoebox-media-privacy.spec.ts`.

**Interfaces:** `parseByteRange(header:string|null,total:number):{start:number;end:number}|null` (throw416 on invalid); `fetchTrustedMedia(media:TrustedMedia,signal:AbortSignal):Promise<Uint8Array>`; `createMediaHandler({requireSession,resolve,fetchBytes,inspect}):(request:Request,id:string)=>Promise<Response>`. App dynamic params are `Promise<{id:string}>`; route awaits them. `HEAD` explicitly uses same handler with suppressed body, not automatic unauthenticated metadata.

Core RED assertions:
```ts
expect(parseByteRange("bytes=2-4",10)).toEqual({start:2,end:4});
expect(parseByteRange("bytes=-3",10)).toEqual({start:7,end:9});
expect(() => parseByteRange("bytes=10-",10)).toThrow();
expect(() => parseByteRange("bytes=0-1,4-5",10)).toThrow();
```

- [ ] **6.1 Write RED range cases:** for10-byte buffer `bytes=2-4` ->206 `2-4/10`, length3; `bytes=4-` ->4..9; `bytes=-3` ->7..9; suffix>size ->whole206; start>=size, reversed, overflow, empty suffix, multiple ranges ->416 `bytes */10`; absent ->200 full. HEAD returns corresponding status/headers/no body. Conditionals never yield public304 cache paths. Missing/expired/forged session is401 **before record/fetch** for GET/HEAD, even with Range/If-None-Match; missing/wrong-source/trashed record404. A record with an arbitrary URL or external file never becomes an SSRF proxy.
- [ ] **6.2 Write RED upstream/privacy cases:** exactly4,000,000 bytes accepted, +1 cancels even without/smaller Content-Length; abort/deadline/redirect ->safe failure; content mismatches reject before headers; trusted URL credentials/port/http/private-IP/suffix-confusion denied; API token never sent to asset host; raw signed URL/token absent from JSON/errors/Location/logs. Simulated expired-link403 re-resolves once then retries once, other failures bounded. Validate no-store success/206/401/404/416/503. Optimizer request to `/api/shoebox/.../media` without cookie cannot retrieve bytes or a previous authenticated cache result.
- [ ] **6.3 Run RED:** `pnpm test:unit tests/unit/shoebox/media-source.test.ts tests/unit/shoebox/byte-range.test.ts tests/unit/shoebox/media-handler.test.ts` and privacy E2E after route wiring.
- [ ] **6.4 Implement URL/body/range rules:** allow exact verified Notion attachment hosts `prod-files-secure.s3.us-west-2.amazonaws.com`, `s3.us-west-2.amazonaws.com` with `/secure.notion-static.com/` bucket path, and `file.notion.so` only with observed/documented valid path; literal HTTPS hosts, no wildcard subdomains, no custom ports/userinfo, redirects `manual` and rejected. Broader regional/new hosts require explicit allowlist review, not blind `*.amazonaws.com`. Fetch credentials omitted, no Authorization/Cookie, cache:no-store, Content-Length checked and streamed bytes counted to4M, 10s asset timeout within15s media request budget. Upstream link refresh at most once; reject unexpectedly different kind/content. Reuse Task4 inspect without re-encoding, then buffer/slice and set your own canonical Content-Type/length/range/cache headers only. For HEAD compute validated size with the same bounded fetch; accept extra work over leaking unvalidated metadata. Finish no media response after cancellation; never redirect the client upstream.
- [ ] **6.5 Run GREEN** unit/browser privacy suites and production worker smoke. Check media concurrency/timeout and bytes do not rely on Vercel streaming exemption. Flag upstream allowlist compatibility as owner-authorized synthetic live verification gate, never relax to arbitrary URLs on failure.

## Task 7: Correction/removal with membership checks

**Files:** Extend service/handlers and `[id]/route.ts`; `tests/unit/shoebox/memory-mutations.test.ts`.

**Interfaces:** `correctMemory(id:string,patch:MemoryCorrection):Promise<MemorySummary>`; `removeMemory(id:string):Promise<void>`. Both require a prior trusted membership lookup and same-origin authenticated route; use Notion `pages.update({page_id,...properties})` or `in_trash:true` as supported by installed SDK.

Core RED assertions with fixture IDs and zeroed fake write counters:
```ts
await expect(service.removeMemory(foreignDatabaseId)).rejects.toMatchObject({code:"NOT_FOUND"});
expect(fakeNotion.pageUpdateCalls).toHaveLength(0);
await service.removeMemory(validMemoryId);
expect(fakeNotion.pageUpdateCalls[0]).toMatchObject({page_id:validMemoryId,in_trash:true});
```

- [ ] **7.1 Write RED:** correct caption/date and text-only body; cannot mutate kind/media/requestId/createTime/unknown fields; do not erase an omitted text body on a media memory; empty note invalid. Wrong source always404 before write; valid member already trashed removal idempotent204. If record disappears between lookup/update, surface404; uncertain updates re-read same ID instead of blindly applying another create. Two independent corrections are last confirmed write wins; no fake optimistic locking. DELETE with bytes/foreign Origin rejected. No internal permanent-delete/replace-file endpoint.
- [ ] **7.2 Run RED:** `pnpm test:unit tests/unit/shoebox/memory-mutations.test.ts`.
- [ ] **7.3 Implement only those property updates/trash.** After a successful patch re-read/sanitize if needed; don't cache old media/page responses. Preserve existing gallery behavior entirely. Map 403 permission/block limit separately to generic safe UNAVAILABLE/SETUP_REQUIRED, not a repeated mutation loop.
- [ ] **7.4 Run GREEN**, plus all auth/read/create tests. Document restore via Notion trash/manual export and retained-file limitation in owner runbook.

## Task 8: Phone composer, local previews and voice-recording lifecycle

**Files:** Client `api.ts`, `recorder.ts`, `useVoiceRecorder.ts`; components `MemoryComposer.tsx`, `VoiceRecorder.tsx`, minimal `ShoeboxArchive.tsx` host wired to the guarded page; `tests/unit/shoebox/{client-api,recorder}.test.ts`; `tests/e2e/shoebox-compose.spec.ts`, `shoebox-recording.spec.ts`, `shoebox-photo-processing.spec.ts`. Task9 extends this real minimal host; no test-only product route.

**Interfaces:** `shoeboxFetch<T>(path:string,init?:RequestInit):Promise<T>` normalizes API errors and non-JSON Vercel413/504, enforces fixed same-origin paths/credentials, does not automatically retry writes. `createVoiceRecorder(deps:RecorderDependencies):VoiceRecorderController` with `start():Promise<void>`, `stop():Promise<void>`, `discard():void`, `dispose():void`, `getSnapshot():RecorderSnapshot`, `subscribe(listener):()=>void`; snapshots tagged `idle|requesting|recording|stopping|preview|error` with elapsedMs/blob/actualMime/error as relevant. `useVoiceRecorder({onActiveChange})` adapts controller to React; recorder has no network/save responsibility. `MemoryComposer` props `{open:boolean;sessionValid:boolean;onSaved(memory):void;onClose():void;onReauthenticate():void}`; use same dialog for inline unsaved-discard/reauth panels, not nested dialogs. `RecorderDependencies` contains getUserMedia/createRecorder, MIME probes, clock/scheduler, local inspect and lifecycle subscriptions; no fetch/upload dependency. The Task8 minimal host owns expiry/draft/reauth lifecycle too; Task9 extracts it into the full hooks without changing behavior.

Core RED assertions with fake mic/track and real controller lifecycle:
```ts
expect(fakeMic.getUserMedia).not.toHaveBeenCalled();
await controller.start();
await controller.stop();
expect(fakeTrack.stop).toHaveBeenCalledOnce();
expect(controller.getSnapshot().state).toBe("preview");
expect(fakeNetwork.uploads).toHaveLength(0);
```

- [ ] **8.1 Write RED recorder tests with fake time/MediaRecorder/tracks:** no mic on construction/render; explicit start probes supported MIME, asks permission once; constructor/start throws ->cleanup/fallback; denied/notfound/notreadable/insecure/noMediaRecorder; late permission success after discard/unmount stops acquired tracks; stop waits for final dataavailable; all tracks stopped on normal/error stop; 60,000ms deadline and byte pre-cap stop; delayed final chunk yielding >4,000,000 or >60s rejected, no encoded truncation; empty Blob/unsupported actual MIME rejected; request chunks are not clock source. Hidden/pagehide/track mute/ended/unmount/log out terminates capture, never resumes automatically; repeated start/stop does not duplicate listeners/chunks; object URLs revoked and old async generations ignored.
- [ ] **8.2 Run RED:** `pnpm test:unit tests/unit/shoebox/recorder.test.ts tests/unit/shoebox/client-api.test.ts` and composer browser specs after minimal rendering harness.
- [ ] **8.3 Implement recorder controller:** feature detect secure context/getUserMedia/MediaRecorder/isTypeSupported plus `audio.canPlayType`; candidates MP4/AAC (`audio/mp4;codecs=mp4a.40.2`, then `audio/mp4`), WebM/Opus, Ogg/Opus in that order. No video getUserMedia constraint; audio channelCount1/echoCancellation optional hints; audioBitsPerSecond64,000, timeslice250ms, stopwatch monotonic, 60s hard stop request and conservative3,500,000-byte threshold. Stop immediately on interruption; clear deadline before finalization; validate final Blob using Task4 finite packet duration. Encoder padding can make a nominal60s clip slightly over limit: show retry/shorter-recording explanation, never silently accept >60 or pretend timers guarantee precise capture. Use cancellable generation guards and always cleanup tracks/object URLs; no AudioContext requirement or background behavior promise.
- [ ] **8.4 Write UI RED tests:** Foto/Audio/Texto selection, date defaults to local calendar even near UTC rollover; local preview/retry/discard before save; Save disabled while processing/saving/invalid; zero network uploads until explicit Save; second tap one POST; session401 retains in-memory draft only and demands explicit save after inline reauth; corrupted/non-JSON413 shows clear error; unknown outcome/status found/notfound/ambiguous follows Task5; cancel during pending upload warns that server save may finish and prevents automatic new ID retries. Draft field change creates a new ID only when old outcome is known, not during uncertain submission. New photo/file clears old object URL; closing unsaved form first asks inline confirmation; reload warning is best-effort only.
- [ ] **8.5 Implement composer using native labelled inputs/textarea/date, `JournalDialog` with stable initialFocusRef and one modal owner.** Native audio preview controls with preload metadata/none as needed, no autoplay. Upload fallback accepts design formats only, max4M/60s, still validates server-side. Reuse Task4 browser image/audio checks; form retains draft until confirmed save/discard/logout, no storage API for drafts. “Reintentar” uses identical Request ID after reconciliation; cancel request uses AbortController but explains it is not server rollback. `shoeboxFetch` inspects the response envelope even for HTTP202 (which has response.ok=true): OUTCOME_UNKNOWN is a dedicated uncertain result/error, never a successful save or discarded draft.
- [ ] **8.6 Run GREEN** all named suites, `pnpm test:e2e tests/e2e/shoebox-photo-processing.spec.ts` for actual browser orientation/large decode/unsupported HEIC/previews and disposal, plus unit tests; manual synthetic cross-engine smoke with codec probes at Task10. Chromium fake recorder is not evidence of actual phone recording compatibility.

## Task 9: Impossible archive, paging, dialogs, corrections and global motion boundary

**Files:** Client `useShoeboxSession.ts`, `useMemoryArchive.ts`; remaining shoebox components, CSS and motion hook; wire shoebox page placeholder to archive; modify `src/sections/Footer.tsx` for entry link only; `tests/e2e/shoebox-{browse,mutations,scene,session}.spec.ts`; `tests/unit/shoebox/archive-state.test.ts`.

**Interfaces:** `useShoeboxSession(initialExpiresAt:number)` returns `{state:'checking'|'valid'|'expired';expiresAt;revalidate():Promise<void>;logout():Promise<void>}`. `useMemoryArchive({onUnauthorized})` returns `{page:MemoryPage|null;state;error;older();previous();refresh();getOne(id);onSaved(memory);onCorrected(memory);onRemoved(id);clear()}`; owns one batch and bounded cursor stack (maximum100 previous cursors, oldest dropped with “Volver al principio” available); no private list persistent storage. `useShoeboxMotion({dialogOpen:boolean,recording:boolean})` returns `{paused:boolean;reduced:boolean;togglePause():void;mischief():void}` plus route data attributes. `ShoeboxArchive({expiresAt:number})` owns one discriminated dialog state, draft/session gate and one active audio element ref; scene consumes decorative flags only, never record data selection.

Core RED UI assertions after authenticated fixture setup and an older-batch navigation:
```ts
await expect(page.locator("[data-memory-id]")).toHaveCount(12);
await page.getByRole("button",{name:"Recuerdos anteriores"}).click();
await expect(page.locator("[data-memory-id]")).toHaveCount(12);
await expect(page.getByRole("heading",{name:"Los recuerdos de esta caja"})).toBeFocused();
```

- [ ] **9.1 Write RED browse/state tests:** empty/loading/retry and 12-item bound, same memory order visually/DOM; >100-fixture pagination, previous/older replaces not appends; failed older load keeps current batch; rapid refresh/older latest request wins; dedupe visible IDs; backdated save has “Ver recuerdo” detail GET/dialog; saved-date ordering preserved; no private media/date/count on public footer. On remove last batch item, preserve controls and offer previous/newest (no endless auto-loop); edit moving record out of date order refreshes batch. Missing/removed detail404 closes stale media and returns focus to batch heading when original trigger disappeared.
- [ ] **9.2 Write RED session/negative UI tests:** expiry timer hides private archive/media, pauses playback and microphone; visibility/pageshow checking gate hides old DOM and revalidates before reveal; pagehide clears private rendering before potential bfcache capture, keep composer state only in current tab if returning while valid; reauth does not automatically resubmit. Logout clears all draft/list/URLs/audio and uses full navigation; returning via back cannot expose stale memory before guard. Late fetch/correction/record-preview completion after expiry never reveals it. Network failure on session check is fail-closed checking/error, not presumed-valid. One native dialog at a time and inherited AMOR shortcuts stay inert while composing.
- [ ] **9.3 Run RED:** `pnpm test:unit tests/unit/shoebox/archive-state.test.ts` and `pnpm test:e2e tests/e2e/shoebox-browse.spec.ts tests/e2e/shoebox-session.spec.ts`.
- [ ] **9.4 Implement archive/session hooks and dialogs:** fetch list after gate, sanitize API via strict response expectations, cancellation generation, one active audio paused on next/play/detail/page/logout. On pagehide/visibility loss synchronously mark private archive/dialog surfaces hidden via a route-owned DOM attribute before scheduling React state updates; pageshow keeps this gate closed until session revalidation succeeds. Do not rely only on a deferred React effect to prevent a stale bfcache frame. Already downloaded bytes cannot be recalled. Photo dialog uses ordinary `<img>` contain + caption/date, no next/image or reused birthday public photo viewer. Correction form reuses stable fields; confirmation initial focus Cancel; successful removal chooses adjacent existing action or heading fallback without orphan focus. Same ID on screen is keyed stable; no invented placeholder memories. Public footer link `href='/shoebox' prefetch={false}`; keep existing surprise triggers working and unchanged.
- [ ] **9.5 Write scene/mutation RED browser tests:** 320/390/430/768/1440 and landscape, 2,000-char/unbroken notes, image blocked/error, stable target geometry before/during twenty rapid No tocar presses, max one reaction and <3s completion, native controls not occluded, no horizontal overflow/text clipping; audio no autoplay and one-at-a-time; empty/loading/failed batch/media graceful states. Keyboard dialog initial focus/Tab/Escape/inert background/return; correction400/401/404/503 and removal confirm/cancel/failure leave correct record; two-client changes and last-write-wins visible after refresh. Compare reaction frames/geometry, not data attributes alone.
- [ ] **9.6 Implement the approved visual scene:** warm ink/cream/coral/teal existing visual language, deterministic paper tilt/tape/legs and jar forms, moon/fish SVG with Spanish reactions; no generic grid-card replacement. Real content surfaces and control wrappers untransformed; decorative wrappers/limbs use reserved gutters and pointer-events:none/aria-hidden. Use normal-flow staggered composition. Own scoped stylesheet `body:has(.shoebox-world)` controls inherited dream-gallery/header decorative CSS animation pause via root data attributes; scoped cleanup removes attributes on route exit. Inspect all visible inherited CSS animations, not just new scene. `prefers-reduced-motion` stops CSS/JS transitions live; pause in localStorage key `tor-landa:shoebox-motion-paused` (only this non-sensitive preference), hidden tab/dialog/recording pauses ambient and mischief. Observe any global native dialog opening to pause scene without taking modal ownership. Settle mischief to static punchline when paused/reduced, never moving controls or real memory surfaces.
- [ ] **9.7 Run GREEN** all shoebox unit/E2E cases and all existing home/history/birthday/post-office suites. Capture synthetic phone/desktop normal/reduced/day/night scene plus at least one intermediate mischief frame and actual controls; inspect the captures. Confirm no global layout/provider changes, no new footer focus problems, no CSS leak after navigating home.

## Task 10: Production-path privacy, compatibility, documentation and final verification

**Files:** `scripts/check-shoebox-bundle.mjs`; `playwright.shoebox.config.ts`; `tests/e2e/shoebox-{privacy,compatibility}.spec.ts`; `docs/shoebox-setup.md`; verification notes; package scripts/knip only as needed. The approved design is not replaced by this runbook.

**Interfaces:** `pnpm test:unit` -> `vitest run`; `pnpm test:shoebox:browsers` -> `playwright test --config=playwright.shoebox.config.ts`; `pnpm check:shoebox` -> safe runner for units, focused browsers, original `pnpm check`/E2E and client canary scan. Safe runner must not suppress genuine failures or issue live external API calls. Preserve original `pnpm check` semantics; `check:shoebox` is the additional mandatory new-feature gate that also runs unit tests. No recursive `check`/`check:shoebox` script calls.

Core RED real-HTTP assertions (not browser-routed fixtures):
```ts
const response = await request.get("/api/shoebox/memories",{headers:{"Sec-Fetch-Site":"same-origin"}});
expect(response.status()).toBe(401);
expect(response.headers()["cache-control"]).toContain("no-store");
expect(await response.text()).not.toContain(syntheticPrivateNote);
```

- [ ] **10.1 Write RED production-path privacy tests:** actual local Next HTTP page/redirect/RSC/prefetch; direct all methods for list/single/status/upload/correction/removal/media/login/logout without cookie, with forged/expired cookie and cross-site origin; assert statuses/private headers/error redaction. Session-cookie auth is real, not browser-routed. API factories use fake Notion transport for authenticated handler behavior; browser composer mocks sanitize list/media and fail all external requests. Verify both cold and after-auth optimizer requests; direct remote URL query in private media returns400, not a proxy. Existing remote optimizer host access with a known synthetic upstream URL must not yield scrapbook bytes; do not use real bearer URLs. `source '/api/shoebox/:path*'` header match includes root route and error/method paths. Paths/case/encoded variants must not produce another unthrottled login POST endpoint.
- [ ] **10.2 Run RED:** `pnpm test:e2e tests/e2e/shoebox-privacy.spec.ts`; `pnpm test:shoebox:browsers`. Config projects cover Chromium phone/desktop plus desktop Firefox and iPhone-sized WebKit. Install engines after approval with `pnpm exec playwright install chromium firefox webkit`; browser results never substitute for physical device recording.
- [ ] **10.3 Fix privacy/production packaging gaps narrowly.** Run `pnpm build`/local production server with synthetic creds, validate worker's actual traced path/modules on real GET/create media calls via handler integration and production smoke (no Notion upstream). Scan only emitted client/static chunks and rendered HTML/RSC for known synthetic canary values of `NOTION_API_KEY`/password verifier/session secret; fail if found, log file paths and variable names only, not their values. No scanning/copying personal `.env` or deployed bundles. Headers may be overridden by framework/hosting; assert actual prod responses and treat failure as blocker. No workaround that returns upstream URLs, disables auth, weakens byte limits or suppresses tests.
- [ ] **10.4 Write the manual runbook** using only environment names/placeholders, schema below and owner gates below. Secret/password creation must be an owner-run, hidden-input/local password-manager procedure, not a shell argument/history/stdout value generated/read by the agent. Document fixed scrypt format/parameters and independent >=32-byte session secret, seven-day lifetime, logout vs stolen-token rotation, no E2EE, no full-delete guarantee, partial upload expiry and duplicate resolution. Document current platform source URLs from the design plus parser references below and chosen pinned package versions/licenses. No secret screenshots/logs.
- [ ] **10.5 Run GREEN and full fresh gates:** `pnpm test:unit`; `pnpm lint`; `pnpm typecheck`; `pnpm test:e2e`; `pnpm test:shoebox:browsers`; `pnpm check`; synthetic production build/worker/client-canary smoke via `pnpm check:shoebox`; `git diff --check`. Record exit codes/test counts/warnings and actual diff. Independently review security boundaries and visual/motion evidence according to the chosen execution method, fix important findings and rerun impacted/full gates. Do not invent a green result when browser engine/install/fixture issues block a run.
- [ ] **10.6 Handoff without deployment/commit.** List implemented scope, tests, inherited warnings, unresolved real-device/Vercel/Notion gates. No “production ready/private on Vercel” claim until owner-authorized checks pass. Never merge/push/main/deploy as part of this plan.

## Manual Notion setup (later, owner-authorized only)

1. Confirm the workspace still has **one member**; the second website user needs no Notion account. Create a new full-page **Memories** database on a private page; never publish or share to web. Not birthday's database.
2. Properties, exact names/types: `Name` title; `Kind` select values `photo`, `audio`, `text`; `Memory date` date; `Caption` rich_text; `Text` rich_text; `Media` files; `Request ID` rich_text; `Width` number; `Height` number; `Duration` number. No formulas, required templates, child blocks, Active/Order/author/status columns or original URLs. Notion itself supplies created_time and in_trash.
3. Connect the existing integration to this database with read/insert/update content permissions; avoid broader access. Confirm there is one matching data source and correct property types; service fails closed on ambiguity rather than silently using the first source.
4. Owner sets `SHOEBOX_NOTION_DB_ID`, `SHOEBOX_PASSWORD_HASH`, `SHOEBOX_SESSION_SECRET`, `SHOEBOX_APP_ORIGIN` and existing server `NOTION_API_KEY` in the relevant local/Vercel environment through trusted secret UI. No `NEXT_PUBLIC_` variants. Production and preview/test secrets/origins separate; no automatic wildcard preview origins.
5. Precautionary integration-token rotation before expanding access is recommended because `next.config.ts` had an unsafe env declaration. No deployed leak was established. Rotation and updating dependent local/Vercel configuration require approval and owner handling; verify existing quality/birthday integrations afterward without changing their schemas or public behavior.
6. Only after authorization, use a disposable synthetic test database to verify real create/send/attach/read/correct/trash plus expired file links; verify retained file/restore behavior before personal memories. A Free workspace multi-member change later can trigger the lifetime-block limit and is an operational choice, not an upload retry condition.

## Manual deployment/real-device gates (not authorization to perform them)

| Gate | Check and required result |
| --- | --- |
| WAF capacity/configuration | Hobby rule available; exact normalized POST `/api/shoebox/session`, five requests/60s/IP, enforced429 not log-only; all login aliases denied or canonicalized before verification. Existing rules are not overwritten. Regional fixed-window/per-IP limits and distributed guessing residual risk documented. Absence blocks public launch. |
| Vercel Hobby execution | Authorized synthetic preview only:4,000,000-byte file+metadata multipart fits;4,000,001 file/4,200,001 total rejects; non-JSON platform413 understandable; Node worker trace/module load/resource limits work; maxDuration60 fits read15/write45s budgets. |
| Private download | Authorized synthetic JPEG/audio only: logged-out GET/HEAD/range fail; authenticated200/206 length correct below4.5MB; seek Safari/Android; no public CDN reuse across sessions; no raw Notion links or optimizer bypass; cache/no-store on redirects/errors/RSC as well as media. |
| iPhone Safari | Permission denied/granted, native mic indicator turns off after stop/cancel/hide/unmount; MP4/AAC or detected permitted alternative preview/save/play on both people's target phones;60s/final chunk limit; call/lock/navigation interruptions; no auto-resume/upload. Test HEIC from camera/library, rotated JPEG, large photo failure, keyboard/safe-area sheet scroll. |
| Android Chrome | Same lifecycle plus WebM without duration metadata and screen-lock chunk delay; cross-play saved Android recording on Safari. If unsupported, expose fallback upload and record limitation; do not claim codec universality. |
| Desktop engines/accessibility | Chromium/Firefox/Safari record/upload fallback and playback; keyboard Tab/Escape/focus restoration; OS screen reader status/labels;200% zoom;320px reflow; reduced motion and pause all scenery; audio transcript limitation explicit. |
| Owner recovery/privacy | Notion restore/export, failed/unknown create verification and rare duplicate removal; password+session-secret rotation invalidates old tokens; logout only clears this browser, already downloaded bytes cannot be recalled. |

## Plan self-review / spec coverage

- [x] Intent, surreal direction, stable controls, bounded growth, accessibility/motion ->Tasks8–9; copy/decorations cannot gate access or alter memories.
- [x] Auth/read/mutation/media/session/guessing/CSRF/secrets/cache ->Tasks1–2,6,9–10; no per-instance limiter represented as durable protection.
- [x] Dedicated Notion schema/lifecycle/pagination/rate limits/retries/trash ->Tasks3,5,7 plus owner runbook; no new provider or birthday coupling.
- [x] Photo cap/orientation/HEIC/server validation and recorder compatibility/interruption/cleanup ->Tasks4,8 plus device gates.
- [x] Uploaded/streamed download ceiling, buffering/range/response validation ->Task6 and Vercel gate; no assumption streaming raises payload limit.
- [x] Negative tests, mocking, real handler vs browser fixtures, baseline/redesign regression, production-path canaries and manual checks ->Tasks1,10 and each task's RED/GREEN steps.
- [x] Five Review Focus risks assigned to explicit owning tests, API/type/property names cross-checked, no generic “handle edge cases” task replacing specified behavior.
- [x] Resource correctness: finite body/file/duration/pixel/deadline/worker/concurrency bounds; no uncancellable Promise.race presented as CPU/mic cancellation; late-success guards covered.
- [x] Unknown-write and concurrency limitations honest: no durable exactly-once/global lockout claim; no blind create retry or automatic duplicate deletion.
- [x] Design approval recorded; this plan requests approval only. No live resources/dependencies/product edits performed in planning.

Self-review corrections incorporated before handoff: deferred actual browser photo tests until a real composer exists; added a minimal real composer host in Task8 to avoid an out-of-order UI dependency; removed an inconsistent service Session-parameter instruction in favor of handler-first guarding/internal server-only services; pinned rich-text chunking for emoji length; specified202 unknown-outcome handling; distinguished worker JS heap limits from native memory limits; preserved legitimate AAC priming; made pagehide privacy gating synchronous instead of relying solely on deferred React effects.

### Remaining verification limits, not unresolved product choices

Package installation/actual media fixtures/worker bundling, runtime baseline and all RED/GREEN commands are **future unexecuted work**. Mediabunny packet inspection was selected from current docs (version1.62.0 observed), but installed behavior must pass Task4 before it is trusted; do not turn a library metadata claim into a security assertion. Image orientation/HEIC, capture behavior on physical phones and exact Vercel/cache/WAF settings cannot be certified without later authorized tests. A genuine failure of a fundamental gate pauses execution for a revised plan, not a quiet scope/privacy reduction.

### Planning references read

Use design section10 for official Notion/Vercel/browser sources rechecked in this session. Additional planning reads: matching installed Next docs `01-app/03-api-reference/03-file-conventions/route.md` (async params), `05-config/01-next-config-js/headers.md` and `02-components/image.md` (headers/optimization/localPatterns), `JournalDialog.tsx`, Footer/Header, existing Playwright fixtures, TS/Biome/Knip/dependency-cruiser configs and pnpm build allowlist. Parser references: https://mediabunny.dev/guide/reading-media-files and https://mediabunny.dev/guide/supported-formats-and-codecs ; Sharp safety controls https://sharp.pixelplumbing.com/api-constructor/ ; JOSE SignJWT/jwtVerify documentation in https://github.com/panva/jose/tree/main/docs . No dependency code copied into product source and no library installed during planning.
