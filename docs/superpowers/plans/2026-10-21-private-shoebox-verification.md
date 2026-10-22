# Private shoebox verification log

## Latest: final fix continuation, 2026-10-22

- Completed setup helper/shared password parameters, public setup notices,
  code-based login error mapping, server-only schema property diagnostics and
  runbook updates; preserved inherited M1/M5/M7/M8 hardening.
- Fresh `pnpm test:unit`: **693/693**, 27 files. `pnpm lint`: exit0, eight original
  warnings; typecheck, Knip, dependency check and tracked whitespace check pass.
- **Full aggregate BLOCKED**, not green: `pnpm check:shoebox` refuses the owner's
  existing local environment file before starting any server. Safety Net also
  denied the attempted secret-free source copy. No alternate-tool/path workaround
  was attempted, and no real secret values were inspected.
- Example-file documentation edit is separately blocked by Safety Net; the
  escaping/setup instructions are in `docs/shoebox-setup.md` instead.
- No new build/browser/production/canary results are claimed for this final diff.
  Detailed item status, RED/GREEN logs, scoped self-review and deferred minors:
  `.superpowers/sdd/2026-10-21-private-shoebox/final-fix-report.md`.
  No commits, pushes, deployment, live checks or owner-server interference.

Checks use synthetic or empty Notion/Telegram/webhook/app configuration. Historical
exception: Task 9's first environment-only server did contact Notion with a fixed
invalid key; see its report and ledger incident/containment, not a blanket offline
claim. Task 10 adds reproducible server-process outbound enforcement. No real
credential values are included in this log.

## Task 1: offline baseline, strict inputs, private HTTP primitives

### 1.1 Baseline (before product edits)

- Branch `feat/private-shoebox`; pre-existing untracked docs only
  (`docs/superpowers/plans/2026-10-21-private-shoebox.md`, `docs/superpowers/specs/`).
- Node v24.21.0, pnpm 11.17.0, Playwright 1.64.1. `node_modules` already present.
- `pnpm install --frozen-lockfile`: "Lockfile is up to date", already up to date
  (lockfile was in sync, nothing installed).
- `pnpm lint`: exit 0, 8 warnings (src/app/api/notify/route.ts 1,
  src/services/notionService.ts 3, tests/e2e/home-reading.spec.ts 4).
- `pnpm typecheck`: pass. `pnpm knip`: pass.
- `pnpm test:e2e`: port 3100 was already occupied by a process I did not start, so
  the config's own web server refused to start. I started my own `next dev` on
  127.0.0.1:3101 with the synthetic env and ran `E2E_BASE_URL=http://127.0.0.1:3101`.
  Result: 215 passed, 1 failed (`fish-delivery.spec.ts:208`, desktop, 60 s timeout
  under 9-worker load). Re-run alone (`--workers=1`): passed in 30.3 s. Treated as a
  pre-existing load-sensitive flake. My dev server was stopped afterwards.
  No browser install was needed.
- `pnpm check` (lint, format:check, typecheck, knip, depcheck, build): exit 0.

### 1.2 Dependencies and scripts

`pnpm add -D vitest` (5.0.5) and `pnpm add server-only` (0.0.1); script
`"test:unit": "vitest run"`. No existing package changed (lockfile diff is additions
only). Vitest config is `vitest.config.mts` (not `.ts`): the package is CommonJS and a
`.ts` config prints a Vite `configLoader: native` warning.

### 1.3 RED

Implementation had been drafted before the tests, so it was moved out of the tree to
make both REDs honest.

RED A, modules absent:
`pnpm test:unit tests/unit/shoebox/validation.test.ts tests/unit/shoebox/http.test.ts tests/unit/shoebox/body.test.ts`
```
Error: Cannot find package '@/features/shoebox/limits' imported from .../body.test.ts
Error: Cannot find package '@/features/shoebox/server/config' imported from .../http.test.ts
Error: Cannot find package '@/features/shoebox/limits' imported from .../validation.test.ts
 Test Files  3 failed (3)   Tests  no tests
```
Expected: the single permitted missing-module RED.

RED B, permissive stubs (validators return input, `privateJson` adds no headers,
body readers read everything, origin guards no-op), same command with
`--testTimeout=2000`: `Test Files 3 failed (3)  Tests 34 failed | 9 passed (43)`.
Representative behavioral failures:
```
validation > rejects dates that are not real calendar days
  AssertionError: expected [Function] to throw an error   (2026-02-30 accepted)
http > privateJson > marks every response private and uncacheable
  AssertionError: expected null to be 'private, no-store, max-age=0'
http > toErrorResponse > never leaks raw error details
  AssertionError: expected 500 to be 503
body > readBodyLimited > cannot be bypassed by a false small Content-Length
  AssertionError: expected undefined to be 'TOO_LARGE'
body > readMultipart > accepts a file of 4,000,000 bytes and rejects 4,000,001
  AssertionError: expected undefined to be 'TOO_LARGE'
```
Expected: stubs accept everything, so each boundary rejection fails. The 9 passing
tests were happy-path/config/offline-guard tests that the stubs legitimately satisfy.
Finding during RED: first guard attempt only patched `net.Socket.connect`; a blocked
fetch took ~7.8 s. Added a `globalThis.fetch` wrapper that rejects immediately (socket
guard kept as a backstop).

### 1.4/1.5 GREEN

Real implementation restored. Same command:
```
 Test Files  3 passed (3)
      Tests  43 passed (43)
```
Also: `node scripts/run-shoebox-checks.mjs` 43 passed; `pnpm lint` exit 0 (same 8
pre-existing warnings, none in new files); `pnpm format:check`, `pnpm typecheck`,
`pnpm knip`, `pnpm depcheck`: pass.

### Limitations

- `pnpm build` was not re-run after the new modules (nothing imports them yet).
- Runner `scripts/run-shoebox-checks.mjs` only runs unit tests so far; Task 10 extends it.

## Task 2: password/session boundary and guarded page shell

Dependency: `pnpm add jose` -> `jose 6.2.12` (lockfile additions only).
Port 3100 was held by a foreign `next-server` (cwd `.../bc1d6b/ipad-countdown`), and a
second foreign `next dev --port 3101` was running from this worktree (started 21:03,
not by this task; Next refuses a second dev server per directory). Neither was touched.
E2E therefore ran against my own server started from a scratch copy of this worktree
(synthetic env only, origin `http://127.0.0.1:<port>`), with `E2E_BASE_URL`.

### 2.1/2.2 RED

RED A (missing modules), `pnpm test:unit tests/unit/shoebox/password.test.ts
tests/unit/shoebox/session.test.ts tests/unit/shoebox/auth-handlers.test.ts
tests/unit/shoebox/body.test.ts`:
```
Error: Cannot find package '@/features/shoebox/server/auth-handlers'
Error: Cannot find package '@/features/shoebox/server/password'
Error: Cannot find package '@/features/shoebox/server/session'
TypeError: readJsonLimited is not a function   (x5)
```
RED B, permissive stubs (verifyPassword -> true, sessions always valid with zero
lifetime, handlers always 200, readJsonLimited unbounded), same command:
`Test Files 4 failed (4)  Tests 93 failed | 25 passed (118)`. Representative:
```
login > succeeds only with the real password ...   expected null to be 'private, no-store, max-age=0'
login > accepts a 4,096-byte body and rejects 4,097 bytes with 413   expected 200 to be 413
login > rejects a foreign Origin with 403 ...   expected 200 to be 403
login > answers 503 when more than two password checks run at once   expected [200,200,200] to deeply equal [401,401,503]
login > fails closed with 503 SETUP_REQUIRED for a malformed verifier   expected 200 to be 503
getSession > returns 401 once the absolute expiry is reached   expected 200 to be 401
logout > keeps the origin guard ... even when logged out   expected 200 to be 403
verifyPassword > does not trim or normalize the password   expected true to be false
readJsonLimited > rejects one byte over the limit   expected { a: 1 } to be an instance of ShoeboxError
```
Passing under stubs: the 20 pre-existing body tests plus happy paths the stubs satisfy.

E2E RED: real routes/pages present, `next.config.ts` temporarily reverted to HEAD,
`E2E_BASE_URL=http://127.0.0.1:3102 pnpm test:e2e tests/e2e/shoebox-auth.spec.ts`:
16 failed, 6 passed. Failures: missing private headers (`x-frame-options Received:
undefined`, `cache-control Received: undefined` on 405s, `no-cache, must-revalidate`
on pages). Passing: wrong password, logout, and the optimizer test. Finding: the
optimizer test already passed without `localPatterns` (Next 16 rejects local query
strings by default, and `/api/shoebox/*` is not an image, so it answers 400). The
`/images/**` allowlist is defense in depth, not a fix for an observed bypass.

### 2.6 GREEN

- Unit, same four files: `Test Files 4 passed (4)  Tests 118 passed (118)`.
  Full `pnpm test:unit`: `6 passed (6)  145 passed (145)`; `node scripts/run-shoebox-checks.mjs`: 145 passed. No stray output.
- E2E dev (`next dev`, port 3102): `pnpm test:e2e tests/e2e/shoebox-auth.spec.ts
  tests/e2e/birthday.spec.ts tests/e2e/post-office.spec.ts` -> `82 passed (1.9m)`.
- E2E production (`next build` + `next start`, port 3103, `SHOEBOX_E2E_PRODUCTION=1`):
  `shoebox-auth.spec.ts` -> `22 passed` (cookie `__Host-shoebox`, Secure, HttpOnly, Strict).
- `pnpm lint` exit 0 (same 8 pre-existing warnings), `format:check`, `typecheck`, `knip`, `depcheck` pass.
- `pnpm build` (worktree, synthetic env): success; `/shoebox`, `/shoebox/login`,
  `/api/shoebox/session`, `/api/shoebox/logout` are dynamic (ƒ). `server-only` imports build.
  `.next/static` contains none of `test-notion-key`, `SHOEBOX_SESSION_SECRET`, `scrypt-v1`.

Fix found during GREEN: `birthday.spec.ts:492` (both projects) failed in `next dev`
because next/image throws in the browser for local `src` paths outside `localPatterns`
(`/__fixtures/photo-a.png`), before the Playwright optimizer intercept runs. Added
`/__fixtures/**` (empty search) to `localPatterns` only when NODE_ENV is not production.

### Observed response headers (`next start`, curl)

```
GET /shoebox (no cookie)  307  location: /shoebox/login
  Cache-Control: private, no-store, max-age=0 | CDN-Cache-Control: no-store
  Vercel-CDN-Cache-Control: no-store | Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff | X-Frame-Options: DENY
  Content-Security-Policy: frame-ancestors 'none'
  Permissions-Policy: microphone=(self), camera=(), geolocation=()
  X-Robots-Tag: noindex, nofollow, noarchive
GET /shoebox/login         200  same set
GET /shoebox?_rsc=x RSC:1  307  same set
GET /api/shoebox/session   401  same set
GET /api/shoebox/nope      404  Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate (+ rest of set)
HEAD /api/shoebox/session  401  private no-store, empty body
OPTIONS /api/shoebox/session 405 allow: GET, HEAD, POST, private no-store, no CORS headers
```
In `next dev` only, Next overwrites page HTML Cache-Control with
`no-cache, must-revalidate`; route handlers and RSC/redirect responses keep the config
value. The e2e fixture expects the dev value only for page HTML in dev mode.

### Limitations

- Owner-run Vercel WAF verification remains Task 10. The two-job scrypt cap is per instance only.
- Deployed edge headers are not verified locally.

## Task 3: read-only Notion gateway, schema verification and pagination

### 3.1/3.2 RED

Tests written first (`tests/unit/shoebox/notion-reads.test.ts`, `memory-reads.test.ts`,
offline fake `tests/helpers/mock-notion.ts`). To get behavioral rather than
missing-module failures, the modules existed as inert skeletons (gateway passed calls
straight through, service returned an empty page, handlers returned 500, chunker returned
`[]`, `createSdkClient` threw). Command:
`pnpm test:unit tests/unit/shoebox/notion-reads.test.ts tests/unit/shoebox/memory-reads.test.ts`

`Test Files  2 failed (2)` / `Tests  105 failed | 4 passed (109)`. Representative assertions:

- `pagination over 121 records > returns a first batch of 12...`:
  `AssertionError: expected [] to have a length of 12 but got +0`
- `traverses every valid record beyond 100...`: `expected [] to deeply equal [ ...(115) ]`
- gateway retry/sanitizing: `expected APIResponseError: synthetic upstream failure ... to be an
  instance of ShoeboxError` (9), `Error: expected a rejection` (10: raw 429/5xx not mapped)
- handlers: `expected 500 to be 401`, `expected 500 to be 200`, `expected 500 to be 503`
- concurrency / deadline: `Test timed out in 5000ms` (no limiter, no deadline)

### 3.3/3.4/3.5 GREEN

- Same command: `Test Files  2 passed (2)` / `Tests  109 passed (109)`; three repeat runs
  identical, output pristine (console.error silenced by spy where toErrorResponse runs).
- Full `pnpm test:unit`: `Test Files  8 passed (8)` / `Tests  254 passed (254)`.
- `pnpm lint`: no errors; 8 warnings, all pre-existing (notify route, notionService,
  home-reading e2e). `pnpm typecheck` and `pnpm knip` clean.
- `src/services/notionService.ts` and birthday/quality APIs untouched.

### Limitations

- No live Notion call was made; the 2026-03-11 behavior of parent/in_trash/files fields is
  verified against the installed SDK 5.24.0 types and the fake only.
- Retry timing uses a fake clock/sleep; in-flight deadlines use real timers with tiny
  injected budgets. The two-slot limiter is per instance only.
- `pnpm build` was not re-run for this task (route handlers type-check under `tsc`).

## Task 4: safe photo/audio validation and local photo preparation

Dependencies (pnpm, exact pins): `sharp@0.34.5` (direct; same version Next already resolved, so no
duplicate native binary) and `mediabunny@1.61.6` (published 2026-10-16). `pnpm install
--frozen-lockfile --offline` is up to date. No other package changed.

### 4.1/4.2 RED

Fixtures: 48 synthetic files, 456,774 bytes, in `tests/fixtures/shoebox/` (provenance, exact
generation script, sizes, SHA-256 and Mediabunny packet timing in its README; the script extracted
from the README reproduces every hash byte-for-byte). The RED run used throwing stubs, so failures
are behavioural assertions, not missing modules. Command:
`pnpm test:unit tests/unit/shoebox/media-validation.test.ts tests/unit/shoebox/photo-processing.test.ts`

`Test Files  2 failed (2)` / `Tests  80 failed (80)`. Representative assertions:

- core gate: `accepts a recorder WebM with no Duration element`: `Error: not implemented` (no
  ValidatedMedia); `rejects an MP4 carrying a video track ...`:
  `expected Error: not implemented to match object { code: 'UNSUPPORTED_MEDIA' }`
- photos: `expected Error: not implemented to match object { code: 'TOO_LARGE' }` (2049 edge,
  2100x2100, dimension bomb)
- worker: `expected Error: not implemented to match object { code: 'UNAVAILABLE', status: 503 }`
- browser photo: `expected Error: not implemented to match object { reason: 'too_many_pixels' }`,
  `{ reason: 'decode', message: '' }`
- rules sync: `expected { audioContainers: {} } to match object { maxFileBytes: 4000000, …(5) }`

### 4.3/4.4 STOP gate: PASSED

Mediabunny 1.61.6 (`Input` + `BufferSource`, formats `[MP4, WEBM, OGG, MP3, WAVE]` only,
`getTracks()`, `EncodedPacketSink.packets()`, no WebCodecs/AudioDecoder/transcode), in Node:

- `audio-webm-opus-2s-no-duration.webm` (`-live 1`: unknown-size Segment/Clusters, Info has no
  `0x4489`): `getDurationFromMetadata() === null`; 101 packets, end of presentation **2.008 s**.
- `audio-fmp4-aac-2s.m4a` (`frag_keyframe+empty_moov`: `mvex`, `mvhd`/`mdhd` duration 0):
  metadata `null`; 95 packets, end **2.021333 s**.
- Hidden video: `getTracks()` lists every track, including codecs it cannot name
  (`hidden-mp4v-audio.mp4` and `hidden-mjpeg-audio.mp4` report `video:null`), and audio-first
  orderings (`hidden-audio-first-video.{mp4,webm}`). All 8 hidden-video fixtures are rejected by
  the exactly-one-audio-track rule.
- AAC priming: `audio-m4a-aac-2s-editlist.m4a` (`elst media_time=1024`) starts at −0.021333 s
  and ends at exactly 2; accepted (pre-roll up to 1 s allowed). `audio-m4a-aac-60s-exact.m4a` ends
  at exactly 60.000000 s and passes; Opus/WebM for a 60 s input ends at 60.008 s (codec delay) and
  would be rejected, so the recorder (Task 8) must stop short of 60 s.

Gaps found in the parser and closed without replacing it (all in `media-inspection.mjs`):

- Truncation is silent: a cut MP4 or fMP4 yields fewer packets and no error. Closed with a
  metadata-only `getNextPacket(last)` probe (the index knows packets whose bytes are missing).
- A cut WebM (known-size or live Cluster) and a cut WAV are also silent: closed with small EBML
  and RIFF framing walks (every element/chunk must end inside the file).
- Cut MP3 with Xing: the declared frame count exceeds the packets. Closed with a
  declared-vs-packets check. MP3 without Xing gets a bitrate *estimate* from Mediabunny (5.02 s for
  the 2.04 s VBR fixture), so that check only applies when a Xing/Info/VBRI header exists.

Mutation probes, each reverted afterwards: removing the EBML walk, the metadata probe, the RIFF
walk, the declared check, the Xing gate, the track-count rule or the worker's `env: {}` each
turns at least one named fixture or test red.

### 4.5/4.6 GREEN

- Focused command above: `Test Files  2 passed (2)` / `Tests  84 passed (84)`, six repeats, output
  clean. Mediabunny logging is silenced inside the worker, and a race in the concurrency test
  itself was fixed with `Promise.allSettled`.
- Full `pnpm test:unit`: `Test Files  11 passed (11)` / `Tests  340 passed (340)`, three repeats.
- `pnpm lint` (8 pre-existing warnings, none new), `pnpm format:check`, `pnpm typecheck`,
  `pnpm knip`, `pnpm depcheck`: all exit 0. `pnpm build`: exit 0.
- Real worker tests: the core gate, all fixtures and `inspectStoredMedia` go through
  `media-worker.mjs`, real Sharp and real Mediabunny. A test-only `tests/helpers/hostile-media-worker.mjs`
  proves the boundary: a third concurrent call gets 503 `media_busy`; abort terminates the thread
  and the slot is freed only after `exit`; a 150 ms deadline rejects with 503 `media_deadline`; heap
  exhaustion hits `resourceLimits` (`ERR_WORKER_OUT_OF_MEMORY`) and returns 503 `media_resources`;
  the worker sees zero environment variables; a worker that cannot start (self-review fix, RED
  first: raw `TypeError` and a leaked slot) returns 503 `media_worker` and frees the slot.

### Build and tracing

- `outputFileTracingIncludes` key `/api/shoebox/memories` (picomatch `contains`, so it also covers
  `/api/shoebox/memories/[id]` and the future `[id]/media`). Its `route.js.nft.json` lists
  `src/features/shoebox/server/media-worker.mjs`, `src/features/shoebox/media-inspection.mjs` and
  mediabunny's `package.json` + `dist/modules/**/*.js` (symlink paths and `.pnpm` real paths;
  252 files). `/api/shoebox/session` is unchanged (105 files, no media files).
- Sharp is not listed per route: `next-server.js.nft.json` (included for every server function)
  already traces `../node_modules/sharp`, `.pnpm/sharp@0.34.5`, `@img/sharp-darwin-arm64/*.node`
  and `@img/sharp-libvips-darwin-arm64`. Adding sharp globs to the route would duplicate or
  conflict with those symlinks.
- Traced-worker smoke test (local only): a temporary `output: "standalone"` build (reverted, then
  rebuilt normally), copied outside the repo to the scratchpad. `media-worker.mjs` started from
  that copy validated the EXIF JPEG (32x64, 505 bytes) and the no-Duration WebM (2.008 s) and fMP4
  (2.021333 s), and rejected `hidden-audio-video.mp4` (`tracks`). The real upload route's
  production smoke is still Task 5/10 (no upload route exists yet), and so is checking the
  Vercel/linux `@img` packages.
- Client bundle: no `.next/static` chunk contains Mediabunny yet (no client component imports
  `audio-preview.ts` until Task 8). Its imports are dynamic only; check the split chunk in Task 8.

### Worker cold-start observation (not a performance certification)

Local macOS arm64, Node 24.21, per worker thread (spawn, module load, one file). The first
photo worker in a fresh process took 733 ms (first libvips load, cold disk). Later runs:
photo 74–113 ms; audio 62–77 ms. Vercel cold start and bundle size are measured later
(Task 10).

### Limitations

- Packet inspection, framing walks and Sharp decode are structural validation, not full audio
  decoding or malware scanning. Browser native decoders remain a trust dependency.
- A live WebM cut exactly on a block boundary cannot be told apart from a shorter valid recording.
- `resourceLimits` bound the worker's JS heap only, not native (libvips) or ArrayBuffer memory.
  Byte/pixel caps and Sharp `timeout({ seconds: 5 })` remain the other controls. There is no
  64 MiB process memory cap.
- Browser photo tests mock canvas/bitmap/image APIs. Real EXIF orientation, HEIC and
  transparency checks on WebKit/Chromium/Firefox and devices are Task 8.
- The JPEG re-encode `> 4,000,000` bytes → TOO_LARGE branch has no fixture (it needs an
  incompressible near-2048² input over 4 MB) and is covered by code review only.

## Review fix round 1 (two Important findings)

### 1. Hidden streams bypassed the one-audio-track rule

Cause: Mediabunny's `getTracks()` omits streams its demuxers cannot model:
- Ogg: only Vorbis/OpusHead logical streams get a track.
- WebM: video TrackEntries without PixelWidth/PixelHeight, or with unsupported ContentEncoding, are dropped.
- MP4: only `vide`/`soun` handlers become tracks.

The reviewer's `av.ogg` (Opus+VP8) was ACCEPTED. It is now `REJECTED UNSUPPORTED_MEDIA ogg_streams`.

Fix (`src/features/shoebox/media-inspection.mjs`): container-level stream counts, in addition to Mediabunny's exactly-one-audio-track rule. Any mismatch is UNSUPPORTED_MEDIA.
- WebM, `walkEbml`: the existing framing walk now descends into `Tracks`. It requires exactly one `TrackEntry`, and that entry must have `TrackType` 2. It also reads `Info/TimestampScale` and the entry's `CodecDelay`.
- Ogg, `walkOgg`: pages must tile the file exactly. There must be exactly one BOS page, and every page must carry that one serial. This also gives Ogg framing/truncation.
- MP4, `walkIsobmff`: top-level boxes must fit. There must be exactly one `moov` containing exactly one `trak`, whose `mdia/hdlr` handler is `soun`. This covers fMP4 too: its `moov` holds the `trak`.
- WAVE and MP3 carry a single stream by construction, so there is no extra count. RIFF framing and the MP3 Xing logic are unchanged.

New fixtures, all rejected. Mediabunny's own view is in brackets:
- `hidden-ogg-opus-vp8.ogg` (sees `audio:opus` only)
- `hidden-ogg-two-opus.ogg` (two Opus tracks)
- `hidden-webm-video-no-pixel-size.webm` (sees `audio:opus` only; a byte edit replaces the PixelWidth/PixelHeight IDs with Void, sizes unchanged)
- `hidden-mp4-text-track.m4a` (sees `audio:aac` only; `hdlr` `soun` + `sbtl`)

### 2. WebM/Opus CodecDelay was ignored

Cause: Mediabunny's Matroska demuxer never applies `CodecDelay` (Ogg pre-skip *is* applied). A true 60 s WebM/Opus file measured 60.008 s and was rejected.

Fix: for WebM, duration = packet end − CodecDelay (read in `walkEbml`; rejected if negative or over 1 s).

Timestamps are quantized, though. ffmpeg's 1 ms TimestampScale shifts by round(6.5) = 7 ms and rounds the last BlockDuration 6.5 → 7 ms, so a true 60 s file still reads 60.0015 s. A WebM-only allowance of min(2 × TimestampScale, 2 ms) is therefore applied, and the reported duration is clamped to ≤ 60. The global `EPSILON` (1e-6) is unchanged; MP4/Ogg/WAV/MP3 get no allowance.

- `audio-webm-opus-60s-no-duration.webm` (true 60 s): packets 60.008 → 60.0015 → accepted, reported as 60.
- `audio-webm-opus-60.01s-no-duration.webm`: 60.018 → 60.0115 → INVALID_INPUT.
- Existing WebM expectations moved from 2.008/59.008 to 2.0015/59.0015 s.

### RED evidence (mutation = pre-fix behaviour restored, one guard at a time, then reverted)

Command: `pnpm test:unit tests/unit/shoebox/media-validation.test.ts`

| Guard removed | Result |
| --- | --- |
| WebM TrackEntry count | `Tests 1 failed \| 77 passed`: `hidden-webm-video-no-pixel-size.webm` |
| `walkOgg` | 1 failed: `hidden-ogg-opus-vp8.ogg` |
| `walkIsobmff` | 1 failed: `hidden-mp4-text-track.m4a` |
| CodecDelay subtraction (old behaviour) | 7 failed: all WebM durations, the 60 s fixture, inspectStoredMedia, browser preview |
| 2-tick quantization allowance | 1 failed: `audio-webm-opus-60s-no-duration.webm` |

### GREEN

- `pnpm test:unit tests/unit/shoebox/media-validation.test.ts tests/unit/shoebox/photo-processing.test.ts`: `Test Files 2 passed (2)` / `Tests 90 passed (90)`.
- `pnpm test:unit`: `Tests 346 passed (346)`, three repeats.
- `pnpm lint` (8 pre-existing warnings), `format:check`, `typecheck`, `knip`, `depcheck` and `pnpm build`: all exit 0.

### Fixtures

- Six new files, 83,424 bytes. Total is now 54 files, 540,198 bytes.
- Generation commands were added to the README script. The script extracted from the README reproduces every hash byte-for-byte.
- The README gains two sections, "Streams hidden from Mediabunny's track list" and "CodecDelay boundary fixtures", with the container evidence.
- New hashes (SHA-256):
  - `hidden-ogg-opus-vp8.ogg`: `75ba6db8a11ff8a84b20cf3c3b1373673cc09b57368ecb2f2229adc0c4fdc806`
  - `hidden-ogg-two-opus.ogg`: `b2ff585535c000640a9e2ac5ad9176a44a4ddf28aa6c6f75b687c299f4db9034`
  - `hidden-webm-video-no-pixel-size.webm`: `acdb9bec96f680d06e685af30fd3b9e7b3f6674f341f5edea49bc7a6a5485f02`
  - `hidden-mp4-text-track.m4a`: `d947c21e31ed11a23fd2e723ce94349e1cd74bfd1166828cf2ea7ca7d460684e`
  - `audio-webm-opus-60s-no-duration.webm`: `bd6282fe48a7be995e4cde8d8f246aeabb29a5718d089cf6bd4308f6deb9f4ce`
  - `audio-webm-opus-60.01s-no-duration.webm`: `9a154af40c29fbc4c050db05f08fa76d53d3227ad7e590598d8d5deb1c8b5f34`

### Remaining concerns after this round

- Concern 1 of the original report (the recorder must stop before 60 s) is resolved for CodecDelay. A WebM recorder clip that is truly 60.0 s now passes. Browser scheduling overshoot is still Task 8's problem.
- The 2 ms WebM quantization allowance is a deliberate container-specific tolerance. Reviewer: please confirm it is acceptable under the "do not widen the global tolerance" ruling.
- `walkIsobmff` counts only `moov/trak`. A malicious fMP4 could still add a `trak` only through an `moov` (counted), so that path is covered. `moof/traf` for unknown track IDs are not cross-checked; Mediabunny ignores those samples.
- The WebM count reads `Tracks` wherever it sits in the Segment, including after Clusters. A file with two `Tracks` elements sums their entries and is rejected.

## Task 5: multipart create, upload lifecycle and uncertain-outcome reconciliation

SDK/API facts checked (installed `@notionhq/client` 5.24.0 `build/src/*.d.ts`, plus developers.notion.com/reference/request-limits):

- `fileUploads.create({mode:"single_part", filename, content_type})` returns `FileUploadObjectResponse` (`status: pending|uploaded|expired|failed`, `expiry_time`). `fileUploads.send({file_upload_id, file:{filename, data: Blob}})` posts multipart form data. `complete` is only needed for `multi_part`, so it is never called.
- `pages.create` `files` property accepts `FileUploadWithOptionalNameRequest` = `{type?:"file_upload", file_upload:{id}, name?}`.
- `HTTPResponseError.additional_data: Record<string, string | string[]>`. Notion documents `additional_data.committed_resource_id` on a 503 for page creation whose change was saved, and `retry_guidance` ("Do not repeat the write"). The gateway keeps the id only if it is UUID-shaped, as a server-only `ShoeboxError.resourceId` that is never logged or serialized.

RED: `pnpm test:unit tests/unit/shoebox/memory-create.test.ts tests/unit/shoebox/request-status.test.ts` against stubs (service methods and handlers throwing `UNAVAILABLE not_implemented`, a 405-only requests route) gave `Tests 65 failed | 5 passed (70)`. Real assertion failures included `expected 'UNAVAILABLE' to be 'OUTCOME_UNKNOWN'`, `expected 503 to be 201`, `expected 'GET, HEAD' to be 'GET, HEAD, POST'` and `expected [] to have a length of 1`. The 5 passes were pre-existing behaviour, for example the offline guard and the stub's 503.

GREEN:
- The focused command gives 72/72 (two later tests were added for the expiry margin).
- Full `pnpm test:unit` gives 13 files, 418/418, twice, with clean output.
- `pnpm lint` reports the 8 pre-existing warnings only; `format:check`, `typecheck`, `knip`, `depcheck` and `pnpm build` all exit 0.
- One RED-run test harness issue was fixed. The 413 test sent a FormData body, and undici's FormData stream source raised an unhandled rejection when the bounded reader cancelled it. That test now uses a byte body.

Mutation probes (each reverted, focused suites):

| Mutation | Result |
| --- | --- |
| Exact stored Request ID re-check removed | 2 failed |
| Reconcile skipped | 6 failed |
| Committed resource id ignored | 1 failed |
| Upload OUTCOME_UNKNOWN passed through | 4 failed |
| Expiry check removed | 1 failed (after adding the margin test; the first version was masked by the budget check) |
| Field comparison removed | 6 failed |
| Ambiguity rule removed | 3 failed |
| In-flight wait removed | 2 failed |

Production build fix (Task 4 file):
- Once a route imported `media-validation.ts`, `pnpm build` failed with 91 "Unknown module type" errors. Turbopack treated `new Worker(<non-literal path>)` as a bundling entry and globbed the project root (AGENTS.md, tests, `vitest.config.mts` -> vite -> lightningcss).
- Tried and still failing: `/* turbopackIgnore: true */` and `/* webpackIgnore: true */` on the Worker argument and on `process.cwd()`, a constant path, and `new (Worker as any)` (TypeScript emits the same `new Worker`).
- Stripping the validator body built, which isolated the constructor.
- Fix: `Reflect.construct(Worker, [workerPath, workerOptions])` with typed `WorkerOptions`. The worker still ships through `outputFileTracingIncludes`.
- The memories route trace has 254 files and includes `media-worker.mjs`, `media-inspection.mjs` and the mediabunny package.

Production smoke (deferred from Task 4):
- Setup: `pnpm build`, then `next start --hostname 127.0.0.1 --port 3117` with synthetic env (`SHOEBOX_APP_ORIGIN=http://127.0.0.1:3117`, the synthetic verifier and secret, `NOTION_API_KEY=test-notion-key`). `NODE_OPTIONS=--import <scratch>/block-net.mjs` refused every non-loopback socket.
- Port 3101 is held by a process I did not start; it was left alone. Only my own server was stopped afterwards.
- Log in through `POST /api/shoebox/session` (200, `__Host-shoebox`), then authenticated same-origin multipart POSTs:

| Request | Result |
| --- | --- |
| photo-exif-orientation-gps.jpg | 503 UNAVAILABLE, ~0.9 s, log `retrieve_database:transport`, guard logged blocked `api.notion.com` x3 (read retries) |
| audio-webm-opus-2s-no-duration.webm | 503 UNAVAILABLE, same path |
| photo-transparent.png | 415 `media_declared_type` (parent pre-check) |
| hidden-ogg-opus-vp8.ogg | 415 `media_ogg_streams` (worker only) |
| audio-webm-opus-61s-no-duration.webm | 422 `media_duration` (worker, packet duration) |
| photo-truncated.jpg | 415 `media_jpeg_decode` (worker, Sharp) |
| photo-edge-2049.jpg, photo-dimension-bomb.jpg | 413 `media_jpeg_dimensions` (worker, Sharp) |
| status GET | 503 (Notion unreachable) |
| anonymous POST | 401 |

- Every response was `private, no-store`. There was no worker, module-load, sharp or mediabunny error in the server log.
- Validation succeeded before any Notion contact: photo and audio reached `retrieve_database`. The worker-only rejections prove the traced worker ran under `next start`.

Limitations: nothing ran against real Notion. The `committed_resource_id` path is tested only with the fake. Cross-instance duplicate creates remain possible by design (no uniqueness constraint).

## Task 6: authenticated bounded media, seeking and privacy-negative tests

Files: `src/features/shoebox/server/{byte-range,media-source,media-handler}.ts`, `src/app/api/shoebox/memories/[id]/media/route.ts`, `privateResponse` added to `server/http.ts`, media constants in `limits.ts`. Tests: `tests/unit/shoebox/{byte-range,media-source,media-handler}.test.ts` and `tests/e2e/shoebox-media-privacy.spec.ts`.

### 6.1-6.3 RED

- Unit: with stub modules (parser and fetcher throwing `UNAVAILABLE not_implemented`, the handler always 503, the allowlist always true), `pnpm test:unit tests/unit/shoebox/media-source.test.ts tests/unit/shoebox/byte-range.test.ts tests/unit/shoebox/media-handler.test.ts` gave `Tests 102 failed | 29 passed (131)`. The failures were real assertions, for example `expected 503 to be 206`, `expected 503 to be 401`, `expected 503 to be 416`, `expected 'UNAVAILABLE' to be 'NOT_FOUND'`, `expected 'not_implemented' to be 'media_link_expired'` and `expected true to be false` (the denied URLs). The 29 passes were cases whose expected outcome matched the stub, for example allowed URLs, 503 mappings and the 405s.
- E2E: the route was wired to an always-503 stub, built with `pnpm build` and run under `next start` on 127.0.0.1:3127 (desktop project). 5 failed and 3 passed. The failures were `Expected: 401 Received: 503` (GET, HEAD and url= without a session), `Expected: 400 Received: 503` (authenticated url=) and `Expected: 404 Received: 503` (invalid id). The 405 and optimizer cases passed because the existing 405 helper and `images.localPatterns` already enforce them.

### 6.4 Implementation notes

- URL policy: https only, default port, no userinfo, and an exact hostname plus path shape:
  - `prod-files-secure.s3.us-west-2.amazonaws.com` with `/<a>/<b>/<file>`
  - `s3.us-west-2.amazonaws.com` with `/secure.notion-static.com/<id>/<file>`
  - `file.notion.so` with `/f/f/<uuid>/<uuid>/<file>` (an observed shape, not a documented one)
  - Every other host, IP literal, suffix or prefix lookalike, region or bucket is refused with 404 `media_host` before fetch is called.
- Fetch: `redirect:"manual"` (3xx and opaqueredirect are refused), `credentials:"omit"`, `cache:"no-store"`, `referrerPolicy:"no-referrer"` and empty headers, so no Authorization, Cookie or Range is sent. The asset deadline is 10 s. Content-Length must be digits and at most 4,000,000. Actual bytes are counted, and the body is cancelled at 4,000,001. A length mismatch and an empty body are both refused. Errors carry only fixed detail tokens.
- Handler order: Fetch Metadata, session, refusal of any query string (400), then a FIFO slot (2 in flight, the worker pool size, and 16 queued, then 503 `media_busy`). After that comes resolve, then the bounded fetch. A 403 re-resolves once and retries once, and the kind and MIME must not change. Next is `inspectStoredMedia` (no re-encoding; a stored-file rejection becomes 503) and the MIME equality check. Only then are the canonical headers built (Content-Type, Content-Length, Accept-Ranges, Content-Range and `inline`) and the single range sliced. The whole request has a 15 s budget, and an abort at any point gives no media response.
- Range: a single `bytes=a-b`, `a-` or `-n`. The end and the suffix are clamped. Everything else gets 416 with `Content-Range: bytes */N`. If-Range always serves the full 200, because no validator is ever issued. Other conditionals are ignored, so there is never a 304, ETag or Last-Modified.
- HEAD uses the same handler with the body dropped, so its size comes from the same validated fetch.

### 6.5 GREEN

- Focused unit suites: 133/133, re-run repeatedly. Full `pnpm test:unit`: 16 files, 555/555.
- `pnpm lint` shows the 8 pre-existing warnings only. `format:check`, `typecheck`, `knip`, `depcheck` and `pnpm build` all exit 0. The build lists `ƒ /api/shoebox/memories/[id]/media`, and its `route.js.nft.json` includes `media-worker.mjs`, `media-inspection.mjs` and the mediabunny package.
- E2E: `next dev` could not start on 3100, because `next dev` refuses a second dev server per directory and PID 41540 (port 3101, not mine) was running. It was left alone. Instead the run used `pnpm build`, then `next start --hostname 127.0.0.1 --port 3127` with synthetic env and `NODE_OPTIONS=--import <scratch>/block-net.mjs`, and `E2E_BASE_URL=http://127.0.0.1:3127 SHOEBOX_E2E_PRODUCTION=1`.
  - `tests/e2e/shoebox-media-privacy.spec.ts` plus `shoebox-auth.spec.ts` passed 38/38.
  - After the RED restore and rebuild, the privacy spec passed 16/16 again. That run's wall time was inflated by a machine pause.
- Production smoke on the final build: HEAD without a cookie gave 401 with a 0-byte body, and GET gave 401 JSON, both private/no-store. The network guard logged zero refused connections, so nothing reached Notion.
- Optimizer: each of these targets returned 400 with and without a session cookie: the media path, the media path with `?url=`, `/images/../api/...`, `/images/%2e%2e/api/...`, `//127.0.0.1:3127/api/...`, `http://127.0.0.1:3127/api/...` and `http://localhost:3127/api/...`. `/images/..%2fapi/...` matches `/images/**`, so the optimizer fetched it internally. That fetch did not reach the media route (no route log line) and failed with "isn't a valid image ... received null", giving 4xx with no image bytes. No response carried `x-nextjs-cache`.
- Mutation probes (each reverted):

| Mutation | Result |
| --- | --- |
| Session check removed | 4 failed |
| Query refusal removed | 1 failed |
| Expired-link refresh removed | 4 failed |
| Refresh on any failure | 1 failed |
| Recursive (unbounded) refresh | 48 failed or timed out |
| MIME mismatch check removed | 1 failed |
| If-Range ignored | 1 failed |
| HEAD body kept | 3 failed |
| Stored rejection passed through as 415/422 | 3 failed |
| Allowlist bypassed | 2 failed |
| `redirect:"follow"` | 2 failed |
| Byte cap off by one | 3 failed |
| Port check removed | 1 failed |
| Userinfo check removed | 2 failed |
| https check removed | 1 failed |
| Bucket path check removed | 2 failed |
| Suffix host match | 3 failed |
| Empty suffix accepted | 2 failed |
| Reversed range accepted | 3 failed |

  The port and bucket probes first survived: their deny cases also failed the path-length rule. Those cases were rewritten so each denial isolates one rule, and then the probes failed as shown.
- One flaky test was fixed. The concurrency tests used real JWT verification, whose completion order varies, so a queued request sometimes took the slot first. Those tests now use an immediate session stub to pin arrival order.

### Limitations and gates

- Authenticated byte serving (200, 206, 416 and HEAD Content-Length) is proven only through `createMediaHandler` unit tests with fake resolve, fetch and inspect. The local server cannot reach Notion, and no test-only route or fixture switch was added.
- **Owner-authorized synthetic live gate:** the upstream allowlist must still be checked against real Notion links (current host and path shapes, 403-on-expiry) on Vercel, together with real range seeking, payload ceilings and CDN headers. If a real host fails the policy, review it explicitly; never relax to arbitrary URLs.
- DNS for the allowlisted public AWS and Notion names is not pinned, so there is no rebinding defense beyond the literal host allowlist.
- Responses are fully buffered and at most 4,000,000 bytes. They do not rely on any Vercel streaming exemption. Every seek repeats the full upstream download and inspection by design.
- Media reads share the two-worker inspection pool with uploads, so a concurrent upload can make a media read answer 503 `media_busy`.
- `images.remotePatterns` still lists the two Notion S3 hosts for the existing birthday gallery. Shoebox signed URLs never reach the browser, but this is a reason to keep them server-only.

### Task 6 fix round 1: optimizer tests made regression-sensitive

- The optimizer e2e block now asserts exact `400` refusal bodies and adds a direct-route observable for `/images/..%2fapi/...` (Next's HTML 404, not the media route's JSON).
- New `tests/unit/shoebox/next-config.test.ts` pins production `localPatterns` to `/images/**` with empty search and keeps shoebox paths out of `remotePatterns`.
- RED, with `{pathname:"/**"}` injected: unit 2 failed / 1 passed. E2E 4 failed / 14 passed (`Expected "\"url\" parameter is not allowed"`, `Received "The requested resource isn't a valid image."`); the optimizer reached the media route internally.
- GREEN, after the restore: e2e privacy and auth 40/40 on `next start`. Unit 558/558. lint (8 pre-existing warnings), typecheck, format and knip are clean.

## Task 7: correction and removal with membership checks

Scope: PATCH (caption, date, and text for text memories) and DELETE (Notion trash) on `/api/shoebox/memories/[id]`. New `correctMemory(id, patch)` and `removeMemory(id)` on the service; new `correct` and `remove` handlers; route Allow is now `GET, HEAD, PATCH, DELETE`.

SDK shapes verified in `@notionhq/client` 5.24.0 (`pages.d.ts`): `UpdatePageParameters` = `{ page_id } & { properties?, in_trash?: boolean, archived? (deprecated), is_archived?, ... }`. Only `properties` (`Caption`, `Memory date`, `Text`) and `in_trash` are ever sent.

### RED (tests/unit/shoebox/memory-mutations.test.ts, 34 tests)

Run against do-nothing stubs (service returned the unchanged record and wrote nothing; handlers returned an empty 204; the route still answered 405). Result: 32 failed / 2 passed. Real failures, for example `expected [] to have a length of 1 but got +0` (no update call recorded), `expected { ...(8) } to match object { caption: 'nuevo pie', ... }` (caption not changed), and `expected a rejection` for every validation, 404, 403 and unknown-outcome case.

### GREEN

- `pnpm test:unit tests/unit/shoebox/memory-mutations.test.ts`: 34/34.
- Full `pnpm test:unit`: 18 files, 592/592 (558 before plus 34 new).
- `pnpm lint`: clean apart from the 8 existing warnings. `pnpm typecheck` and `pnpm knip`: clean.
- `memory-reads.test.ts` (Task 3) was updated for the new contract: detail route Allow is now `GET, HEAD, PATCH, DELETE`, and its service stub gained the two new methods.

### Mutation probes (each reverted)

| Mutation | Result |
| --- | --- |
| Already-trashed idempotent return removed | 2 failed |
| Membership check before trash removed | 2 failed |
| Text sent for media memories | 1 failed |
| Unknown outcome trusted as success without re-read confirmation (DELETE) | 2 failed |
| Unknown outcome on PATCH returned the re-read without comparing values | 2 failed |

### Limitations and gates

- Tested only against the offline fake. The behavior of real Notion for editing a trashed page (assumed 400), for retrieving a trashed page (assumed returned with `in_trash: true`) and for `in_trash` idempotence needs the owner-authorized live gate.
- Last confirmed write wins. There is no optimistic locking or version check.
- Restore notes (for the Task 10 runbook): a removed memory is only in Notion's trash. It can be restored from Notion (page menu, Trash) within Notion's retention window, or exported manually before then. The app has no restore endpoint and no permanent-erasure promise. Limitation on retained files: the uploaded file stays attached to the trashed page and in Notion's storage until Notion purges the trash; trashing does not shorten that, and previously issued signed file URLs may keep working until they expire.

## Task 8: phone composer, local previews and the voice-recording lifecycle

Scope:
- Client `api.ts` (`shoeboxFetch`, `saveMemory`, `checkRequest`), `recorder.ts` (`createVoiceRecorder`, browser deps) and `useVoiceRecorder.ts`.
- Components `MemoryComposer.tsx` and `VoiceRecorder.tsx`, plus the minimal `ShoeboxArchive.tsx` host. The host now has an add button, composer, a saved status, and an expiry the server confirms.
- No new dependencies and no product test route.
- Servers:
  - Own `next dev` on 127.0.0.1:3123 and own `next start` on 127.0.0.1:3124, both with synthetic env and a matching `SHOEBOX_APP_ORIGIN`.
  - 3100/3101 belonged to other processes and were not touched.
  - Both of my servers were stopped afterwards.

### RED

- **Unit, first run.** `pnpm test:unit tests/unit/shoebox/recorder.test.ts tests/unit/shoebox/client-api.test.ts`: missing-module failure. This is the allowed first RED.
- **Unit, against stubs.** The stubs had the final interfaces and no behavior. Result: `Tests 49 failed (49)`, all real assertions. For example:
  - `expected 'idle' to be 'recording'`
  - `expected "vi.fn()" to be called once, but got 0 times`
  - `NotAllowedError: expected false to be 'denied'`
  - `expected { kind: 'failed', …(1) } to deeply equal { kind: 'saved', …(2) }`
  - `expected 'failed' to be 'uncertain'`
  - `expected SyntaxError: Unexpected token 'R', "Reque… to be an instance of ShoeboxApiError` (non-JSON 413)
  - `expected [Function] to throw error matching /no permitida|not allowed/i but got 'unexpected fetch https://evil.test/…'`
- **UI, before the composer existed.** `E2E_BASE_URL=http://127.0.0.1:3123 pnpm exec playwright test tests/e2e/shoebox-compose.spec.ts tests/e2e/shoebox-recording.spec.ts tests/e2e/shoebox-photo-processing.spec.ts --project=phone`: 28 failed. The add button was missing.
- **Carried expiry finding.** The clock-ahead test reproduced the redirect loop. Its call log showed `7 × waiting for "/shoebox/login" navigation … navigated to "/shoebox"` within 5 s.
- **Bugs found while turning tests GREEN:**
  - The double-tap test proved a real bug. The status row was rendered above Save and pushed it down, so the second tap landed on "Cancelar envío" and cancelled the upload. Fix: the status/actions row is now below Save.
  - The confirmed-expiry test failed on `next start` 3/3 (`Received: "/shoebox"`). The cause was a race: the host read `composerOpen` through a ref updated in a passive effect, so a 401 just after a save still saw the composer as open. Fix: a 401 always marks the session invalid, and one effect redirects whenever the session is invalid and no composer is open. After the fix: 5/5 repeats pass on `next start`.

### GREEN

| Command | Result |
| --- | --- |
| `pnpm test:unit` | 20 files, 644/644 (595 before + 23 client-api + 26 recorder) |
| Named specs + auth + media privacy on `next dev` :3123, `--workers=2`, phone + desktop | 96/96 |
| Same set on `next start` :3124 with `SHOEBOX_E2E_PRODUCTION=1` | 96/96 |
| `pnpm lint` | 8 pre-existing warnings, no errors |
| `pnpm format:check`, `pnpm typecheck`, `pnpm knip`, `pnpm depcheck` | Clean / exit 0 |
| `pnpm build` | Success |

The last two small edits (a comment, and focus after inline reauth) were re-verified on `next dev`: 56/56 for the three named specs, 644/644 unit, and lint, knip, format and build all clean.

### Limitations and gates

- Chromium's fake microphone (`--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`, set per spec in `shoebox-recording.spec.ts`) proves wiring and lifecycle only. It is not evidence of real phone recording or cross-device playback.
  - The MP4/AAC-vs-WebM choice, Safari/iOS pauses, Android screen lock and the real format probes stay Task 10 device gates.
- Photo orientation, large-image decode, HEIC refusal and URL disposal are proven in Chromium only.
- The browser 40 MP ceiling is exercised with the dimension-bomb fixture (its header claims 60000x60000). `photo-excessive-pixels.jpg` is 2100x2100 and exceeds only the server cap.
- With Playwright's default parallelism, a login occasionally answered 503 (scrypt verification busy) on the dev server. The runs above used `--workers=2`. This is a property of the bounded login verifier, not of Task 8 code.
- The reload warning is a best-effort `beforeunload`; mobile browsers may not show it.

## Task 9: resumed archive/session verification, scene and mutation UI

Full resumption report: `.superpowers/sdd/2026-10-21-private-shoebox/task-9-opencode-report.md`.

**Correction to the introductory offline claim for this task:** the first Task 9 development-server run used only fixed fake credentials but lacked a process-level outbound guard. Unmocked initial archive reads in older composer fixtures reached Notion and received invalid-token 401s. No real credentials or private records were used. Stopped that owned server/runner and repeated verification using a scratch Node preload blocking non-loopback fetches and sockets in the actual Next subprocess. The final guarded log contains 617 blocked external fetch attempts and no invalid-token API replies. Task 10 must make server-process isolation part of its reproducible runner. The full incident and containment evidence are in the report; do not claim all Task 9 runs were offline.

### Test-first changes

- Singleton date correction at a cursor boundary: unit expected three requests, got two; browser reproduced twice. Reload on any date change and use heading fallback when the opener leaves the batch.
- Held PATCH finishing after expiry/reauth: both projects displayed obsolete text. Added authority epochs; counter-test proved a valid visibility recheck must not invalidate the same session's pending write (first guard stranded the dialog, fixed before GREEN).
- Hidden-tab saved excerpt/detail action: both projects still showed private feedback. It now uses the synchronous private gate.
- Paused scene: running button transition remained; scoped pause now disables transitions too.
- Failed detail audio: missing error status; now explicit while retaining caption/date.
- Opening composer: archive audio kept playing; dialog open now pauses it.
- Reduced-motion capture: notice over artwork; behavioral background test failed twice, then passed with an opaque theme-aware reading surface.

### Final GREEN

| Command | Result |
| --- | --- |
| `pnpm test:unit` | 21 files, **662/662** |
| `E2E_BASE_URL=http://127.0.0.1:3149 SHOEBOX_CAPTURE_DIR=<approved scratch>/task9-captures pnpm test:e2e --workers=2 --output=<approved scratch>/task9-green-e2e` | **432/432**, 10.8m, no retries/skips; all existing and shoebox suites |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0, only original 8 warnings |

Earlier whole-suite outcomes are retained in the report: 430/430 before the final visual test; an expanded run with one lazy-image fixture race and one unchanged phone fish-animation timing failure; 8/8 focused recovery; finally the full 432/432 above. Media failures are configured before navigation, not after a first render/reload, so the bounded-retry and actual 503-recovery assertions are deterministic without weakening their caps.

Twelve synthetic scratch captures cover phone/desktop, day/night, normal/reduced, intermediate reaction frames and native controls. Inspected the captures and corrected feedback readability. Tests compare real target geometry/animation frames, hit-test controls, enforce 44px targets and reflow, exercise inherited/native-dialog/hidden pause, and prove cleanup on home navigation. No production memories were seeded. Strict production/multi-engine/physical-device/deployment/runbook gates remain Task 10 or owner-only work.

## Task 10: reproducible offline production and launch gates

Full implementation/harness report:
`.superpowers/sdd/2026-10-21-private-shoebox/task-10-opencode-report.md`.
Owner setup and complete deferred-ledger risk register: `docs/shoebox-setup.md`.

### Test-first / intermediate results (not hidden by the final outcome)

- Raw SDK logger RED reproduced synthetic private upstream text/URL in `warn`.
  Shoebox SDK now has a no-op logger; normal sanitized app diagnostics remain.
- Guard child starts only after verifying its preload sentinel; missing-preload
  RED made no network request. GREEN proves non-loopback fetch/TCP/TLS rejection,
  loopback success, blocked local-to-external redirect and grandchild inheritance.
  Dotenv-refusal test uses only a newly generated synthetic scratch file.
- New canary test detects a synthetic value in fabricated static output and emits
  only variable names/file paths; implementation follows its initial missing-file
  RED (not falsely described as a behavioral RED).
- First strict production run46/48: two assertions were too exact for Next404's
  stronger `private,no-cache,no-store,max-age=0,must-revalidate`. Pinned that exact
  policy for404 separately without weakening authenticated API/page requirements.
- Preloading Node web globals before Vitest isolation reproducibly hung its
  inherited Request-abort test (664/665); ordinary isolated test24/24 and real
  preloaded Node signal probe passed. Unit checks retain existing in-context
  safe-env guards; actual Next build/dev/start and descendants always preload.
- Initial full Chromium440 passed/2 existing opt-in capture skips,9.1m;
  original check exit0 with8 inherited warnings; strict production48/48.
- First separate-engine18/20: required Firefox/WebKit binaries missing. Installed
  only the approved public test binaries (Firefox1555/WebKit2370); test gates
  themselves remain offline. Next result19/20: WebKit rejects Secure cookies over
  plain HTTP loopback. Added test-only local HTTPS proxy/certificate, not weaker
  cookies. Next result19/20: Safari pointer click doesn't focus an opener; native
  keyboard restoration test now opens with focus+Enter. No Task9 UI change.
- Expanded strict production50/50 and four-project24/24 then passed. Packaging
  assertion initially looked for Sharp in the route trace; corrected it to check
  the shared Next server trace plus native addon, consistent with Task4 evidence.
- One intermediate expanded-test build failed test-only header-union typing;
  fixed. One check stopped at Knip's system `openssl` binary; narrow exception
  added, no broad exclusions. New Knip roots no longer treat the entire feature
  or domain type file as an entry.
- Subsequent aggregate666/666 and unchanged original check passed, but a new
  foreign Next dev server PID79956 occupied this worktree's default dev directory
  (port3100). It was not reused/killed. Runner now opts into its own fixed
  `.next/shoebox-check` output; default application output remains `.next`.

### Final evidence

| Final command/gate | Actual result |
| --- | --- |
| `pnpm check:shoebox unit` | exit0, **666/666**,24 files |
| Original `pnpm check`, executed inside isolated synthetic runner | exit0: lint/format/typecheck/Knip/dependency check/build; original8 warnings only |
| Latest full `pnpm check:shoebox` | **exit1**, **442/444**,12.5m; no skips/retries; two unchanged baseline phone timeouts |
| Guarded focused birthday/fish rerun, both projects, workers2 | exit0, **4/4**,44.1s; does not erase aggregate failure |
| Final production-only runner, own HTTPS3158 / Next3157 | exit0: build, **50/50** strict production and **24/24** separate-engine tests |
| Final client/static/generic-login/auth HTML/RSC canaries + production traces/workers | exit0, no canary hits; traced JPEG/metadata-less WebM/fMP4 smoke passed |
| Owned server log audit | actual Next blocked-transport marker present; raw SDK warnings0; invalid-token API replies0 |
| `lsof -nP -iTCP:3157 -iTCP:3158 -sTCP:LISTEN` | no listeners; expected exit1 |
| Final standalone lint/typecheck/Knip and `git diff --check` | all exit0; lint retains8 original warnings |

Aggregate failures: phone `birthday.spec.ts:418` example-fallback visibility30s
timeout (expected text present in final snapshot) and phone
`fish-delivery.spec.ts:208` natural evidence60s timeout during final reduced-motion
navigation. No unrelated baseline/UI/test/timeout change or automatic retry.
The four-case focused rerun passed; underlying timing cause is not proven.

Immutable full-run log:
`/Users/mtm/.local/share/opencode/shell/bc1d6b661880b13cf0d9382886b8174785ac8f4a/sh_163d3061e001aXMGA5v3PShG3h.out`.
Focused log: `.../sh_163dfc6b3001pdzsFp0zzv9jeW.out` in the same shell directory.
Final production log: `.../sh_163e136150015u4gD197eSs7uC.out`.
Final production gate JSON/server log are retained separately under approved
scratch `opencode/shoebox-task10-final-production/`, all four gate exits0.

Twelve new synthetic scene captures under `opencode/shoebox-task10/captures/`;
re-inspected phone day/reduced, desktop night/normal and phone native controls.
No Task9 UI edits. Physical device, OS accessibility, live synthetic Notion and
deployed Vercel/cache/WAF checks remain owner-only; the full aggregate regression
failure remains a handoff concern. No production-readiness claim or deployment.
