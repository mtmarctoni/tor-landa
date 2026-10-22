# Private shoebox: approved design

Date: 2026-10-21
Status: APPROVED by the user in this session on 2026-10-21 (“approve and write the implementation plan”). Approval authorizes planning, not implementation.

## Workflow and safety checklist

- [x] Verify the existing worktree, branch, and status before exploration and again before writing.
- [x] Read project instructions, current redesign, reference mockup, architecture, and prior verification.
- [x] Recheck relevant official platform documentation and matching installed Next.js documentation.
- [x] Resolve the material correction/removal decision and workspace membership.
- [x] Write the design, separating established decisions from recommendations.
- [x] Fresh builder-check review; reviewer reported “nothing important left”.
- [x] User approves this complete design.
- [x] Only then load writing-plans and write/review the test-first implementation plan.
- [ ] Present the plan and wait for explicit implementation approval.

Only planning documents may change now. Work exclusively in the existing `feat/private-shoebox` worktree at `/Users/mtm/.local/share/opencode/worktree/bc1d6b/private-shoebox`. Do not create another worktree, alter the iPad countdown, install dependencies, create service resources, inspect secrets, commit, push, open a PR, merge, or deploy. The original-checkout mockup and matching installed framework documentation were read-only references.

## 1. Intent and decisions

### Established by the user

A private shared archive for two people: blurry photos, ridiculous recordings, tiny written moments, and inside jokes. Adding from a phone should be easy; revisiting should reveal the accumulated relationship, not resemble a portfolio or social feed.

- Separate private scrapbook page and an entry point from the existing app.
- Photo, audio upload/direct voice recording, and text-only memories. NO VIDEO.
- Optional caption, a sensible default memory date, no accounts/registration/social mechanics.
- The approved direction is **the impossible shoebox**, not restrained cards: crooked photo scraps with legs, voice jars, a suspicious moon, an overworked flying fish, absurd Spanish stamps and reactions, and harmless “No tocar” mischief.
- Real content stays legible, layouts bounded, controls stationary, mobile first. No autoplay, decoration over content, focus/scroll hijacking, or forced motion. Reduced-motion support and an ambient-motion pause control.
- Strong shared password verified on the server, secure session cookie, private page/APIs/media.
- Separate private Notion Memories database; metadata and files in Notion. Vercel Hobby and Notion Free. No extra database/storage/auth platform without a verified blocker.
- Single-member Notion workspace, confirmed in follow-up. The two website users do not require Notion membership.
- Either person can correct note text/caption/date and remove a memory after confirmation. Removal moves its Notion page to trash, not guaranteed permanent erasure. Media replacement means remove and add again. No attribution or edit history in v1. Confirmed in follow-up.
- One file per upload request, maximum 4,000,000 bytes, multipart rather than base64 JSON.
- Direct recording: tap for microphone permission, start/stop, listen, retry/discard, explicit save; maximum 60 seconds and 4,000,000 bytes; audio-upload fallback.

The user subsequently approved this full document and requested the implementation plan. Implementation still requires separate explicit approval of that plan.

### Recommended defaults accepted through full-design approval

- Route `/shoebox`; login at `/shoebox/login`; a stable “Nuestra caja imposible” link in the existing secondary navigation, with no private previews/counts on the public app.
- Seven-day absolute session expiry, no silent extension. Logout this browser; rotating the session secret invalidates all sessions. Signed sessions do not provide individual stolen-token revocation.
- Date defaults to the user's local calendar date when composing, editable as a date-only field; do not infer location/date from EXIF.
- Newest memory date first, then creation time; 12 results per batch, bounded previous/older navigation rather than infinite accumulation. No search/tags/filter system in v1.
- Notes: 1–2,000 characters; captions: up to 500. Plain text only, no HTML/Markdown rendering. Media memories may have no caption. Text memories may have a separate optional caption, though the form need not encourage redundant text.
- Audio uploads also limited to 60 seconds for a consistent small v1. If a reliable finite duration cannot be validated, explain the format issue and reject rather than bypass the limit.
- Process photos to a maximum 2,048-pixel long edge, preserving aspect ratio; JPEG output, opaque background where needed, strip metadata; preview this saved version before submission. Originals are not retained.
- No drafts in localStorage/IndexedDB, no offline mode, background uploads, transcription, transcoding service, or automatic recovery of recordings after closing the tab.

## 2. Experience and surreal visual behavior

### Enter and browse

An unauthenticated visitor sees only the affectionate absurd login scene, never a briefly rendered archive or a client-side hidden list. After login, “Departamento de cosas que nos pasan” opens onto crooked scraps, written declarations and jars, framed by a moon and weary fish. Copy can use “Depositar una prueba”, “Fecha del incidente”, and “Todo esto es culpa nuestra.” Do not invent personal relationship details or seed fictional memories into production.

Use normal document flow with a semantic chronological list. Deterministic visual variations derived from record identity give papers their rotation, tape, legs, stamps and jar shapes without random hydration or content order changes. One column at narrow widths, staggered two/three-column arrangements where room permits. Real text, audio controls and action buttons remain upright within their visual containers. Reserve decorative gutters/foot space; allow text to grow and wrap. No absolute-positioned memory canvas, drag-to-browse requirement, masonry reading-order mismatch, clipped long notes, or horizontal overflow at 320px.

Keep only one batch of at most 12 memories mounted. Stable Previous/Older controls replace the batch; preserve the return cursor stack for this tab and announce the new batch with deliberate focus to its heading. A refresh resets to newest. Concurrent additions/corrections can shift Notion pagination; deduplicate visible IDs and provide refresh, without claiming snapshot isolation. A successful save returns to newest and shows the saved record; a backdated record has a stable “Ver recuerdo” action if not in that batch.

Photos use authenticated same-origin image URLs and lazy loading, with reserved aspect ratios. A click opens an accessible full-photo dialog showing the processed image with contain sizing, caption/date, stable close button and scroll/zoom compatible with the device. No original-resolution promise or custom pinch/gesture engine. Native audio controls sit inside illustrated jars, `preload="none"`, with a caption/date and explicit playback-failure message. Playing one pauses the previous; route changes/logout pause everything. Native controls provide seeking; never depend on decorative waveforms as the only playback feedback.

### Add and correct

A stable add button opens one accessible composer dialog (full-height usable sheet on phone). Choose Foto, Audio, or Texto. File selection is accessible without drag/drop. Preview the processed photo or local audio, add optional caption and date, and explicitly save. During processing/upload, keep the form mounted and announce progress; do not claim exact network percentages. Disable duplicate submission. On failure retain the in-memory draft, offer a safe retry and clear explanation; on session expiry retain it only while the page remains open, clear private list/media, and offer inline reauthentication without uploading automatically.

Each memory has a stable “Corregir” action and a secondary “Retirar de la caja” action. Correction uses the same text/date controls, not file replacement. Confirm removal with the memory identified and a Cancel button initially focused. Trash the page, remove it from the UI only after success, and stop its audio. Explain that restoration can be done manually in Notion; there is no in-app trash view. Failed/expired-session mutations keep the item and show an actionable error. Last confirmed write wins if both people edit simultaneously; no collaborative editor or version history.

### Mischief and motion

“No tocar” triggers one bounded, restartable, sub-three-second decorative event: the moon looks guilty, a photo's legs march inside their reserved gutter, the fish drops a fictional stamp, or jar lids complain. No real content moves out of reach, no memory changes, no audio, no dialog opening, no flashing, and no scroll/focus changes. Cap transient nodes/timers; rapid presses replace rather than queue events.

Ambient motion affects decoration only. A stable pause/resume control persists a non-sensitive preference and pauses **all ambient scenery visible on this route**, including inherited global backgrounds. Reduced motion always overrides resume and shows static punchlines. Dialogs, recording, hidden tabs, and paused mode stop ambient distractions; essential controls and text never animate in space. Reset or clean up timers/listeners on navigation and unmount. Use Framer Motion's existing reduced-motion configuration plus CSS coverage; that configuration alone does not pause CSS animations.

The existing root layout includes `SurrealistBackground`, header/footer, theme and quality providers. Keep that shell and its established behavior; add route-scoped presentation overrides only where the shoebox needs an opaque protected reading surface or an ambient pause boundary. Do not restructure the global layout/providers or redesign birthday/history. Global quality fetches are not scrapbook authorization and must never gain Memories data.

### States and accessibility

- Empty: illustrated empty shoebox and one clear add action; no fictional populated state.
- Loading: bounded paper/jar placeholders with stable footprint and text status; no false count or endless theatrical delay.
- Read failure: retry in place, no stale private content after expiry; older-batch failure keeps the current batch.
- Missing/removed media: preserve caption/date and show unavailable/retry, not an endless broken image.
- Keyboard: semantic buttons/links, native dialog ownership, Escape close except explicit unsaved-work confirmation, initial focus, background inertness, focus return. Do not stack dialogs; reuse proven `JournalDialog` behavior after inspecting it during planning.
- At least 44px essential targets, readable contrast, visible focus, text reflow/200% zoom, no decoration announced as content. Audio control labels identify the memory. Offer optional caption for an audio description, without claiming that this supplies a transcript or full WCAG audio-alternative compliance.

## 3. Architecture and trust boundaries

```text
Browser -> server-guarded page / authenticated same-origin API
                 | -> session verification / origin checks / body limits
                 | -> dedicated server-only Memories service
                 |       -> existing Notion integration credentials
                 |       -> separate Memories data source and file uploads
                 | -> authenticated media resolver -> bounded file bytes
Login -> Vercel WAF rule -> password verification -> signed session cookie
```

Use Node.js App Router Route Handlers for multipart uploads and media. Do not use Server Actions for file upload: keep one explicit body-limit/authentication surface. Read session cookies asynchronously in the server page; authenticate again in every handler/service entry point. A protected layout or hidden link alone is insufficient. Do not rely on middleware/proxy alone.

Keep the Memories service separate from the existing `notionService.ts` to avoid changing birthday's public schema, broad error logging, and incomplete pagination. Reuse `@notionhq/client` and the existing integration only server-side. Reuse data-source discovery as a pattern, not a forced first-data-source assumption: require the configured database to resolve to the expected unique source/schema, otherwise fail closed with a generic setup error.

Candidate interfaces for the later plan:

- `requireShoeboxSession(): Promise<Session>` / request variant; explicit unauthorized errors.
- `listMemories({cursor?}): Promise<{items: MemorySummary[]; nextCursor: string|null}>`.
- `createMemory({requestId, kind, text?, caption?, memoryDate, file?}): Promise<MemorySummary>`.
- `correctMemory(id, {text?, caption, memoryDate}): Promise<MemorySummary>`.
- `removeMemory(id): Promise<void>`.
- `resolveMemoryMedia(id): Promise<TrustedMedia>`: assert database membership, active page, valid kind and one Notion-hosted file before returning server-only attachment information.
- Client-visible `MemorySummary`: ID, kind, text/caption/date, creation time, validated aspect ratio/duration as applicable, and same-origin media path. No upstream URLs, integration IDs, original filenames, or upload IDs.

The implementation plan will assign exact files and request/error contracts. Private responses must not spread raw Notion records.

## 4. Authentication, privacy, and operational limits

### Session and login

Use a high-entropy shared password/passphrase, stored only as a salted scrypt verifier in `SHOEBOX_PASSWORD_HASH`, not as plaintext source/config. Use a separate random `SHOEBOX_SESSION_SECRET` to sign a minimal versioned session containing issued/expiry times and a random identifier; a maintained session-signing library is preferable to inventing a token format. Bound password length and login body size before scrypt; constant-time verifier comparison; generic failures. Missing/malformed configuration fails closed.

Production cookie: `__Host-shoebox`, Secure, HttpOnly, SameSite=Strict, Path=/, no Domain, seven-day maximum age with matching signed absolute expiry. A separately named non-Secure development cookie is allowed only on local HTTP, never deployed based solely on user input. Never put password/session tokens in URLs, localStorage, logs, analytics, or client props. No third-party analytics/content on the shoebox.

Logout is a same-origin POST that clears the cookie and triggers a full navigation to the login page, clearing archive/form/media/object URLs in that browser. Server verification prevents expired/forged tokens; client expiry handling and visibility/pageshow revalidation clear the screen and stop playback when the session is no longer valid. Back/forward-cache restoration must revalidate before exposing old content. Already downloaded/displayed bytes cannot be recalled from a person/browser.

With stateless sessions, logout does not revoke a copied cookie; changing the password alone does not invalidate existing sessions. Rotate the session secret with a password change or suspected compromise. Both people have equal authority; no attribution, accountability, per-person revocation, or end-to-end encryption. Vercel, Notion, workspace owner and anyone with the password/session or exported files remain within the trust boundary.

### Password guessing and cross-origin requests

Before production exposure, manually configure the available Hobby WAF rate-limit rule for the exact login API path and POST method, keyed by source IP: recommendation five requests per minute, returning 429. Match normalized paths so alternate slash/case forms cannot bypass it; route aliases must not exist. Verify available rule capacity and project settings during an explicitly authorized setup, not now. Rule absence is a launch blocker; do not silently substitute per-instance memory counters.

Official limits currently allow one Hobby rate-limiting rule and three custom firewall rules. Counters are regional, fixed-window and per-source; distributed IP attacks can exceed them. Use a genuinely strong shared secret, bounded expensive password work and Vercel's built-in protections. No promise of global account lockout. If that residual risk is unacceptable, revisit durable rate-limit storage as a new explicitly approved architectural change—not a fake Notion read/modify/write counter.

All mutations, including login/logout, require exact configured `Origin` equal to `SHOEBOX_APP_ORIGIN`, reject missing/null/foreign origins, and reject cross-site Fetch Metadata when present. Do not derive the allowed origin from an untrusted Host or forwarded header. Same-site cookie is defense in depth, not the sole CSRF control. No permissive CORS or cross-origin mutation GETs. Preview deployments need an explicitly configured origin and separate test configuration; no wildcard origin allowlist.

Media/read endpoints require session and reject cross-site embedding using Fetch Metadata where present; do not require Origin for ordinary same-origin img/audio GETs. Add restrictive referrer policy, `nosniff`, appropriate same-origin resource policy, and framing protection scoped to shoebox responses. No open redirects from login or upstream media redirects.

### Caching and secrets

Page HTML, RSC/prefetch responses, API JSON, media, auth responses and errors must be private/no-store (including CDN-specific cache controls where appropriate); no `use cache`, static export, shared response caching, service-worker persistence, or public thumbnails. Cookie-dependent dynamic rendering is necessary but not a substitute for explicit HTTP cache policy verification. Disable automatic prefetch on the public entry link. Verify behavior on the actual deployed response chain later.

Use ordinary same-origin `<img>` for private photos, not `next/image` optimization. The public `/_next/image` endpoint must not become a cookie-free path to private media: test both same-origin private path inputs and upstream URL inputs with synthetic fixtures. Never add shoebox bearer URLs to remote image configuration or public assets. Existing birthday URLs/optimizer behavior remain a separately flagged issue, not scrapbook access control.

Remove the server `env` entries from `next.config.ts` during eventual implementation; read those variables only on the server and add server-only import boundaries. Installed Next docs explicitly warn that this config exposes referenced values to bundle substitution. No deployed artifact/credential was examined, so a deployed leak is not established. Recommend precautionary rotation before launch, especially before expanding the integration's access; rotation/reconfiguration requires approval. Test client bundles using synthetic canary credentials, never by printing/searching personal secret values.

Logs contain only safe operation/error codes and a random diagnostic ID. Do not log request bodies, cookies, passwords, captions, notes, filenames, Notion responses, temporary links, or raw SDK exceptions. Document that platform request/access logs may still record paths and IPs; avoid personal data in query strings. Notion page IDs in private media paths are identifiers, not authorization.

Environment names only: existing server `NOTION_API_KEY`; new `SHOEBOX_NOTION_DB_ID`, `SHOEBOX_PASSWORD_HASH`, `SHOEBOX_SESSION_SECRET`, `SHOEBOX_APP_ORIGIN`. No `NEXT_PUBLIC_` scrapbook secrets. `.env.local.example` may document names/placeholders in the eventual implementation, never now.

## 5. Minimal Notion schema and lifecycle

Create a new full-page private Memories database manually in the existing single-member Free workspace, not a public/shared-to-web page. Grant the existing integration read/insert/update capabilities for this database. Do not grant wider workspace access or reuse birthday's database. No live setup is authorized yet.

| Property | Type | Purpose |
| --- | --- | --- |
| Name | title | Generated non-sensitive internal label, not an extra user field |
| Kind | select: photo/audio/text | Determines required content |
| Memory date | date, date-only | User's chosen date |
| Caption | rich_text | Optional plain text, max 500 chars |
| Text | rich_text | Required only for text, max 2,000 chars |
| Media | files | Exactly one Notion-hosted attachment for photo/audio, none for text |
| Request ID | rich_text | Stable client-generated UUID for retry reconciliation |
| Width / Height | number | Validated saved photo dimensions, otherwise absent |
| Duration | number | Validated audio seconds, otherwise absent |

Creation time and trash status come from Notion system fields. Avoid extra child blocks/templates, author records, original file URLs, status workflows or separate audio/image databases. Each memory page still counts as a block; the confirmed single-member workspace avoids the multi-member Free lifetime-block restriction. This is not a backup system: manual Notion export remains an owner task.

List with explicit page size 12 and descending date/creation sorts, use `has_more` and opaque `next_cursor`; bound cursor size, do not assume the first response is the entire collection. Server membership checks compare each record's parent to the configured data source and reject trashed, external, malformed or mismatched records. Manually added records must meet the same supported limits/types; external attachment URLs are not supported.

Create flow: authenticate/origin/limits -> validate metadata/file -> reconcile Request ID -> create Notion upload -> send binary multipart -> create memory page referencing completed upload in the Media files property -> return sanitized record. Text skips upload. Never send the integration token to the browser. Attach completed uploads within Notion's one-hour expiry. Unattached uploads are automatically archived after expiry; do not promise immediate file deletion. Trashing a page does not guarantee deletion of retained Notion media/backups or immediate invalidation of previously issued bearer links.

Respect Free's current 180 requests/minute connection budget and approximately 3 data-source queries/second, plus shared workspace limits. Bound outgoing concurrency, avoid eagerly loading 12 media files or refreshing continuously. Each uncached media request may require a record read; browsers use preload-none/lazy loading. A singleton concurrency queue is a courtesy within an instance, not a global correctness/rate-limit guarantee. Handle 429/529 and Retry-After; when delay exceeds the operation deadline, return a friendly retry response rather than sleeping past the function budget. Do not stack an SDK retry loop with an independent retry loop.

Retries: bounded retries for safe reads/rate limits; never blindly repeat ambiguous page creation. Retain the same Request ID and draft across user retries; check existing matching records and Notion committed-resource guidance before creating again. A timeout/unknown write outcome returns an explicit pending/unknown result and a read-only status/reconciliation path; UI does not claim failure or invite an immediate fresh UUID. Reconcile again before a later explicit retry.

Notion has no transactional uniqueness constraint for Request ID: simultaneous identical creates across instances cannot be guaranteed exactly-once with this architecture. Disable duplicate submits, preserve one in-flight request per composer and reconcile repeated attempts, but document this residual rare duplicate risk. If strict transactional idempotency becomes a requirement, that is a verified reason to reconsider extra durable storage. Removal handles any rare duplicate without silently deleting memories.

## 6. Files, upload limits and authenticated media

### Input validation and budgets

Client and server independently enforce 4,000,000 actual file bytes, one file only, small bounded metadata, and no video. Cap the complete incoming multipart body at 4,200,000 bytes (below Vercel's 4.5 MB ceiling), including when Content-Length is missing or false; cap login/JSON bodies separately (recommend 4 KiB/16 KiB). Do not call an unbounded `request.formData()` before enforcing body size. Authentication/origin checks precede parsing/Notion requests. Browser errors must handle Vercel's own non-JSON 413/timeout responses too.

Allow only validated JPEG output for photos. Audio allowlist: MP4/M4A with AAC audio, MP3, WebM/Opus, Ogg/Opus or Vorbis, and PCM WAV, subject to bounded structural parsing, valid finite duration, supported audio tracks and no video tracks. Exclude MIDI/WMA/FLAC and arbitrary files despite Notion's broader support. Sniff bytes and inspect container/codec/tracks, not only extension or browser MIME; canonicalize safe filename/content type. Signature checks alone cannot prove an MP4/WebM is audio-only. The later plan must select maintained bounded media inspection tools; do not introduce ffmpeg or server transcoding by default.

Reject empty/corrupt/truncated files, MIME/structure mismatches, active content/SVG/HTML, excessive dimensions/duration, unexpected properties and unsupported containers. Validate photo decoding and re-encode on the server to normalize trusted output and strip metadata; enforce pixel/output caps before storing. Browser normalization is for UX/bandwidth, not a security boundary. Server parsing/decoding must have explicit input/pixel/time limits. Native media decoders remain a browser trust dependency; structural validation is not malware scanning.

### Photo preparation

Accept one phone photo, reject huge source input before decoding (recommend 20,000,000-byte source ceiling and 40-megapixel dimension ceiling where detectable), decode with orientation-aware browser APIs, downsample, and compress JPEG with a bounded quality/dimension fallback until under 4,000,000 bytes. Show dimensions/size and saved preview. Keep UI responsive; failure releases temporary resources and offers another file. Do not loop quality reduction indefinitely or silently upload an original if processing fails.

Browser image orientation/HEIC support varies. Prefer explicit decoding detection over file-extension claims. Where Safari/file picker supplies a decodable HEIC or converted JPEG, process it; otherwise ask for a JPEG export/screenshot or a compatible camera setting. No universal HEIC decoder dependency or promise of universal conversion. Large-image decode can fail on phones despite byte limits; handle it without saving or losing the rest of the draft. Confirm orientation and transparency behavior on real devices.

### Media read and seeking

`GET/HEAD /api/shoebox/memories/:id/media` authenticates every request, resolves the current trusted record, and never accepts a `url` parameter. Only Notion-hosted HTTPS attachments from narrowly verified hosts are fetched; reject private IP destinations, external attachments, credentials in URLs, and unvalidated redirects. Validate every redirect or disallow them; never send the Notion API Authorization header to an attachment host. An expired link can trigger one fresh record resolution and retry, not an unbounded loop.

For this tiny v1, prefer **bounded buffering up to 4,000,000 bytes** over a complex streaming proxy: inspect Content-Length where present and enforce actual bytes while reading, cancel at the cap/deadline/disconnect, validate media before sending headers, then emit only the requested range. This stays below the documented Vercel response ceiling for full and partial responses; do not assume streaming lifts that ceiling. Buffering adds first-byte delay and up to a few file-sized buffers per invocation, but avoids relying on upstream range support and prevents leaking oversized malformed upstream bodies.

Support a single standard byte range (closed, open-ended, suffix), return correct 206/Content-Range/Content-Length/Accept-Ranges for audio seeking and 416 for unsatisfiable ranges. Reject malformed/multiple ranges with a documented error rather than passing arbitrary headers upstream. Implement HEAD explicitly with no body; same authentication/privacy policy as GET. Ignore conditional caching requests in favor of fresh authenticated responses. Bound request time and upstream bytes, use no-store on both success/errors, do not redirect the browser to Notion, and never forward upstream cache headers, Location, cookies or bearer URLs.

Real Vercel authenticated GET/HEAD/range behavior, payload ceilings, browser seeking and CDN headers require a later explicitly authorized deployment/test. Local tests cannot certify the hosting edge. If this fails, stop and revisit the architecture rather than exposing public URLs as a workaround.

## 7. Direct voice recording

Require HTTPS (localhost exception only), `getUserMedia`, `MediaRecorder`, a microphone, and a supported allowed audio format. Check feature and recording/playback support, not user-agent strings. Prefer MP4/AAC when both recorder and playback support it for cross-device compatibility; otherwise WebM/Opus, then another explicitly supported allowed type. Use `MediaRecorder.isTypeSupported`, catch constructor/start failures, and use the recorder's actual MIME type/codec and Blob type for extension/server validation. Do not relabel WebM bytes as M4A.

Support findings: older iPhone/macOS Safari recording commonly produces MP4/AAC; Safari 18.4 added WebM/Opus recording and expanded Ogg support. Android/desktop Chromium commonly supports WebM/Opus; Firefox commonly supports WebM/Ogg Opus. Exact formats vary with OS/browser/hardware. A positive support probe is not a guarantee of successful recording or playback on the other person's device. No client/server transcoding in v1; if a target device cannot play the chosen format, offer compatible audio upload and report the limitation. Physical iPhone Safari and Android Chrome checks are launch gates.

State machine: idle -> requesting permission -> recording -> stopping/finalizing -> local preview -> saving -> saved; failures return to an understandable recoverable state. A new recording requires a new explicit tap. No microphone access on load, no background recording, no saving before review/explicit save. Show a stable timer, stop button and unmistakable recording status; jar reactions remain decorative and paused elsewhere.

Use an elapsed-time deadline, not chunk count; request a modest audio bitrate and periodic chunks but treat both as hints. Stop at 60 seconds or a conservative pre-cap byte threshold, finalize, check final actual Blob bytes and finite duration, and reject anything over the hard limits. Never truncate encoded bytes to force a fit. MDN documents delayed chunks and Safari microphone pauses/Android screen-lock delays: browser scheduling can overshoot the stop request. Do not promise exactly 60 seconds of underlying capture under suspension; never upload an over-limit result.

On tab hidden/pagehide, microphone track ended/muted interruption, recorder error, dialog discard, logout, route change or unmount: stop recording and all microphone tracks immediately where browser events can run. Finalize a potentially useful interrupted clip only for explicit local review if within limits; never auto-resume. If the browser kills/suspends the process before cleanup, the app cannot guarantee event delivery; it must not claim background reliability. Late permission success after cancellation must immediately stop the newly acquired tracks and not resurrect the composer. Pending permission prompts cannot always be programmatically dismissed.

Use generation/cancellation guards, bounded chunks, listener/timer cleanup, stop tracks after normal stop too, and revoke every object URL when replaced/discarded/unmounted. Discard releases audio and bytes; retry first confirms replacement of a preview. Save failures keep the local Blob while the page stays open. Navigation/reload can permanently lose unsaved recordings; warn through supported browser mechanisms without claiming mobile unload dialogs are guaranteed. Permission denial, absent/busy device, policy/insecure-context blocks, unsupported formats, zero-byte clips and decode failure all offer audio upload/text instead.

## 8. Verification strategy and later implementation-plan requirements

No product code or test scaffolding is authorized now. The implementation plan must be concrete and test-first, with exact paths/interfaces, failing-test commands, minimal implementation steps, fresh verification and independent review. Use existing Playwright for browser regression and add the smallest appropriate server/unit runner only when implementation is authorized. A browser-routed fake API alone does not test server authentication.

Automated tests must use synthetic text/photos/audio, fake Notion and attachment HTTP transports, fake clock/recorder/permission events, and isolated test-only session secrets. Never connect to personal Notion/media/notify/Telegram. Test backend handlers against injected/mock transport, not production endpoints. Any server fixture mode must be impossible to enable in production; no authentication bypass exported as an app route.

Coverage required:

- Negative direct page/HTML/RSC/prefetch/API/HEAD/media access; expired/forged/missing cookie; private-cache headers on every status; no Notion URL leakage; public optimizer bypass attempts; database-membership and trashed-record rejection.
- Password body/work limits, origin/null/missing-origin mutation rejection, wrong methods, logout/expiry/back-cache behavior, no secret in client build using canaries; WAF configuration remains a manual gate, not an in-memory mock proof.
- File bytes vs claimed type, video hidden in MP4/WebM, excessive body with no/false Content-Length, multipart overhead, multiple/empty/truncated/unsupported files, unsafe dimensions/duration, corrupted upstream media, redirect/SSRF denial, valid/invalid/suffix/open-ended/multiple ranges, HEAD and upstream aborts.
- Notion cursor pagination beyond 100 fixture records, empty batches, rate limits/Retry-After, upload/send/attach failures, expired uploads, uncertain create outcomes, stable Request ID reconciliation, duplicate clicks, two-client concurrency limitations, trash/correction failure and no-media-replacement semantics.
- Recording permission denial/delayed approval, no device, unsupported formats, actual MIME mismatch, stop/final chunks, threshold overshoot, 60-second limit, track interruption, hidden tab/unmount/route/logout cleanup, resource/object URL release, preview/retry/discard and no network upload before save.
- Photo orientation, large decode failure, unsupported HEIC, JPEG fallback, saved preview matching processed output and stripped metadata.
- 320/390/430/768/1440 widths, phone landscape, long/unbroken Spanish notes, desktop, keyboard/dialog focus, reduced motion including live preference change, ambient pause including inherited scenery, finite mischief under repeated activation, loading/error/empty/audio failure and no autoplay.
- Browser engines: Chromium, WebKit and Firefox where installable; do not equate Playwright WebKit with physical iPhone Safari or viewport emulation with Android recording behavior.

Regression baseline: existing `pnpm lint`, `pnpm typecheck`, `pnpm test:e2e`, `pnpm check` and build with non-personal mock configuration, no live private services. Preserve existing home/history/post-office/birthday tests, not just screenshots. The latest read historical handoff reports 216 passing tests/full check and eight warnings, but this is not a fresh claim. No `node_modules` exists in this worktree; dependencies have not been installed and no runtime baseline was executed during design. The later plan must establish its own baseline before product edits and record existing failures honestly.

Manual gates (not performed): real iPhone Safari/Android Chrome capture and cross-playback, microphone prompts/interruption/lock-screen cleanup, large/HEIC/orientation phone photos, OS screen reader/zoom/native audio controls, explicit authorized synthetic Vercel upload/download/range/cache testing, WAF rule availability/application, and authorized owner-run Notion setup/integration capability check. Live tests need separate approval and should use a disposable synthetic database before personal memories.

## 9. Alternatives, boundaries and remaining gates

- Reusing the birthday puzzle/public API is rejected: browser-side check and public photos do not provide scrapbook authentication. Birthday security should be flagged separately; unrelated changes remain out of scope.
- Public Notion URLs or public optimizer thumbnails are rejected: temporary bearer links are not shared-password access control.
- Another auth/database/storage service is unnecessary under the verified caps and accepted small-app limitations. Strict global lockout or transactional exactly-once creation would change that assessment.
- Direct-to-Notion browser upload is rejected because it would require exposing integration authority or creating another capability workflow without a need at 4 MB.
- Streaming is feasible in Next/Vercel, but bounded buffering is the simpler defensible download approach at this cap. It does not eliminate hosting validation.
- Universal HEIC conversion, all-codec audio playback, precise capture deadlines during OS suspension, guaranteed permanent erasure, and zero duplicate risk are explicitly not promised.

No further product question blocks planning. A fresh independent builder-check reviewer read the design and reported “nothing important left”; no additional decisions or edits were requested. This is a planning-readiness check, not implementation/security certification. The user has approved the design; the resulting plan needs separate explicit approval before implementation.

## 10. Evidence and references

Read on 2026-10-21; official documentation describes platform capability, not this project's live configuration:

- Notion file sizes/types: https://developers.notion.com/docs/working-with-files-and-media
- Upload/send/attach and one-hour lifecycle: https://developers.notion.com/docs/uploading-small-files
- Temporary bearer URLs: https://developers.notion.com/reference/file-object
- Free workspace membership/block rules: https://developers.notion.com/reference/workspace-block-limits
- Current request/retry limits: https://developers.notion.com/reference/request-limits
- Pagination: https://developers.notion.com/reference/intro#pagination
- Vercel payload/duration limits: https://vercel.com/docs/functions/limitations
- Vercel streaming: https://vercel.com/docs/functions/streaming-functions
- Hobby WAF limits/regional counters: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
- MediaRecorder API: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- Chunk timing/interruption limitations: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/dataavailable_event
- Safari 18.4 recording formats: https://webkit.org/blog/16574/webkit-features-in-safari-18-4/

Matching installed Next `16.3.0-preview.6` docs read from original checkout, read-only because this worktree has no dependencies: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, `01-app/03-api-reference/04-functions/cookies.md`, and `01-app/03-api-reference/05-config/01-next-config-js/env.md`. Re-read relevant installed page/header/image/route guidance when the plan assigns concrete framework details; no assumption that older Next conventions apply.

Project references: `AGENTS.md`, `CLAUDE.md`, `src/components/{PostOffice,SurrealistBackground,BirthdayWorld,BirthdaySecretModal}.tsx`, `src/components/usePostalDelivery.ts`, postal CSS, `src/app/layout.tsx`, `src/sections/QualityTracker.tsx`, `src/services/notionService.ts`, birthday API, `next.config.ts`, package/scripts/Playwright config, redesign verification and post-office/fish-delivery plans. The approved mockup at `/Users/mtm/dev/mtm/tor-landa/.superpowers/brainstorm/14886-1792604601/content/impossible-shoebox.html` is visual reference only, not production code; its memories/audio are fictional.
