# URL testimonial import — discovery evidence

Status: rounds 1 and 2 approved by the owner ("Oui", then "go"). Specification/ticket publication and implementation in progress.
Requested workflow: /ask-matt, following Senja's URL import screens.
Inspected baseline: f45921a27d2a8bef8f5a3522be09b9d2dc6ca7fd, 2026-09-09.
Existing discovery issue: https://github.com/johanleroch/get-some-proof/issues/42

## Observed Senja flow

Live authenticated UI inspected using browser accessibility and screenshot on 2026-09-09.

- `/import`: heading “Add proof to your account”, five routes: Auto-import, Import from web, Upload spreadsheet, Manual import, Migrate.
- Import from web and Migrate are separate routes. Do not conflate generic URL extraction with wall migration.
- `/import/migrate`: heading “Migrate”; explanatory sentence; selected Testimonial.to provider; “Request another” link; URL field labelled “Enter the link to your Testimonial.to Wall of Love”; placeholder `https://testimonial.to/[username]/all`; example `https://testimonial.to/testimonial/all`; disabled Import testimonials button while empty.
- Layout reference: existing sidebar, left-aligned title/provider controls, wide URL form panel underneath. The Owner explicitly chose `DESIGN.md` for the new screen: Senja informs the journey, while Get Some Proof supplies the typography, tokens, shared controls and responsive layout. Desktop/mobile and light/dark review remain required before marking the screen approved.
- Source documentation describes the next step: preview page, select testimonials, confirm import, then see them in the dashboard. The preview/result screens have not yet been inspected live. No import was executed against the user's Senja account.
- Documentation says public wall migration imports visible text and video testimonials; private/non-wall entries require other methods.

Primary reference: https://support.senja.io/can-i-migrate-to-senja-from-testimonialto-2gj2c
The three image links in that article returned fetch errors/403; they are not verified visual evidence.

## Current GSP constraints

Read-only repository investigation found no import UI, import job tables, source provenance, provider IDs, or deduplication model. Existing video flow uses direct uploads rather than URL ingestion.

- `convex/schema.ts`: testimonials currently require collection-specific submitter email, management-token hash and client submission ID.
- `convex/publicProjection.ts`: publication requires a versioned publication-consent record; hosted video must be ready.
- `convex/collectionQuotas.ts`: existing collection/storage allowances cannot silently determine migration allowance without a product decision.
- `src/components/testimonials/testimonial-inbox.tsx`: existing moderation list is a possible destination for imported proof.
- Issue #42 explicitly covers discovery/specification; implementation must use the resulting approved specification/tickets.

Import must not fabricate a submitter email or pretend the original submitter completed the GSP collection/consent flow.

## Open decision frontier

Round 1 approved by the owner ("Oui"):

1. Delivery surface: GSP plus a ChatGPT acquisition entry.
2. Supported sources: public Senja and Testimonial.to walls.
3. Screen fidelity: same steps/interactions in GSP design.

Round 2 recommendations approved by the owner:

4. Import text and hosted video copies; report inaccessible video items individually (recommended), versus external references or text-only.
5. One-time snapshot, preview/select, skip duplicates, Pending on import and explicit owner reuse attestation before publication (recommended), versus immediate publication or continuous sync.
6. Imported text does not consume collection credits, but remains subject to plan publication limits; video follows plan storage capacity (recommended), versus counting imports as collections. The precise Free publication allowance must be stated in the final specification rather than assumed from an existing import entitlement.

Follow-up decisions depend on those answers: text/video scope, source retrieval and fallback, account requirement, preview selection, reuse authority/publication basis, quotas, duplicate handling, one-time copy versus sync, partial failures, and success destination.

Working proposal: `url-testimonial-import-proposal.md`. It separates approved scope from recommendations and remaining provider feasibility evidence.

## Completion evidence still required

- Owner-confirmed shared understanding per grilling workflow.
- Verified remaining Senja reference screens or explicit evidence limitation.
- Approved specification with source limits, states, domain invariants and acceptance criteria.
- Dependency-ordered implementation tickets.
- Implemented authorized scope, targeted UI proof, local checks, Standards/Spec review and successful remote checks per delivery gate.
- Accurate tracker checklists and final PR evidence.

## Screenshot evidence — 2026-09-09

Recovered and visually inspected all three original documentation screenshots through the rendered article asset inventory. Earlier direct-download 403 errors are resolved for these artifacts. Local reference gallery: `.scratch/senja-import-reference/index.html`; source manifest alongside it.

The documented preview uses full-width rows: author/avatar and tagline on the left, quotation centrally, optional video thumbnail on the right, selection control at the row edge. Header has Filters and select-all; bottom fixed bar shows selected count, clear selection, Add a tag and Import testimonials. Source screenshot contains three selected testimonials.

The connected-session migration URL screen was captured locally. Live preview has not been reproduced: browser control detached and subsequent page loading remained blank. No testimonial was imported into the user account. Do not label the documentation preview as a live test.
