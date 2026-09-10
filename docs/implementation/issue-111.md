## Parent

#110

## What to build

An Owner connects an ordinary model MCP client, activates import with a reuse-rights attestation, chooses an owned Project and imports a source-backed text Testimonial directly into the Inbox. This is a complete first path through authorization, MCP, persistence and visible Pending state.

## Acceptance criteria

- [ ] Authenticate and enforce paid eligibility on the server; reject anonymous, Free, revoked and wrong-Owner calls.
- [ ] Expose model-callable import, destination and own-import status operations without embedded-app-only state.
- [ ] Select a sole Project automatically; require an identified choice among multiple Projects.
- [ ] Record the one-time rights attestation separately from author Publication Consent and preserve source page/date.
- [ ] Save original text directly as Pending after explicit import intent; return an accurate status and Inbox link without publishing.
- [ ] Connection capabilities exclude publication, deletion and unrelated record editing; revocation is enforceable.
- [ ] Preserve the existing provider wall and ChatGPT import paths; reuse existing import accounting and tenancy rules.
- [ ] Prove the complete operation and negative authorization cases through MCP and Convex behavior tests, plus Inbox evidence.
- [ ] Relevant local checks, Standards/Spec review and required remote CI succeed on the delivered PR head; synchronize checklists only with proven evidence.
- [ ] For visible changes, inspect and publish current-head desktop/mobile screenshots via gh-image and update the gallery review status.

## Blocked by

None — can start immediately.

## Implementation context

Read #110 in full. Reuse verified existing wall-import and media infrastructure; do not merge the uncommitted OpenAI website-analysis draft wholesale. Preserve unrelated local work and secrets. Implement this as a complete behavior slice, not an isolated layer. Existing #97–#102 remain separate.
