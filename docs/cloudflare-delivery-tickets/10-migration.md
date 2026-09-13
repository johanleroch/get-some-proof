# 10. Rehearse complete media migration and seven-day rollback retention

## Parent

#168 — Independent Cloudflare delivery for Walls, Widgets and product media. This ticket implements stories 17, 28, 29, 30, 31, 35. The full parent contract and accepted delivery decisions apply.

## What to build

The operator can inventory, dry-run, migrate and roll back a representative existing Project in staging without broken proof, unsafe retained copies or loss of export/restore.

## Acceptance criteria

- [ ] Create a read-only inventory covering all existing image/font types, generated thumbnails, hosted/embedded consumers and old source references. Report exact targets, counts/bytes and capability gaps without secrets.
- [ ] Implement bounded resumable copy/verification/activation with per-asset checkpoints, checksums, metadata and unchanged-source checks. Retry safely after interruption and preserve mixed-provider compatibility until cutover.
- [ ] Rehearse concurrent replacement, deletion, withdrawal, Project/Account erasure and failed copies; no stale job may recreate source content or activate an unverified object.
- [ ] Preserve existing integrations with approved domains and verified Cloudflare routes. Do not turn observed referrers into an automatic allowlist.
- [ ] Retain original Convex media for seven days after a validated cutover marker, not after the first copy. Withdrawal or explicit deletion cleans both providers without waiting; scheduled cleanup rechecks live references and ownership.
- [ ] Rehearse rollback including post-cutover R2-only uploads/replacements: runtime rollback remains on Cloudflare and content remains reachable through valid authorized references.
- [ ] Verify exports/restores and produce a concrete target-specific cutover/rollback/delayed-cleanup runbook with stop conditions, cost envelope and evidence ledger. Production execution is a separate issue and is not authorized here.
- [ ] Pass migration fault/race tests, staging end-to-end evidence, fresh-clone/local/review/current-head CI gates; keep actual production migration and post-seven-day cleanup unchecked.

## Blocked by

- #67

## Implementation workflow

Use /implement with /tdd at the agreed publication/delivery, media lifecycle and browser seams, then /code-review on both Standards and Spec. Consult current Context7/provider docs and repository Convex/Next.js guidance when applicable. Use the relevant Cloudflare, Convex, React and visual-evidence skills; publish current-head screenshots through gh-image for visible changes. Record real local/remote gates and keep unproven checkboxes open. Preserve unrelated work in an isolated codex worktree. This issue does not authorize merging, new paid services or production changes; the separate execution gate carries production approval and elapsed-retention requirements.
