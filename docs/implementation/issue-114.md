## Parent

#110

## What to build

An assistant submits a public direct video-file URL, and Convex/Mux completes the copy after the assistant closes. The Inbox distinguishes processing, ready, failed and capacity-blocked items.

## Acceptance criteria

- [ ] Accept safe public direct video-file URLs beyond the current Mux-only source restriction; reject private/unsafe destinations and invalid redirects.
- [ ] Enforce 512 MB and 600 seconds on actual imported media, retaining the 120-second collection limit.
- [ ] Support video-only Testimonials without generating quotes; preserve supplied metadata and source link on failure.
- [ ] Reserve Account video capacity atomically before transfer; if insufficient, eligible text proceeds and videos wait for the Owner's selection without arbitrary transfer.
- [ ] Persist per-item workflow state independently from MCP request lifetime and prevent duplicate assets on replay/webhooks.
- [ ] Only Ready assets become publishable; moderation remains Pending unless changed separately by the Owner.
- [ ] Use at most three total attempts for transient failures; permanent source/format errors are actionable without pointless retries.
- [ ] Finish already accepted reserved copies after entitlement expiry while refusing new imports under existing eligibility/grace rules.
- [ ] Verify true direct-source ingest in development, quota races, over-limit/invalid media, closure recovery and accurate Inbox states.
- [ ] Relevant local checks, Standards/Spec review and required remote CI succeed on the delivered PR head; synchronize checklists only with proven evidence.
- [ ] For visible changes, inspect and publish current-head desktop/mobile screenshots via gh-image and update the gallery review status.

## Blocked by

- #111
- #113

## Implementation context

Read #110 in full. Reuse verified existing wall-import and media infrastructure; do not merge the uncommitted OpenAI website-analysis draft wholesale. Preserve unrelated local work and secrets. Implement this as a complete behavior slice, not an isolated layer. Existing #97–#102 remain separate.
