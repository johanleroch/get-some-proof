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

## Remaining gates

All issue checkboxes remain unchecked. Implementation, negative/recovery tests, real-client checks, Standards/Spec review, current-commit desktop/mobile evidence, PR creation and remote CI are still in progress. No ticket is delivered yet. Do not infer delivery from passing unit tests.
