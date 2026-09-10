## Parent

#110

## What to build

When an assistant has a local video file, it obtains an authorized upload destination and transfers the bytes into the same import workflow, with Inbox file upload as a fallback.

## Acceptance criteria

- [ ] Provide an expiring upload capability scoped to an owned import item and permitted media operation; keep bytes out of MCP JSON.
- [ ] Upload actual file bytes rather than sending a local path to Convex; validate completion against the authorized provider asset.
- [ ] Enforce the same capacity, 512 MB, ten-minute, paid-access and Pending/Ready rules as URL imports.
- [ ] Reject cross-Owner, forged, expired and replayed completion; avoid duplicate assets or leaked reservations on interruption.
- [ ] Support replacing the missing/failed video for the existing Pending import from the Inbox without creating a duplicate Testimonial.
- [ ] Document and verify at least one real supported assistant local-file transfer path; retain browser upload fallback where command execution is unavailable.
- [ ] Test successful upload, interruption, expiration, wrong-item completion and file replacement through public behavior.
- [ ] Relevant local checks, Standards/Spec review and required remote CI succeed on the delivered PR head; synchronize checklists only with proven evidence.
- [ ] For visible changes, inspect and publish current-head desktop/mobile screenshots via gh-image and update the gallery review status.

## Blocked by

- #114

## Implementation context

Read #110 in full. Reuse verified existing wall-import and media infrastructure; do not merge the uncommitted OpenAI website-analysis draft wholesale. Preserve unrelated local work and secrets. Implement this as a complete behavior slice, not an isolated layer. Existing #97–#102 remain separate.
