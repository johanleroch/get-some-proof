# 11. Certify Cloudflare delivery isolation, lifecycle and operating budget

## Parent

#168 — Independent Cloudflare delivery for Walls, Widgets and product media. This ticket implements stories 1–38. The full parent contract and accepted delivery decisions apply.

This updates the existing delivery ticket under the new #168 contract; its former #65 delivery assumptions are superseded. Preserve the historical implementation evidence and unrelated Studio work.

## What to build

All supported public surfaces are certified in staging with no application visitor reads, correct lifecycle behavior, an operating cost envelope and a reviewable production release package.

## Acceptance criteria

- [ ] Use the new parent specification instead of the old #65 Vercel-origin/300-second contract. Preserve #66's established security requirements and reconcile existing #68/#69 delivered UI evidence without treating those legacy tickets as new blockers.
- [ ] Maintain an acceptance ledger for every parent story and every child criterion, with exact base/head, environment and proof source. Distinguish implementation, staging certification, approval and actual production state.
- [ ] Demonstrate complete cold/warm resource graphs without Next.js/Convex visitor calls across hosted Wall, hosted Widget, cached legacy v1, v2, all templates, media, fonts, pagination, errors and alternate hosts.
- [ ] Warm stale copies and test every lifecycle family, out-of-order/unknown-result publishing, accepted propagation, 24-hour new-request validity/renewal, no polling/auto-clear, direct media denial and seven-day source cleanup overrides.
- [ ] Demonstrate targeted admission/suspension/recovery and a full measured cost ledger at representative traffic, media/cache ratios and renewal populations. Validate the EUR 10–20 initial Cloudflare-only workload envelope or report a concrete unresolved blocker rather than silently expanding budget.
- [ ] Complete representative migration/rollback/export/restore rehearsal, existing-domain transition and secret placement/rotation documentation. Final DNS/routes/provider targets and rollback must be concrete before any production approval is requested.
- [ ] Pass required local checks, clean-clone validation, independent Standards+Spec review, current-head remote CI and targeted desktop/mobile gh-image evidence. Known baseline failures remain explicitly separate and required failures remain unresolved.
- [ ] Deliver a production-execution issue/runbook gated on Owner authorization. Leave this spec and production-execution criteria open until their actual conditions are met; no claim of live migration or cleanup from staging results.

## Blocked by

- #177

## Implementation workflow

Use /implement with /tdd at the agreed publication/delivery, media lifecycle and browser seams, then /code-review on both Standards and Spec. Consult current Context7/provider docs and repository Convex/Next.js guidance when applicable. Use the relevant Cloudflare, Convex, React and visual-evidence skills; publish current-head screenshots through gh-image for visible changes. Record real local/remote gates and keep unproven checkboxes open. Preserve unrelated work in an isolated codex worktree. This issue does not authorize merging, new paid services or production changes; the separate execution gate carries production approval and elapsed-retention requirements.
