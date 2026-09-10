## Parent

#110

## What to build

An assistant migrates a long supplied page in batches, can recover after interruption, and receives accurate created/skipped/conflicted results without duplicating or overwriting existing proof.

## Acceptance criteria

- [ ] Accept at most 50 records per submission and bound payload size; return explicit validation errors for excess.
- [ ] Support successive batches with per-item outcomes and a truthful overall result; setup/tool instructions announce the discovered count.
- [ ] Concurrent replay and retries are idempotent for records and associated scheduled work, including after a client disconnect.
- [ ] Skip certain duplicates and report their count within the selected Project; prevent cross-tenant data disclosure.
- [ ] Flag identifiable changed source items as conflicts, retaining the existing Testimonial without automatic duplication or overwrite.
- [ ] Do not guess identity from ambiguous matching; make unresolved source-identity cases explicit.
- [ ] Test batches, partial errors, concurrent replay, changed source data and session interruption at the public operation boundary.
- [ ] Relevant local checks, Standards/Spec review and required remote CI succeed on the delivered PR head; synchronize checklists only with proven evidence.
- [ ] For visible changes, inspect and publish current-head desktop/mobile screenshots via gh-image and update the gallery review status.

## Blocked by

- #111

## Implementation context

Read #110 in full. Reuse verified existing wall-import and media infrastructure; do not merge the uncommitted OpenAI website-analysis draft wholesale. Preserve unrelated local work and secrets. Implement this as a complete behavior slice, not an isolated layer. Existing #97–#102 remain separate.
