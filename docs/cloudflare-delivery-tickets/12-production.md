# 12. Execute approved Cloudflare cutover and verify delayed source cleanup

## Parent

#168 — Independent Cloudflare delivery for Walls, Widgets and product media. This ticket implements stories 29, 30, 31, 35. The full parent contract and accepted delivery decisions apply.

## What to build

After explicit target-specific production approval, the operator cuts over validated public delivery and verifies removal of retained Convex source media after seven days.

## Acceptance criteria

- [ ] Obtain explicit Owner authorization for the concrete production targets, routing changes, provider costs and migration run described by the certified runbook. This ticket is an execution gate, not standing permission.
- [ ] Revalidate targets, current application/publication revisions, provider configuration, budget envelope, inventory and rollback immediately before execution; preserve unrelated work and stop on drift.
- [ ] Execute bounded copy/verification, compatible routing/publication activation and smoke checks with exact release and migration IDs. All public cold/miss/error paths remain independent of Next.js/Convex.
- [ ] Confirm existing installed sites and hosted links, private dashboard/collection and privacy deletion across both providers. Roll back through the certified path if stop conditions occur.
- [ ] Start the seven-day source-retention clock only after validated cutover. Verify the deletion workflow can purge both sources immediately for actual withdrawals during retention.
- [ ] After the real seven-day interval, verify eligible legacy sources are unreferenced, execute authorized delayed cleanup, and reconcile bytes/counts against the migration ledger. Do not simulate elapsed time or close this criterion from a scheduled-job definition alone.
- [ ] Record authoritative deployed state, post-cutover cost/health observations and final cleanup evidence; leave the issue open while approval, elapsed retention or verification is outstanding.

## Blocked by

- #70

## Implementation workflow

Use /implement with /tdd at the agreed publication/delivery, media lifecycle and browser seams, then /code-review on both Standards and Spec. Consult current Context7/provider docs and repository Convex/Next.js guidance when applicable. Use the relevant Cloudflare, Convex, React and visual-evidence skills; publish current-head screenshots through gh-image for visible changes. Record real local/remote gates and keep unproven checkboxes open. Preserve unrelated work in an isolated codex worktree. This issue does not authorize merging, new paid services or production changes; the separate execution gate carries production approval and elapsed-retention requirements.
