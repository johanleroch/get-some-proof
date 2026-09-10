# Assistant testimonial import delivery ledger

Source: #110 and #111–#117, read in full on 2026-09-10. The adjacent issue files preserve the acceptance criteria read at implementation start; GitHub remains authoritative.

Base: `3d7d66d` (`origin/main`). Worktree: `get-some-proof-mcp-import`, branch `codex/mcp-testimonial-import`. The original checkout's modified files and environment files are untouched. No content was merged from `get-some-proof-page-analysis`.

Native GitHub dependencies verified: #111 has none; #112 and #113 depend on #111; #114 depends on #111/#113; #115 on #114; #116 on #112/#113/#114/#115; #117 on #116.

Open PRs inspected at start: #109 (Senja import metadata/video duration), #108 (alternative screenshot publisher), #107 (sidebar), #106 (dashboard), #94 (Inbox keyboard tests). These remain separate. Screenshots for this delivery use gh-image attachments.

## Agreed behavioral test boundaries

- Authenticated MCP transport operations and existing Convex test seams.
- Inbox and public projections, entitlement and quota operations.
- Browser setup, copy controls, Pending/recovery states and responsive design.
- Real supported Claude and Codex sessions. In-memory MCP tests do not certify client compatibility.

## Evidence in progress

- Frozen installation succeeded with Node 24.19.0 and pnpm 11.24.0.
- Initial text-import test failed because `assistantImports` did not exist, then passed after implementation through the existing Inbox query.
- Targeted regression run: 5 files / 22 tests passed (assistant import, existing testimonial imports, OAuth adapter, MCP route and existing MCP tools). A later change requires a fresh run before delivery.
- Convex codegen succeeded against development `content-mosquito-795`; this regenerates bindings without changing the deployed application. No production operation was performed.
- DESIGN.md, domain guidance, schema, Convex guidelines, Next route-handler guide and applicable delivery/visual skills were read. MCP SDK v1.29.0 documentation was fetched through Context7.
- Claude Code was not found in PATH; no Claude desktop app appeared in the available app inventory. The Owner was asked which real Claude surface is available. Codex CLI exists. Neither real connection is certified yet.

## Checkpoint after #111–#113 implementation

- Text and faithful identity fields are stored as Pending; an absent author remains unset. The Inbox entry leads to the Free/Pro rights activation screen.
- Public portraits use DNS validation and pinned sockets on every redirect, bounded actual bytes, and three total attempts for transient failures. Temporary DNS and interrupted body failures are normalized and covered.
- Batch requests accept at most 50 records. An exact concurrent replay returns the original job; changed payload under the same request ID fails explicitly. Source changes preserve the existing testimonial as a conflict.
- A shared migration ID persists unique source progress, aggregate submission outcomes and recoverable paginated batch IDs. Retrying an accepted request does not increment progress or schedule media again.
- Latest targeted run: 4 files / 20 tests passed, including the signed JWT through Next MCP and Convex HTTP, concurrent replay, migration recovery, absent author and hostile/media network cases. TypeScript passed after migration changes.
- Setup desktop/mobile browser tests and four screenshots were inspected during implementation. Screens remain `todo` until final UI and current-head publication. These images are not publication evidence yet.
- Independent Standards/Spec review confirmed the earlier activation and HTTP-test findings resolved. Both reviewers found transient network retry handling; Spec additionally found missing cross-batch recovery. Those paths are now implemented and tested; final review is still required.
- Current Mux docs were fetched through Context7 for resumable direct uploads. #114 onward remain unfinished; existing video flow is not claimed to support generic direct sources yet.

- Follow-up Spec review verified both P2 fixes and ran 7 tests successfully. No new defect in those corrections.
- React Doctor changed-scope scan improved 81 to 82 after parallelizing independent activation reads and guarding configured-origin parsing. Remaining diagnostics were inspected: bounded transaction loops preserve order/read-after-write; Inbox complexity predates this work; Zod format notation is a style preference. No rules suppressed or dependencies installed.

## #114 checkpoint in progress

- Assistant batches accept video-only records without generating a quote. The shared video workflow creates Pending records and reservations, then uses a Node action to copy the original public file safely into a Mux direct upload in 8 MiB pieces.
- Actual bytes are bounded at 512 MiB and persisted before final PUT. A final request with an uncertain result waits for the authoritative webhook; it is not duplicated or cancelled as a proven failure.
- Assistant assets require verified bytes and a duration at most 600 seconds before Ready. Collection assets retain their 120-second rule.
- When a batch's new videos exceed available capacity, all those videos receive Pending placeholders with blocked outcomes and released reservations; text proceeds. No arbitrary subset is transferred.
- Intermediate Spec review found paid-retry bypass, unclassified Mux creation outages, and cancellation webhook races. Fixes now require Pro for new assistant reservations, classify temporary provider failures, and detach retired upload IDs atomically while scheduling cleanup before a retry.
- Latest targeted validation: TypeScript and 25 tests passed, including public signed-MCP video-only import, 600/601 seconds, unverified completion, blocked batch, retired-upload cancellation interleaving, rejected Free retry, safe chunk limits and uncertain final upload. The full local `pnpm check` passed: formatting, lint, TypeScript, 151 files / 865 tests and build.
- Real development ingestion is still unverified. No backend deployment has been performed. No #114 delivery claim yet. A follow-up review also found interrupted Mux response-body reads; those now produce a transient provider error, with 21 provider tests passing.

## Next slice: #115 local upload implementation approach

Use a scoped expiring capability and binary chunks up to 8 MiB through a Convex HTTP action; its documented request limit is 20 MiB. Keep the private Mux upload URL inside the backend. Each authorized binary request counts actual bytes and advances a persisted offset; an explicit final chunk can only mark measured bytes verified internally before Mux finalization. Do not expose an arbitrary client completion mutation or trust a declared size as proof. Reuse the existing Pending testimonial, reservation and asset lifecycle. Provide a small real command-line transfer path plus browser file input using the same chunk endpoint. This is an implementation direction, not a completed feature.

## Remaining gates

All issue checkboxes remain unchecked. Implementation, negative/recovery tests, real-client checks, Standards/Spec review, current-commit desktop/mobile evidence, final PR evidence and remote CI on the delivered head are still in progress. Draft PR #118 is open; its three checks passed on `4f1223f`. No ticket is delivered yet. Do not infer delivery from passing unit tests.

## #115 checkpoint in progress

- Local-video placeholders remain Pending. An authenticated MCP tool or the signed-in Owner obtains a 15-minute upload capability scoped to that item and its current asset. The private provider URL stays in Convex.
- Binary HTTP pieces validate actual length, range and digest, persist progress, and permit exact acknowledgement replay. Finalization is claimed atomically once; an ambiguous provider response returns 202 and preserves the reservation for a late webhook. Expiration scrubs capability secrets. Permanent provider rejection releases capacity and permits a new file.
- Behavioral coverage includes wrong tokens, out-of-order and changed bytes, same-request resumption, completed acknowledgement recovery, expiration, a late Ready webhook after uncertain finalization, and website-authenticated replacement without changing identity or Pending status.
- `scripts/upload-assistant-video.mjs` and the Inbox picker share `transferAssistantVideo`. The command reads capability JSON from stdin, streams file slices with Node 24, and never prints tokens. Ordinary Claude/Codex execution against the live MCP endpoint remains unverified.
- The filtered Inbox now exposes private source/date, aggregate outcomes and per-media state with a local file fallback. This begins #116; selection, retry controls and broader import navigation still need completion.
- New gallery fixture `assistant-import-recovery` has light/dark desktop/mobile captures. Light desktop/mobile inspected; final current-head captures and gh-image publication remain required.
- Local WebKit exposed an existing September date hydration mismatch (Node `Sept` vs Safari `Sep`). UTC month formatting now produces identical markup. Safari Option-Tab also exposed Radix's Alt-Tab loop omission; shared dialogs now wrap this native shortcut at their edges. All 36 WebKit keyboard checks passed on desktop/mobile after the correction. Full browser gate still needs a fresh run.
- Intermediate Standards/Spec review verified finalization and acknowledgement fixes; Spec's permanent-refusal follow-up is implemented and tested. Final slice review is pending.

- Final local check for the slice passed formatting, lint, types, 153 files / 873 tests and build. Subsequent presentational/type-schema edits received focused validation and require remote CI on the pushed head.
- The full local browser run had 786 passes, 4 existing skips and one intermittent existing managed-video loader assertion on desktop Chromium. Its unchanged test then passed on all five browser configurations; the new recovery accessibility/theme/target-size checks also passed (15 combined tests). This is recorded as a flaky first run, not hidden as an all-green run.
- Current React Doctor comparison was re-run with the same installed tool on isolated `4f1223f`: baseline 79/8 warnings, current 80/3 warnings. Remaining diagnostics are the previously reviewed atomic source-tracking loops and existing Inbox complexity. No regression and no suppressions.
- Standards and Spec closed the Ready-state, accepted-transfer-after-Pro, permanent-refusal and stable-loading-label findings. Spec independently ran four tests successfully. Real assistant and provider compatibility gates remain open.

## #116 checkpoint in progress

- The Inbox and MCP resume exactly the Owner-selected failed source videos. Capacity is checked before reservations in the same mutation; an oversized, cross-job, repeated or ineligible selection changes nothing. Ready videos cannot be selected. New photo retries also require Pro, while accepted background work keeps its prior entitlement behavior.
- The Inbox shows remaining video capacity, source/date, per-media states, photo retry and local replacement. A shared DropdownMenu reopens the ten most recent assistant imports, scoped by Project/provider/Owner using a dedicated index.
- Behavioral tests cover oversized selection rollback, duplicate submission, cross-Owner/cross-job refusal, ending Pro, one-time photo recovery and preserved copied portraits. The signed MCP HTTP test includes 50 real item IDs and asserts a useful capacity error rather than an HTTP payload failure.
- Standards found the initial 1 KiB resume-body limit and a native details element forbidden by DESIGN. Both are corrected and the reviewer closed them. Spec found no additional defect and independently re-ran the HTTP test.
- Local validation: pnpm check passed formatting, lint, TypeScript, 154 files / 876 tests and build. Recovery E2E passed 25 tests across all five browser configurations, including light/dark accessibility, selected retries, photo preservation, recent-import navigation and focus return.
- The published e4eb996 checkpoint has all three remote checks successful. Its eight images were uploaded with gh-image, downloaded and SHA-256 verified in PR #118 comment 5615419940. This newer UI requires its own commit captures and publication. Real Claude/Codex and development provider ingestion remain unverified; no issue is closed.

- Full browser suite for #116: 812 passed, four existing skips, exit 0. The earlier managed-video flake did not recur. Two bounded lookup scans and a newly independent read were optimized after the Doctor comparison; their affected tests are re-run separately.

- React Doctor comparison with the same tool: e4eb996 baseline 80/6 warnings; corrected #116 80/7. The additional warning is the intentional serial reservation loop inside one mutation, required for read-after-write capacity and all-or-nothing scheduling. No rules suppressed. Initial scan regressions (two lookup loops and one independent read) were fixed.

## #117 checkpoint in progress

- All three remote checks passed on a175a7e. Eight current-head desktop/mobile captures were inspected, published via gh-image, downloaded and SHA-256 matched in PR comment 5615419940.
- Public OAuth client registration is bounded (16 KiB actual bytes, validated HTTPS/native loopback callbacks, forced public PKCE, no management metadata, durable global rate limit). The HTTP registration endpoint returns 201 and no-store.
- Connection authorization independently verifies an email-verified paid account; reuse rights are saved once before consent. Free accounts can cancel or upgrade. New grants retain a connection generation in authorization codes, access JWTs, refresh-token reference IDs and accepted-upload grants. Revocation increments it atomically, preventing old codes/tokens from recovering access after reconnecting.
- Spec review found and closed two revocation defects: pre-revocation code exchange after renewed consent, and same-second JWT rounding. Regression tests exchange codes through the real token HTTP endpoint and renew tokens with Date.now fixed to the same millisecond. The old code test was observed red (HTTP 200 instead of 401) with its guard disabled. Four auth files passed 17 tests; reviewer independently passed 16 tests in three files.
- Setup now has Claude/Codex tabs, copy commands/instructions, account connection list and revocation; gallery adds connected setup and Pro/Free consent. A standalone Node 24 transfer helper is built into public/assistant-upload.mjs and exposed by the upload tool. Its client setup is not yet certified against real assistants.
- First pnpm check passed formatting, lint, types, tests and build before the latest gallery additions. New unit/route/UI tests passed 10 tests in three files. Browser accessibility found an unfocusable horizontal command region on mobile; corrected and rechecking.
- Claude Code 2.1.267 was invoked via npx; `mcp login` exists but `auth status` confirms loggedIn:false. The Owner was asked to sign in or identify an existing Claude web session. Codex CLI is available. Neither actual source-page-to-Inbox assistant journey is certified yet. No backend code push or production operation has been performed.

- Follow-up review found legacy Free OAuth regression. Added distinct `testimonials:import:assistant`; existing `testimonials:import` consent remains Free. Generic HTTP operations require the new JWT scope; current client/consent checks require the same exact scope. Legacy Free OAuth and UI regression tests pass, as does rejection of a legacy token or legacy-only current consent at the assistant endpoint. Spec and Standards closed the findings.
- Development backend was pushed successfully to personal dev content-mosquito-795. Temporary dev SITE_URL is http://localhost:3910 and CHATGPT_IMPORT_ENABLED is true; restore SITE_URL=http://localhost:3000 and remove CHATGPT_IMPORT_ENABLED after certification. Prior values are in /tmp/gsp-117-development-env-before.json. The original localhost:3000 process and checkout remain untouched.
- A synthetic Owner mcp-certification-20260910@demo.example.invalid signed in and created MCP Certification Studio through the real UI. A guarded/idempotent internal seed establishes only this synthetic Owner's Pro mapping; it refuses normal accounts and non-local SITE_URL. Seed regression test passed. No real Stripe payment was performed.
- Codex CLI OAuth login succeeded after real consent; temporary server name gsp-certification-110 points to localhost:3910/mcp. Real source-page import is now running in an ephemeral Codex CLI session with only this MCP configured. This is not yet proof of completed media ingestion.

- Real Claude Code 2.1.267 DCR registered resource scopes while its authorize request additionally asked for offline_access. The first real login failed invalid_scope. Registration now permits offline_access for explicitly refresh-capable clients without broadening import permissions; user consent still controls token issuance. The matching vendor HTTP sequence was observed red, then all 11 OAuth option tests passed.
- Claude Code real `mcp login --no-browser` completed, and `mcp get` reports Connected on the isolated 127.0.0.1 development origin. This proves OAuth/client connectivity, not a model-driven import. Claude account login is still awaited.
- The initial Codex OAuth opened the default browser and selected another existing localhost session. The assistant correctly stopped because the synthetic Project was absent. Switching the test origin to 127.0.0.1 isolated cookies, and the actual fixture consent then let Codex list the correct Project. Noninteractive write calls were initially cancelled by client approval settings; the scoped certification rerun still has an access failure under investigation. No media ingestion claimed yet.
- Current temporary dev SITE_URL is http://127.0.0.1:3910 (replacing the earlier localhost test origin). Original value remains http://localhost:3000, and CHATGPT_IMPORT_ENABLED must be removed after certification.
- Standards re-read the Claude DCR correction, synthetic seed and Inbox action extraction without a new actionable finding (static review, no test rerun).

- Real Codex CLI source-page-to-Inbox certification succeeded on 2026-09-10: one migration, one batch, three imported Pending testimonials, no duplicates/conflicts/blocked/failed items. Original text and identity survived; portrait copied Ready. Public and local videos both reached Ready through the actual Mux webhook, each measured 2,848,208 bytes and 5.766667 seconds with importedFileVerified=true. The local file was actually sent by the generated Node helper using the scoped capability. A separate read-only database check confirmed all three moderationStatus=pending and no author consent fabricated. Local job qn7e0j987vm3np4c1shz4ymqh98e4m3y belongs solely to the synthetic fixture.
- Codex's temporary helper launch initially hit a cleanup-command policy refusal and an incorrect temporary extension; the client recovered safely with private temporary files and an .mjs helper, then reported complete bytes and read the authoritative Ready states. No mock transfer or status was used.
- Doctor now reports only three serial transaction-loop warnings (79/100 versus a175 80/100). Independent query reads and Inbox component complexity were corrected; the remaining loops intentionally observe prior writes. Numerical score discrepancy still needs assessment before delivery; no suppression was added.

- Final #117 local pnpm check passed: formatting, lint, TypeScript, 157 files / 891 tests, and production build. Full browser suite is running. Spec re-read the final DCR/Inbox/insert changes without a new actionable finding.
- Certification cleanup completed: development SITE_URL restored to http://localhost:3000, CHATGPT_IMPORT_ENABLED removed, both temporary CLI MCP servers and their local OAuth credentials removed, five exact test DCR clients disabled. The original checkout and port 3000 process were untouched. Synthetic Pending records remain only in the development fixture Project; no production deployment or merge occurred.
- Independent item insertion was parallelized while preserving positions and awaiting all rows before transaction confirmation; focused tests passed. Doctor now has only two known serial read-after-write transaction warnings. No newly introduced UI diagnostic remains; numerical 79 versus baseline80 is recorded rather than weakening atomic reservation semantics or suppressing rules.

- Clean clone of e0a7474 installed from the frozen lockfile and passed pnpm check (157 files / 891 tests and build), including generation of the standalone transfer helper without local secrets.
- The first final browser invocation incorrectly reused the other checkout's port3000 server; it was stopped and its result discarded. The isolated3912 run exposed the known synthetic Mux-event race plus real mobile overflow after the gallery adopted the actual Inbox actions. The loader test now isolates explicit lifecycle events from asynchronous HLS events; 15 repetitions passed across all five browser configurations. PageHeader bounds its action wrapper to the available width; the existing four-tab no-overflow test changed from393→540px failure to passing all five configurations. The full suite is rerun after both fixes; no failed run is counted as delivery evidence.
- The gallery now reuses InboxImportActions, ensuring new MCP navigation appears in actual canonical Inbox captures. Standards reviewed the fixture/test changes without an actionable finding.
