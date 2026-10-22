# Private shoebox: owner setup and launch gates

Local synthetic checks are not deployment authorization or a privacy certification.
Do not expose this feature until every owner gate below is checked. No live
Notion/Vercel/device checks were performed by the implementation agent.

## 1. Private Notion setup (owner only)

1. Confirm the Free workspace still has **one member**. The second website user
   needs no Notion account. A later multi-member workspace may incur the lifetime
   block limit; do not retry blocked writes indefinitely.
2. Create a full-page **Memories** database under a private page. Never publish it
   or share it to web. Do not reuse the birthday database.
3. Set these exact names/types (no templates, formulas, child blocks or extra
   author/status/URL properties):

| Name | Type |
| --- | --- |
| Name | title; generated generic label |
| Kind | select: `photo`, `audio`, `text` |
| Memory date | date, date-only |
| Caption / Text / Request ID | rich_text (three separate properties) |
| Media | files; exactly one Notion-hosted file for media, none for text |
| Width / Height / Duration | number (three separate properties) |

Notion supplies `created_time` and `in_trash`. Connect the existing integration
with read/insert/update content permissions, only to this database. Verify one
uniquely matching data source and property types. Ambiguity fails closed; select
option configuration is not fully verified automatically.

## 2. Secrets and origin (owner only)

Use a trusted secret UI/password manager. Do not put plaintext passwords, hashes,
tokens or signing keys in command arguments, shell history, screenshots, chat,
logs, source control or `NEXT_PUBLIC_` variables. The agent must not generate,
read or print real secrets. Environment names:

- `NOTION_API_KEY` (existing server integration)
- `SHOEBOX_NOTION_DB_ID` (dedicated database)
- `SHOEBOX_PASSWORD_HASH`
- `SHOEBOX_SESSION_SECRET`
- `SHOEBOX_APP_ORIGIN` (one exact origin; no path/wildcard)

Create a genuinely high-entropy shared password in the owner’s password manager.
Use a vetted **local hidden-input** procedure to derive a verifier: fresh random
salt of at least 16 bytes, scrypt `N=32768`, `r=8`, `p=1`, `maxmem=64 MiB`,
64-byte derived key. Store `scrypt-v1$<base64url salt>$<base64url key>` directly
through the trusted secret UI, without stdout/history. No trimming or Unicode
normalization; password maximum is 1,024 UTF-8 bytes. Independently generate at
least 32 random bytes for the base64url signing secret. Never derive it from the
password or reuse integration tokens. Preview/production use distinct secrets,
databases and exact origins; no automatic preview-origin wildcard.

### Owner-only setup helper

Run `pnpm shoebox:setup` yourself in an interactive local terminal. It asks for
the password twice without echo, derives the verifier with the server's shared
scrypt parameters, generates an independent 32-byte session secret, and writes
only `SHOEBOX_PASSWORD_HASH` and `SHOEBOX_SESSION_SECRET`. It never prints values.
It does not set the Notion keys/database or origin; configure those separately.
The default destination is `.env.local`; `--file <path>` selects another file.
Existing keys are refused unless you explicitly pass `--force` to rotate them.
Unrelated lines are preserved; output files have owner-only permissions. Back up
configuration in your password manager before intentionally rotating keys.

**Next dotenv escaping:** Next expands `$` even inside single-quoted values.
In local env files, the separators in the verifier must be escaped as `\$`:
`scrypt-v1\$<salt>\$<key>`. The helper writes this escaping automatically.
In **Vercel's environment UI or `vercel env add`**, paste the original value
**without backslashes**. Do not copy the escaped local representation verbatim.

`pnpm shoebox:setup --vercel` writes raw, unescaped values to the separate
`.env.shoebox.vercel` file beside the selected target, never to `.env.local`.
The existing `.env*` ignore rule covers that file. Paste its values directly
into Vercel without displaying them in chat/logs, then securely remove the file.
Both modes generate fresh keys; use the same password deliberately if desired,
but keep preview and production signing secrets distinct. Never pass passwords
as arguments, pipe input, or let an agent run this against real configuration.

If authentication configuration is missing, both shoebox pages display a generic
Spanish not-ready notice without variable names. Login API `SETUP_REQUIRED`
responses also have distinct fixed copy. Schema diagnostics name only the first
failing property in server logs (`schema:Memory date`, for example), never in
the HTTP error body. Do not publish these logs.

Precautionary integration-token rotation is recommended before expanding access:
the former Next `env` declaration was unsafe, but no deployed leak was established.
Owner rotates and updates dependent configuration, then verifies existing quality
and birthday behavior separately. No birthday schema/security redesign is included.

Sessions expire absolutely after seven days, without refresh. Production cookie
is `__Host-shoebox`, Secure/HttpOnly/SameSite=Strict, Path=/, no Domain. Only local
development can use the separately named non-Secure cookie. Logout clears this
browser only, not a stolen copy. **Rotate session secret as well as password** on
compromise/password change to invalidate all sessions. No per-person revocation,
attribution, edit history or E2EE: Vercel, Notion, workspace owner and holders of
passwords/cookies/exports are in the trust boundary. Downloaded bytes cannot be
recalled. Access logs may retain paths/IDs/IPs; never put private text in URLs.

## 3. Mandatory owner-authorized synthetic launch checks

Use a disposable private synthetic database/preview first, never personal media.

- **WAF blocker:** confirm available Hobby rule capacity; enforce normalized exact
  `POST /api/shoebox/session`, five requests/60s/source IP, actual 429 (not log-only).
  Test slash/case/encoded aliases after hosting normalization; deny aliases or
  canonicalize before verification. Preserve existing rules. Regional fixed windows
  and distributed IP guessing remain; the two-job scrypt cap is not durable rate
  limiting. Without verified WAF do not launch.
- **Notion lifecycle:** create upload/send/attach/read/correct/trash; integration
  permissions; expiry and link refresh; observed attachment host/path against the
  exact allowlist. Never broaden to wildcard hosts on failure. Test real
  `committed_resource_id` guidance and trash/restore behavior, currently fake-tested.
- **Vercel payload/worker:** 4,000,000-byte file and allowed metadata fit; file +1
  and total multipart 4,200,001 reject. Platform non-JSON 413/504 must be readable.
  Confirm actual function trace/module/native Sharp/worker behavior, 60s maxDuration,
  read15s/write45s budgets and finite failure under resource exhaustion. Streaming
  is not a payload-limit exemption. Worker64MiB is JS heap, not total/native memory.
- **Privacy at the edge:** HTML/redirect/RSC/prefetch/API/errors/method failures,
  GET/HEAD/range and both cold/post-auth optimizer requests have correct no-store
  behavior; no logged-out bytes, signed URLs, cross-session CDN reuse, CORS or
  framing bypass. Authed200/206 lengths and seeking below4.5MB, cancellation and
  expired-link refresh. Local tests cannot certify the hosting chain.
- **Physical iPhone Safari and Android Chrome:** actual permission denied/granted,
  busy/absent mic, native indicator off after stop/cancel/hide/route/logout, delayed
  permission cleanup, call/lock/suspension/final-chunk limits, no auto-resume/upload.
  Probe permitted codecs; cross-play saved Android audio on iPhone and vice versa.
  59.5s stop target leaves encoder headroom; final bytes/duration still decide.
  Scheduling cannot guarantee exactly60s capture while OS-suspended. Unsupported
  capture/playback must offer upload/text, not relabel/transcode/skip validation.
- **Photo/device/accessibility:** camera/library HEIC handling or clear JPEG fallback,
  orientation/GPS stripping, transparency, huge decode failure without losing draft;
  native audio controls, keyboard Tab/Escape/focus return, OS screen reader labels
  and status,200%zoom/320px reflow, safe-area keyboard sheet scrolling, live reduced
  motion and global scenery pause. Optional caption is not a transcript or a claim
  of complete WCAG audio alternatives. Playwright WebKit is not physical Safari.
- **Recovery:** manually export/back up in Notion; test restore, unknown creates and
  rare duplicate cleanup; verify rotation invalidates old sessions. Do not promise
  permanent deletion of Notion media, backups, cached links or downloaded copies.

## 4. Save/recovery and retention

Never infer failure from an interrupted request or missing status result. Preserve
the same Request ID and unchanged draft, check read-only status, and inspect Notion
before an explicit retry/new draft. No automatic duplicate deletion. Notion has no
transactional uniqueness constraint: cross-instance simultaneous creates can
duplicate. Original media identity is not provable from replay metadata. A trashed
same-ID record is not found by reconciliation and may be recreated. An upload
that never attaches expires automatically after about one hour; no immediate
file-delete API is promised. Removal trashes the page; owner restores/exports in
Notion, not through an in-app trash view. Corrections are last-confirmed-write-wins,
not optimistic locking or snapshot isolation. Pagination can shift; refresh.

Drafts exist only in the open tab; no storage/offline recovery. Unload warnings
are best effort. Cancellation is not rollback. Session expiry clears private
archive/media, but inline reauth may retain an in-tab draft until logout/discard.

## 5. Ledger residual-risk register (Tasks 1–9)

This explicitly carries the reviewed/deferred ledger forward; it does not silently
declare earlier minors fixed. Final review should triage product issues before
launch, especially the uncertain-create client cases.

| Ledger | Residual / operational consequence |
| --- | --- |
| T1 tests | Some assertions check only thrown errors, not400/422; timezone test is vacuous; non-multipart415 was unstated. Env restore may set literal `undefined`; non-spied safe error tests print diagnostics. Review coverage, not a privacy guarantee. Broad Knip feature entries are removed in T10. |
| T2 | Config-before-origin login can distinguish503/403; empty/oversized password skips scrypt (length-class timing); one older hash-canary assertion is vacuous. Strict prod headers are mandatory T10 gates, not dev claims. Clock-skew and private-marker followups were handled in T8/9 per reports. |
| T3 mapping/tests | Final hardening rejects missing parent.database_id as non-membership without throwing. Setup errors now name the first failing property in server logs only. Invalid cursor400/Retry-After HTTP-date/injected-clock test gaps remain. JSON HEAD runs full upstream query; select options not comprehensively verified. |
| T3 resource bounds | Deadline races do not necessarily cancel SDK requests; actual in-flight network concurrency can exceed two, cold schema/list can approach45s, shared singleton has no test-reset hook and may be per deployed function. No global concurrency/rate-limit promise. |
| T4 parser coverage | No dedicated backwards/nonfinite timestamp/100k-packet/pre-roll<-1s or >4MB normalized-JPEG-output fixture. Container framing checks are not full decode/malware scanning; page/frame-boundary truncation of Ogg/non-Xing MP3 can be undetectable; duration uses maxEnd not span. |
| T4 edge parsing | CodecDelay applies beyond Opus and up to1s; Ogg pre-skip has similar exposure. WebM quantization allowance<=2ms is clamped to60s. >6-byte zero-padded EBML uints reject; repeated Info uses last TimestampScale; trailing bytes after fixed Segment unchecked; SeekHead-located Tracks/Tracks ordering not fully supported; Ogg CRC and moof/traf IDs not checked. Existing EBML EOF commentary overstates its guarantee. Do not call parser validation adversarial-proof. |
| T4 resources | Worker/native allocations are not process64MiB capped; crafted-input deadline/OOM returns503, never auto-retry a save. postMessage-throw slot retention is deferred. Trace includes parser in detail route too; cold-start is not performance-certified. |
| T5 writes | Pre-service multipart/validation/queue time not in write budget; context reads lack caller abort. Post-create retrieve failure can show202 for an actual success;529 retry assumes no commit. `committed_resource_id` and trash replay behavior require authorized live synthetic validation. Final hardening makes unexpected non-ShoeboxError waiter rejection OUTCOME_UNKNOWN with no second write; this is not strict exactly-once.409 still needs a status check to distinguish mismatch/multiple matches. |
| T6 media | Resolve not cancellable by15s budget; slot may release before buffered response consumed (memory bound overstated). Final hardening sends Accept-Encoding:identity;416 still lacks Accept-Ranges. Seek re-downloads whole file; shared2-worker upload/read pool can return503 busy. Exact host allowlist needs owner validation; no DNS pinning. Authenticated bytes primarily handler-factory tests, not live Notion evidence. |
| T6 tests | Optimizer assertions couple to preview Next error strings. Encoded traversal proof relies on same-router behavior. Earlier default-dev run blocked by foreign servers; T10 reruns owned server without killing others. |
| T7 | Trash behavior fake-only; successful update lacking in_trash may return202 without reread. Final hardening rejects whitespace-only notes on create and correction. PATCH parses before membership (no write); last-write-wins has no conflict signal. |
| T8 priority review |Resolved in reviewed Task9 fixes: uncertain409 remains uncertain, conflicts disable same-ID Save, ambiguous state has a status check, and possiblyInFlight preserves uncertainty after a later503. Continue to inspect status/Notion rather than assume an interrupted save failed. |
| T8 UI/device | Hidden-page late permission needs review; interruption text always blames screen-off; photo picker focus-within ring and native audio file input44px not fully pinned. Only fake mic evidence; max2 browser workers avoids scrypt contention. Composer split/host401 followups handled T9; no real-device certification. |
| T9 | Synthetic routed two-client store proves UI behavior, not Notion transaction isolation. Historical home/calendar hydration diagnostics under synthetic clocks and fish animation timing flake remain. Visual/manual accessibility evidence is local only. Task9 review/fix rounds completed; final scoped review found no Critical/Important issues. The latest setup polish still requires a fresh full browser aggregate. |
| T9 network incident -> T10 | Fake env alone allowed rejected invalid-key Notion calls in the original T9 run. Final T9 rerun used a scratch preload; T10 commits no artifact but supplies a reproducible tracked test preload in the actual Next process and descendants, plus disabled shoebox SDK raw logger. No real credential/data exposure was found in that incident. |

## 6. Reproduce local synthetic checks

`pnpm check:shoebox` runs units, the **unchanged** original `pnpm check` chain,
full original Chromium phone/desktop E2E on its owned dev server, then strict
`SHOEBOX_E2E_PRODUCTION=1` privacy/auth/media, a separate four-project
compatibility config and client/static/HTML/RSC canaries plus traced worker smoke
against its owned production server. Max two browser workers total, sequential
runners; failure exits nonzero, no retries or suppressed genuine failures.

Optional `pnpm check:shoebox production` rebuilds then runs production gates;
`pnpm check:shoebox unit` runs only units. `SHOEBOX_CHECK_PORT` chooses an unused
loopback port (default3157); `SHOEBOX_CHECK_OUTPUT` chooses scratch evidence output.
Strict production browsers use HTTPS on the next port (default3158), terminated
by an owned test-only proxy to the owned Next server. A disposable one-day local
test certificate/key is generated with OpenSSL in scratch, never a production
secret or a committed certificate. Only those test browser contexts ignore its
self-signed trust error; Secure cookie flags remain unchanged. Both occupied ports
fail closed; both owned processes are stopped. Production canary HTML/RSC reads use
the guarded internal loopback server with an explicitly supplied synthetic cookie.
Local OpenSSL must be available for this test transport; Knip exempts that exact
system binary only, not a broad script/dependency exclusion.
The runner also opts into fixed `.next/shoebox-check` output, isolating builds and
dev locks from another session's default `.next` server. The normal app default
is unchanged. Next's corresponding generated-type include paths are retained in
`tsconfig.json`. Do not run two copies of this check runner concurrently.
Do not point E2E at deployed services. The runner refuses every `.env*` runtime
file by name without reading contents; `.env.local.example` is documentation only.
Use a clean local worktree later if personal env files are present.
`pnpm check:shoebox chromium <spec paths> --grep <pattern>` is an optional guarded
focused diagnostic rerun, still two workers. It does not replace or turn a failed
full aggregate into a pass. The latest full run had two unchanged baseline
timeouts (birthday fallback/fish evidence); see verification notes for exact
counts and the separate successful focused rerun.

The runner allowlists parent env, supplies fixed fake credentials and injects
`scripts/shoebox-offline.cjs` using NODE_OPTIONS into Next and descendants. Fetch,
TCP/TLS and hostname lookup reject external destinations before connecting;
loopback/Unix sockets remain usable. Default browser contexts fail external
traffic via a dead loopback proxy, service workers disabled. Existing baseline
tests that manually construct browser contexts still depend on their synthetic
route fixtures; these context options are not an OS firewall. The actual Next
process guard is independent of browser routing. This is a test transport backstop, **not
an OS network sandbox for hostile native code or arbitrary child executables**.
No runtime mock/bypass route or upstream fallback is added. Only owned Next child
is stopped; occupied ports fail rather than reusing/killing another process.
Do not run a second browser runner concurrently. Engine installs, if required,
are package downloads, not authorization to contact personal APIs.

Vitest uses its existing per-context `tests/helpers/safe-env.ts` transport guards,
not a Node preload: applying the preload before Vitest's isolated web globals
reproducibly hung its mid-read Request-abort test, while the same real Node probe
and ordinary isolated unit run passed. No test was skipped or timeout enlarged.
The dedicated guard unit test launches real preloaded child/grandchild Node
processes. All Next build/dev/start subprocesses retain the preload.

### Production media worker packaging

The worker must ship with **its own** Sharp version, native `@img` libraries,
and installed transitive/optional dependencies. Do not rely on Next's Sharp:
after the Next16.4.2 upgrade it was0.35.5 while the worker still used0.34.5.
That mismatch caused production media503s even though source-tree tests passed.
`scripts/shoebox-sharp-includes.mjs` resolves the worker's actual installation
and supplies narrow dependency includes to all three memory-route traces.

`worker-packaging.test.ts` runs JPEG/WebM/fMP4 workers from isolated copies of
the configured deployment files, with empty environments and relocated symlinks.
It also proves that omitting native libraries fails rather than falling back to
local packages. CI runs these units on Linux. The full production check copies
the **actual emitted NFT files**, separately for upload/detail/media routes,
before running the same smoke test. Source-tree worker execution alone is not
packaging verification. Confirm real photo/audio serving after an authorized
redeploy; no private memories need to be removed or re-uploaded for this fix.

## 7. Pinned local package versions and sources

Observed locally2026-10-22: Next16.3.0-preview.6 MIT; @notionhq/client5.24.0 MIT;
jose6.2.12 MIT; sharp0.34.5 Apache-2.0; mediabunny1.61.6 MPL-2.0;
server-only0.0.1 MIT; Vitest5.0.5 MIT; Playwright1.64.1 Apache-2.0. Keep lockfile;
preview Next upgrades can change headers, image-refusal strings and packaging.
No dependency source copied/modified. Check applicable license obligations when
redistributing, particularly Mediabunny MPL-2.0 and Sharp native components.

Official references carried from approved design (not live rechecked offline):

- https://developers.notion.com/docs/working-with-files-and-media
- https://developers.notion.com/docs/uploading-small-files
- https://developers.notion.com/reference/file-object
- https://developers.notion.com/reference/workspace-block-limits
- https://developers.notion.com/reference/request-limits
- https://developers.notion.com/reference/intro#pagination
- https://vercel.com/docs/functions/limitations
- https://vercel.com/docs/functions/streaming-functions
- https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/dataavailable_event
- https://webkit.org/blog/16574/webkit-features-in-safari-18-4/
- https://mediabunny.dev/guide/reading-media-files
- https://mediabunny.dev/guide/supported-formats-and-codecs
- https://sharp.pixelplumbing.com/api-constructor/
- https://github.com/panva/jose/tree/main/docs

Verification evidence and unresolved automated failures:
`docs/superpowers/plans/2026-10-21-private-shoebox-verification.md` and
`.superpowers/sdd/2026-10-21-private-shoebox/task-10-opencode-report.md`.
