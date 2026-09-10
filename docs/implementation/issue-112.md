## Parent

#110

## What to build

An assistant imports the explicit original testimonial content and author details, and the Owner sees the faithful result in the Inbox including a safely copied portrait.

## Acceptance criteria

- [ ] Preserve original words and Highlights without accepting arbitrary unsafe markup or rewriting claims.
- [ ] Support explicit author name, role/company, individual rating and portrait; leave absent fields unset.
- [ ] Do not convert page-wide ratings into individual ratings or conflate portrait and video Thumbnail; describe these requirements in the tool contract.
- [ ] Copy public portrait URLs through bounded safe fetching with redirect/private-network protection and image validation.
- [ ] A portrait failure preserves the Testimonial and has an actionable per-item outcome; retries must not duplicate it.
- [ ] Store source provenance while keeping sensitive diagnostics out of public projections.
- [ ] Test realistic mixed metadata, malicious media URLs, portrait failure/retry and displayed fidelity.
- [ ] Relevant local checks, Standards/Spec review and required remote CI succeed on the delivered PR head; synchronize checklists only with proven evidence.
- [ ] For visible changes, inspect and publish current-head desktop/mobile screenshots via gh-image and update the gallery review status.

## Blocked by

- #111

## Implementation context

Read #110 in full. Reuse verified existing wall-import and media infrastructure; do not merge the uncommitted OpenAI website-analysis draft wholesale. Preserve unrelated local work and secrets. Implement this as a complete behavior slice, not an isolated layer. Existing #97–#102 remain separate.
