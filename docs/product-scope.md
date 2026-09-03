# Get Some Proof MVP product scope

**Status:** Approved by the product owner on 2026-09-03.

This document records the product decisions accepted during the MVP grill. The implementation specification is tracked in [GitHub issue #1](https://github.com/johanleroch/get-some-proof/issues/1) and must be explicitly approved before implementation tickets are created or work begins.

## Positioning and audience

- Product: **Get Some Proof**.
- Positioning line: **Your site needs proof. Get some.**
- Primary audience: solo independents, coaches, consultants, creators, and small agencies collecting proof for their own brand.
- MVP mental model: one Owner, one Brand, one Workspace.
- The product is not an agency console for managing multiple client subaccounts.
- Product UI and default copy are English-only in the MVP. Testimonial videos may use other supported spoken languages for caption generation.

## MVP outcome

An Owner can configure one branded Collection Form, share it, receive one text or video Submission with explicit Publication Consent, moderate the resulting Testimonial, and make Published proof appear on both a hosted Public Wall and an iframe-free Embedded Wall.

The tracer-bullet journey is:

1. Sign up and configure the Brand.
2. Copy the Collection Form URL.
3. Submit text or video proof as a visitor.
4. Receive the Testimonial as Pending.
5. Publish it from the Inbox.
6. See it on the Public Wall and Embedded Wall.
7. Encounter truthful Free limits and upgrade to Pro.

## Product surfaces and routes

- Marketing homepage and authentication.
- Private Owner dashboard and Inbox.
- Brand, Collection Form, wall, embed, billing, account-security, and deletion settings.
- `/c/<public-slug>`: public Collection Form.
- `/w/<public-slug>`: hosted Public Wall.
- A versioned static embed runtime and public-safe wall endpoint.
- Stripe Checkout for upgrade and Stripe Customer Portal for subscription management.

An authenticated visitor to the marketing homepage may be redirected to the dashboard.

## Authentication, tenancy, and onboarding

- Reuse the starter's Better Auth identity, verified-email requirement, secure organization tenancy, RBAC, and audit foundations.
- Hide teams, roles, invitations, organization switching, and multiple workspaces from the MVP interface.
- After verified signup, onboarding asks for:
  1. Brand name and an available proposed Public Slug;
  2. optional logo and primary color;
  3. Collection Form title, description, and required privacy contact.
- The configured Collection Form URL is immediately available to copy from the dashboard.
- The Brand name proposes the Public Slug. A collision must be resolved before creation.
- The Owner may change the Public Slug once. The change immediately breaks old collection, wall, and embed URLs, releases the former slug for reuse, and creates no redirect.

## Collection Form

### Configuration

- One Collection Form per Workspace.
- Owner customization: title, description, optional logo, and primary color.
- Owners cannot add, remove, or rearrange fields in the MVP.
- Link to a hosted Brand-specific privacy notice by default.
- The Owner may replace the hosted notice with its own privacy-policy URL.

### Visitor journey

The responsive form uses four short stages:

1. Choose exactly one Submission type: text or video.
2. Write the text or record/import the video.
3. Provide identity, age confirmation, and Publication Consent.
4. See success confirmation.

No partial Submission is retained.

### Fields

- Required: Submitter name.
- Required but always private: Submitter email.
- Required: confirmation that the Submitter is at least 18 years old.
- Required: unticked Publication Consent.
- Optional: avatar/photo.
- Optional: role and company.
- Optional: star rating.
- Text Submission: testimonial text between 20 and 2,000 characters.
- Video Submission: one recorded or imported video up to two minutes.
- Video Submission: spoken-language selection for Generated Captions.

The MVP does not block a Submission on email verification. A failed confirmation-email delivery does not remove an otherwise valid Submission.

### Exhausted limits

- Disable only the exhausted Submission type while the other remains available.
- When both Free limits are exhausted, say that collection is temporarily closed without exposing the Owner's plan.
- Show the upgrade opportunity privately to the Owner.
- Do not accept and lock over-limit Submissions.

## Video lifecycle

- Always offer file import. Show browser recording only where camera, microphone, and recording APIs are supported.
- Creating a direct upload requires an available video allowance and creates a temporary Video Reservation.
- Upload directly from the visitor's browser to Mux.
- Keep Testimonial moderation separate from Video Asset state.
- After upload, a Pending video may be `Processing`, `Ready`, or `Failed`.
- Only a Ready video may be Published.
- Consume a Free Collection Credit or Pro Video Slot only when the asset becomes Ready.
- Release the reservation after timeout, cancellation, or processing failure.
- A Failed video consumes no quota and may be replaced using a fresh upload.
- If failure happens after the Submitter leaves, send one private Video Retry Link valid for 24 hours.
- Generate captions from the Submitter-selected spoken language. Caption failure does not block video readiness or publication.

## Submitter confirmation and revisions

- A completed Submission triggers an email containing the Brand, a copy or link to the submitted content, its private Pending status, and a Submission Management Link.
- The link requires no Submitter account, remains valid until Testimonial deletion, and can be rotated by requesting a replacement link at the original email address.
- A replacement request is non-enumerating and rate limited, keeps the previous token active through delivery failure, collapses concurrent requests, and invalidates every previous token for that Brand and email only after durable delivery succeeds.
- Email cannot be changed through the link.
- The Submitter may edit their own text, name, avatar, role, company, and rating, replace their own video, or withdraw Publication Consent.
- Work in progress never changes the current version.
- Confirming a Submission Revision requires fresh Publication Consent, removes the prior version from public surfaces, and returns the Testimonial to Pending.
- A revision remains the same Testimonial and consumes no new Free Collection Credit.
- A video replacement may temporarily coexist with the former asset even when the plan is otherwise full.
- A failed replacement leaves the old version unchanged.
- After a Ready replacement is confirmed, unpublish the prior version, move the revision to Pending, and permanently delete the former Mux media.

## Consent and privacy

- Consent copy must name the Brand, identify the publication purposes, list the supplied identity fields that may be public, state the absence of compensation, and explain withdrawal.
- Email always remains private and is not part of publication consent.
- Store the exact consent text and version, acceptance timestamp, Brand, and associated Testimonial.
- The final default privacy and consent text requires legal review before launch.
- Consent Withdrawal removes the Testimonial from all public surfaces immediately and permanently deletes text, photo, video, captions, thumbnails, and renditions within 24 hours.
- After withdrawal, retain only a minimal content-free audit event showing that consent existed and was withdrawn.
- Public surfaces use no marketing, advertising, or customer-facing analytics cookies.

## Inbox and moderation

- Show Pending, Published, Archived, and quarantined Spam records.
- Filter by moderation status and Submission type.
- Sort newest-first or oldest-first.
- Preview text, video, identity, rating, consent presence, and media readiness.
- Owner actions: publish, archive, mark as Spam, undo Spam during quarantine, and permanently delete.
- Published video requires a Ready Video Asset.
- The Owner may correct identity metadata and choose which optional identity fields appear publicly.
- The Owner may not edit testimonial text. Material text correction must come from the Submitter through a Submission Revision.
- No search, tags, bulk actions, auto-approval, or owner-authored testimonial import in the MVP.
- Email the Owner for each valid new Pending Testimonial by default; allow this notification to be disabled.
- Show the Pending count in the dashboard.

### Spam and credit restoration

- Public forms use layered bot protection and request-rate limits.
- Marking as Spam starts a reversible seven-day Spam Quarantine.
- The first three Spam reports in a rolling 30-day period restore their credits immediately.
- Undoing one of those reports consumes the restored credit again.
- Later Spam reports require manual support validation before restoring a credit.
- Manual review uses a secured, audited support operation, not a new internal admin dashboard.
- At the end of quarantine, permanently delete the Spam content and any associated media.

## Public Wall and Embedded Wall

### Shared presentation

- Both surfaces use the same Public Projection, card component, curated order, visibility rules, and theme configuration.
- Masonry layout: one column on mobile, two on tablet, and up to three on desktop.
- New Published Testimonials enter first; the Owner can reorder Published Testimonials with drag and drop.
- Public changes must appear within 60 seconds.
- Permanent Deletion and Consent Withdrawal must bypass ordinary cache staleness and disappear immediately.
- An empty hosted wall displays a restrained empty state.
- An empty embed renders no visible height.

### Card direction

Adapt the verified Atrakt `astro-lp` testimonial treatment without copying its brand:

- Text card: avatar, name, role/company, optional stars, testimonial text, and applicable Attribution Badge.
- Video card: vertical `9:16` poster/player, followed by avatar, name, role/company, optional stars, and applicable Attribution Badge.
- Remove all LinkedIn banner images.
- Use the Brand accent color and configured theme rather than Atrakt colors or typography.
- Do not use User-Agent detection to create different testimonial orders.

See `docs/research/astro-lp-testimonial-reference.md` for captured desktop and mobile evidence.

### Wall configuration

- One responsive masonry layout only.
- Light, dark, or system theme.
- Configurable accent color.
- Transparent background option for the embed.
- Embedded Wall inherits the host font.
- Wall-wide visibility toggles for stars, avatar, role, and company.
- Per-Testimonial visibility overrides for the same optional fields.
- Submitter name remains visible on every Published Testimonial.
- Required Attribution Badge on Free; removable on Pro.
- The badge uses a visible brand link with attribution parameters and `rel="sponsored nofollow"`.
- No custom CSS, carousel, popup, single-Testimonial widget, or alternate layout in the MVP.

### Video playback

- Use a deliberate Mux poster and reserve the `9:16` media space before loading.
- Never autoplay.
- Load the player only after visitor intent; do not preload video bytes.
- Play inline with keyboard-accessible controls and a clear play affordance.
- Generated Captions are available and enabled by default when present.
- Do not transmit a public visitor identity to Mux.

### Iframe-free embed

- Serve a versioned `embed.js` from the same Vercel application.
- Shadow DOM is the preferred isolation approach.
- Before production embed work, prove resizing, style isolation, host-font inheritance, and card behavior on WordPress, Webflow, Framer, and plain HTML.
- Do not silently fall back to an iframe. Reopen the product decision if the proof fails materially.
- The embed fetches only the approved Public Projection.

## Public projection and security

- Include only Published, public-safe fields selected by visibility rules.
- Never expose submitter email, consent records, audit details, internal media identifiers, organization IDs, private moderation state, or private billing data.
- Cache public wall/embed reads at the CDN so views do not map one-to-one to Convex calls.
- Apply application-level rate limits for public reads, form submissions, video creation, management-link requests, and emergency global protection.
- Product quotas remain separate from request-rate limits.
- Use opaque, hashed, revocable tokens for Submission Management and Video Retry links.
- Validate webhook signatures and process provider events idempotently.
- Public slugs identify resources but never prove authorization.

## SEO

- Render the hosted Public Wall with content in initial HTML through server rendering or revalidation.
- Index a wall only after at least one Testimonial is Published.
- Add `noindex` to empty walls and Collection Forms.
- Use a self-referencing canonical URL for the Public Wall.
- Keep private data out of metadata and structured content.
- Make no claim that the client-rendered embed gives the host page server-rendered testimonial content or equivalent SEO value.
- A supported headless API or framework SDK is post-MVP.

## Plans and entitlements

| Capability               | Free                           | Pro                             |
| ------------------------ | ------------------------------ | ------------------------------- |
| Price                    | EUR 0                          | Target EUR 29/month             |
| Workspaces / Brands      | 1                              | 1                               |
| Collection Forms         | 1                              | 1                               |
| Public Walls             | 1                              | 1                               |
| Text collection          | 13 lifetime Collection Credits | Unlimited                       |
| Video collection/storage | 2 lifetime Collection Credits  | 25 stored videos simultaneously |
| Maximum video duration   | 2 minutes                      | 2 minutes                       |
| Attribution Badge        | Required                       | Removable                       |
| MP4 download             | No                             | Yes, best available up to 1080p |

- Free credits count valid collected proof, not merely Published proof.
- Deleting or archiving genuine Free proof never restores a credit.
- Spam restoration follows the quarantine policy.
- Used Free credits persist through upgrades and later downgrades.
- Pro Video Slots count all stored Ready videos, regardless of moderation state.
- Permanently deleting a Pro video frees its slot.
- Submission Revisions do not consume a new credit or slot.
- Do not advertise Pro video as unlimited.

## Billing, cancellation, and downgrade

- One monthly Pro plan through Stripe Checkout.
- No trial, annual plan, coupon system, or custom proration in the MVP.
- Delegate payment method, invoices, cancellation, and reactivation to Stripe Customer Portal.
- A scheduled cancellation keeps Pro active through the paid billing period.
- Let the Owner preselect the two videos and thirteen texts that remain Published after downgrade.
- Remind the Owner seven days and one day before Pro ends.
- Without a complete selection, keep the most recently Published eligible items.
- Archive excess text; do not delete it.
- Retain excess video assets for 30 days for reactivation or exceptional download, warn during retention, then permanently delete them from Mux.
- Free Attribution Badge returns when Pro ends.
- The target price is EUR 29/month. Tax-inclusive or tax-exclusive configuration, registrations, and display rules are deliberately deferred to mandatory accounting/legal validation before live payments are enabled.

### Failed renewal

- A failed renewal begins a seven-day Payment Grace Period.
- Keep existing Pro publication, branding, and MP4 download access during grace.
- Block new video storage during grace.
- Restore full access immediately when payment recovers.
- Apply Free downgrade rules after seven days or when Stripe reports `unpaid` or `canceled`, whichever happens first.

## Video deletion and Workspace Deletion

### One video

- Permanent Deletion is explicit and irreversible.
- Offer the applicable MP4 download before a separate destructive confirmation.
- Explain that the source, renditions, captions, and thumbnails will be deleted from Mux.
- A failed or abandoned download never initiates deletion.
- Retain no media copy after successful source deletion.

### Entire Workspace

- Require recent authentication, typed Brand-name confirmation, and a separate irreversible confirmation.
- Offer data and eligible media download first.
- A failed or abandoned export never initiates deletion.
- On confirmation, immediately remove public surfaces, end the subscription, and permanently delete private records and Mux media.
- No recovery window.

## Accessibility and responsive support

- Target WCAG 2.2 AA for the Collection Form, Public Wall, Embedded Wall, and their core interactions.
- Support keyboard navigation, visible focus, 44px touch targets, sufficient contrast, clear validation errors, image alternatives, reduced motion, and accessible video controls.
- Support current modern desktop Chrome, Safari, Firefox, and Edge plus current iOS Safari and Android Chrome.
- When browser recording is unsupported or permission is refused, preserve video file import and text submission.

## Runtime ownership

- One Next.js application; no Turborepo in the MVP.
- Vercel owns Next.js rendering, route handlers, static assets, and the versioned embed runtime.
- Convex Cloud owns persistence, tenant authorization, transactional product rules, quotas, realtime state, audit records, and backend workflows.
- Mux PAYG owns direct video ingest, processing, playback, generated captions, static MP4 renditions, thumbnails, and source deletion.
- Stripe owns payment collection and subscription self-service; application entitlements come only from synchronized server-side billing state.
- Transactional email remains behind the starter's provider-neutral delivery port.
- Do not provision or configure production providers until targets are explicitly confirmed.

## Explicitly outside the MVP

- Multiple Brands, Workspaces, forms, walls, or client subaccounts.
- Team UI, invitations, exposed roles, or collaboration workflows.
- Social imports, review imports, Chrome extension, Zapier-style integrations, and client webhooks.
- Owner-authored or imported Testimonials.
- Custom form fields, field reordering, multi-question forms, rewards, and automated request campaigns.
- Auto-approval, AI writing, AI editing, transcription editing, video editing, and clipping.
- Search, tags, bulk Inbox actions, public replies, and testimonial translations.
- Carousels, popups, single-card widgets, custom CSS, custom domains, and multiple wall templates.
- Owner-facing views, plays, clicks, conversion analytics, and marketing trackers.
- Public API keys, supported headless API, framework SDKs, and rich snippets.
- Tax-policy automation beyond the pre-launch accounting decision.

## Pre-launch decisions and evidence gates

These do not authorize implementation or production provisioning:

- Explicit approval of the GitHub MVP specification.
- Legal review of consent, privacy, withdrawal, data-processing, and 18+ language.
- Accounting review of tax registration, EUR 29 price behavior, VAT IDs, invoices, and markets served.
- Recheck current Mux, Convex, Vercel, Stripe, and email-provider pricing and limits.
- Recheck and purchase the selected domain only with explicit authorization.
- Capture the remaining competitor desktop/mobile evidence where useful; do not copy competitor branding.
- Prove the iframe-free embed on the named host platforms.
- Confirm local, preview, and production targets before any provider mutation.
