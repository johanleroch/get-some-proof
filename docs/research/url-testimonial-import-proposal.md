# Import a testimonial wall by URL

Approved direction: owner answered "Oui" to round 1 and "go" to the full proposal and round 2 recommendations. Proceed with the five proposed vertical slices and public-operation/browser testing boundaries. Provider feasibility remains a required implementation proof, not an assumption of support.

## Problem Statement

A small brand already has customer testimonials in a Senja or Testimonial.to wall. Re-entering authors, text and videos makes trying Get Some Proof costly. A person discovering the product through ChatGPT should be able to see what can be imported before committing to a migration.

## Approved scope

- Get Some Proof product journey plus a ChatGPT acquisition entry.
- Public Senja and Testimonial.to wall URLs.
- Senja's screen sequence and interactions, expressed using Get Some Proof's design system.
- Complete discovery, specification, tickets and implementation through the requested /ask-matt flow; no production deployment authorization is implied.

## Solution

Provide one shared import service for the product and ChatGPT. A visitor supplies a supported wall URL, previews extracted testimonials, chooses items, connects or creates an account when saving them, and chooses a destination Project. An existing Owner enters from their Project and does not repeat onboarding.

The first release copies a snapshot rather than maintaining synchronization. Original citations and identities are preserved. Imported proof records its actual provenance and publication basis, distinct from Collection Form consent.

## screen contract

The Owner reiterated on 2026-09-09 that `DESIGN.md` is authoritative for this screen. Use Gelica/Figtree typography, warm paper and surface tokens, the single Proof Amber accent, shared form/button/checkbox primitives, list dividers instead of stacked cards, and the prescribed desktop/mobile spacing. Senja defines the journey, not the visual styling. Keep the new `/screens` review entry unapproved until desktop/mobile evidence is inspected.

1. **Import entry.** Left-aligned title and explanation; Senja and Testimonial.to source choices. GSP sidebar for authenticated Owners. Public acquisition entry for visitors. No inactive cards advertising unimplemented formats.
2. **URL entry.** Label, provider-specific example, input, primary action. Empty input disables submission. Explain unsupported URL and inaccessible/private wall without losing input. Auto-detect the supported source from the URL; source choice helps discovery rather than requiring duplicate entry.
3. **Reading the wall.** Stable progress state, accessible status, cancel/back action. Bounded retrieval; no misleading percentage without measured progress. Distinguish a private wall, no testimonials, a provider change and a temporary retrieval failure.
4. **Preview and selection.** Follow the verified Senja reference: wide selectable rows, author/avatar/tagline at left, quotation centrally and optional video thumbnail at right. A header provides filters and select-all; a fixed bottom action bar shows the selected count, clear selection and confirmation. On mobile, stack those regions within each row. Select individual items or all eligible items. Separate already-imported and unavailable items. Show selected count and plan capacity before confirmation. Allow correcting extracted identity metadata while preserving original source snapshot. Do not rewrite testimonial claims.
5. **Save destination.** Visitors sign up/sign in and resume the same preview; authenticated Owners use the current Project or explicitly select another Project they own. Display the actual eligible item count after applying account entitlements. No cross-account sharing of private preview data.
6. **Import progress.** Persist a job so refresh/retry cannot duplicate records. Text may finish while video is processing. Display imported, skipped and failed counts independently. Retry failed items only.
7. **Result.** Accurate totals, explanations for skipped/failed items and a link to the imported selection in the Inbox. No automatic publication in the recommended model. Preserve the job result so reload does not restart migration.

ChatGPT should expose the same meaningful stages: URL input, interactive preview/selection, explicit save and result. Opening an external product page must preserve the user's work. It must not simply advertise an unrelated signup link or claim completion before the import service reports it.

## user stories

1. As a visitor, I want to paste my existing wall URL so I can evaluate migration without retyping proof.
2. As an Owner, I want the same action in my Project so I can reuse my existing account.
3. As a ChatGPT user, I want to preview my wall's importable testimonials in conversation so I can decide whether to save them.
4. As a visitor, I want signup to preserve my preview so I do not repeat the import setup.
5. As an Owner, I want to choose the destination Project so proof is attributed to the correct Brand.
6. As an Owner, I want a preview of each quotation and author so I can catch extraction errors.
7. As an Owner, I want individual and bulk selection so I control what is copied.
8. As an Owner, I want text and video support so migration preserves the forms of proof I already use.
9. As an Owner, I want inaccessible media identified before or during import so a partial result is understandable.
10. As an Owner, I want repeated imports to skip identical source entries so I do not create duplicates.
11. As an Owner, I want a changed source entry flagged rather than silently overwriting my stored proof.
12. As an Owner, I want import capacity shown before saving so I can make a valid selection.
13. As an Owner, I want imported proof held for review so copying does not publish content unexpectedly.
14. As an Owner, I want to record my authority to republish proof without fabricating submitter consent.
15. As an Owner, I want failed video copies retryable without copying successful items again.
16. As an Owner, I want refresh or interrupted navigation to preserve job progress.
17. As an Owner, I want imported proof to use the existing wall and embed publication lifecycle.
18. As a person represented in imported proof, I want a working removal route and prompt removal from public surfaces.
19. As an Owner, I want deletion to clean up copied media and release applicable storage capacity.
20. As an Owner, I want source provenance retained privately and public attribution defined explicitly.
21. As an operator, I want acquisition, preview, save and first-publication events measured without collecting whole ChatGPT conversations.
22. As a keyboard or mobile user, I want the same complete selection and error-recovery workflow.

## implementation decisions

- A shared orchestration boundary serves the website and ChatGPT adapter; the adapter cannot bypass authentication, ownership, quotas or publication requirements.
- Each provider adapter produces normalized candidates with a stable source identity, source URL, content snapshot, public author fields and retrievable media references.
- Supported URL shapes and retrieval mechanisms need live feasibility evidence for both providers before being promised. Public visibility alone does not establish a stable import interface.
- Remote fetches must be bounded and protect against requests to private network targets, unsafe redirects and excessive media/page sizes.
- Anonymous previews need expiration and abuse limits. Claiming a preview after authentication requires a secure possession mechanism; job identifiers alone cannot grant access.
- An import job belongs to an Account and destination Project after claim. Item outcomes and media states are persisted and retries are idempotent.
- Unchanged provider entries are skipped. Changed entries are surfaced for review; the initial release does not silently overwrite existing proof.
- Imported proof has an explicit origin and owner-attested publication basis. Legacy collected proof keeps its existing versioned consent and submission-management behavior.
- Do not synthesize submitter emails, management tokens or Collection Form consent records to satisfy legacy required fields.
- Video copies use the existing media processing lifecycle. An inaccessible video is reported as a failed item, never represented as a ready hosted asset.
- Recommended imports remain Pending until the Owner explicitly publishes eligible items.
- Imported text consumes no Collection Credits. Free publication is capped at 13 text and 2 video Testimonials across the Account; imported and collected proof share that publication capacity. Pro text publication remains unlimited. Hosted imports use the plan video storage capacity (Free 2, Pro 25), counting reservations and pending cleanup. Enforce capacity atomically, including downgrade paths. Bound previews to 100 items per retrieval page and present truncation/pagination explicitly; never claim unseen items were imported.
- The original source being deleted after a one-time import does not silently mutate stored proof. Takedown and ownership-request handling must have a defined route independent of the source URL.
- ChatGPT distribution requires its own test, submission and publication evidence. Working in developer mode does not prove public availability or acquisition.

## testing decisions

Test at the import service's public operations: preview, claim, select/confirm, query result, retry, publish and delete. Reuse existing Convex behavior tests for identity isolation, quota races and public projection. Keep provider fixture tests for extraction fidelity; do not rely on volatile third-party pages for routine CI.

Browser tests cover URL-to-Inbox for both provider families, selection, signup resume, partial failure and mobile/keyboard behavior. A ChatGPT adapter contract test proves the same authorization and state transitions; an actual developer-mode interaction proves its rendered user experience.

Negative cases include another Owner's job ID, malicious URL/redirect, duplicate confirmation, expired preview, quota contention, failed media, missing publication basis and source content containing instructions.

Completion requires meaningful local checks, targeted desktop/mobile evidence, Standards/Spec review and remote CI success on the PR head. Public ChatGPT listing, if part of the agreed release gate, additionally requires authoritative publication status.

## ticket breakdown for review

1. **Import a Testimonial.to text wall into a Project.** No blockers. Complete URL, extraction, preview/selection, provenance, agreed quota handling, Pending result and behavior tests. Include the shared import service used by subsequent slices.
2. **Import a Senja text wall through the same flow.** Blocked by 1. Add the second provider with real-source feasibility evidence, source-specific errors and shared duplicate handling.
3. **Copy wall videos with recoverable partial imports.** Blocked by 1 and 2. Video processing, reservations, progress, failure/retry and deletion semantics for both providers.
4. **Let visitors preview and resume import after signup.** Blocked by 1 and 2. Public entry, expiring preview, safe claim, Project selection and acquisition measurement; remains compatible with video slice.
5. **Complete the same import from ChatGPT.** Blocked by 3 and 4. Interactive steps, account connection, explicit confirmation, results and developer-mode proof; prepare the public listing submission within authorized release scope.

Every slice must include its own applicable tests, review and remote checks. A final checklist reconciles both entry surfaces against the full source contract rather than accepting only the first slice.

## Out of scope of this URL-wall proposal

- Generic web-page extraction, YouTube clipping, CSV, manual text/image imports and social mention discovery remain separate work under the broader discovery roadmap.
- Continuous source synchronization is not in the recommended snapshot model.
- Rewriting client claims or generating testimonials.
- Copying Senja branding, fonts or assets.

## Delivery evidence still needed

- Round 2 accepted: hosted videos, one-time copy, Pending imports with owner reuse attestation, imported text outside Collection Credits. Validate the publication/storage limits stated above against the complete behavior tests.
- Provider feasibility for actual public walls, and live visual inspection of the remaining Senja preview/result screens.
- Implement anonymous preview with sign-in to persist/claim; verify signup resume and cross-account isolation. Complete ChatGPT developer-mode testing and submit a production-ready listing. Record external review separately; public availability is not complete until publication is verified. Production credentials/deployment and external account permission grants remain explicit gates when required.
- Five-ticket breakdown and testing boundaries presented in this proposal accepted by the owner’s "go". Publish tickets with explicit dependencies; leave #42 open because its other input formats remain outside this URL-wall delivery.

Reference: https://github.com/johanleroch/get-some-proof/issues/42 and https://support.senja.io/can-i-migrate-to-senja-from-testimonialto-2gj2c
