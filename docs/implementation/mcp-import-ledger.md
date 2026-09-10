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

## Remaining gates

All issue checkboxes remain unchecked. Implementation, negative/recovery tests, real-client checks, Standards/Spec review, current-commit desktop/mobile evidence, PR creation and remote CI are still in progress. No ticket is delivered yet. Do not infer delivery from passing unit tests.
