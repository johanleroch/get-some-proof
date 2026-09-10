## Parent

#110

## What to build

An Owner and assistant can understand and finish a mixed import: text succeeds, photos/videos fail or are capacity-blocked, and only missing work is resumed.

## Acceptance criteria

- [ ] Show accurate created, duplicate, conflict, processing, ready, blocked and failed outcomes without claiming a referenced video was copied.
- [ ] Keep failed video Testimonials in Pending with identity, portrait, optional text and source link; expose retry and file replacement.
- [ ] Allow selection of the videos that fit current capacity; recheck and reserve atomically when resuming.
- [ ] Retries operate only on eligible failed work, preserve successful assets and respect the bounded automatic-attempt policy.
- [ ] Store page/media provenance, date and outcomes; show useful user errors with safe technical diagnostics separately.
- [ ] Public projection never exposes private import diagnostics/capabilities and non-Ready video cannot be published.
- [ ] Verify a mixed end-to-end import, partial recovery, duplicate resubmission, expiration and entitlement changes with durable behavior tests and inspected desktop/mobile UI.
- [ ] Relevant local checks, Standards/Spec review and required remote CI succeed on the delivered PR head; synchronize checklists only with proven evidence.
- [ ] For visible changes, inspect and publish current-head desktop/mobile screenshots via gh-image and update the gallery review status.

## Blocked by

- #112
- #113
- #114
- #115

## Implementation context

Read #110 in full. Reuse verified existing wall-import and media infrastructure; do not merge the uncommitted OpenAI website-analysis draft wholesale. Preserve unrelated local work and secrets. Implement this as a complete behavior slice, not an isolated layer. Existing #97–#102 remain separate.
