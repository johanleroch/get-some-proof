# Local MVP release-candidate certification

This is the reproducible release-candidate gate for the approved MVP. It does
not approve a production deployment, configure a live provider, or prove an
adopter-specific Stripe, Mux, email, OAuth, Turnstile, domain, legal, or
accounting setup.

## Canonical clean-checkout gate

Run this sequence from a fresh checkout with no copied `node_modules`, `.next`,
provider credentials, or production environment file:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install
pnpm certify:mvp
```

`pnpm certify:mvp` runs the complete non-browser gate. Functional and
accessibility Playwright tests run on desktop Chromium, Firefox, and WebKit plus
Pixel 7 Chromium and iPhone 15 WebKit profiles. Deterministic screenshot capture
runs separately on desktop/mobile Chromium. The suites use `convex-test`, the
test email adapter, fake Mux, fake or absent Stripe entitlements, intercepted
public-wall responses, and development-only visual fixtures. They make no
provider or production write. Branded Edge and real-device Safari remain
pre-launch manual checks.

The two release-candidate journeys in `tests/mvp-happy-path.test.ts` prove these
cross-boundary sequences as one connected behavior rather than isolated unit
claims:

- Text: public collection, versioned Publication Consent, submitter and Owner
  notification receipts, private Inbox access, cross-Brand denial, moderation,
  public-safe projection, Submitter revision, re-moderation, and Consent
  Withdrawal.
- Fake video: Direct Upload reservation, Ready media, private Inbox access,
  moderation, public video projection, Submission Management Link replacement,
  re-moderation, and Consent Withdrawal with application media removal.

All other release behaviors remain in the complete `pnpm test` suite. The
verification matrix below names their authoritative test files.

## Optional interactive development rehearsal

Use this only with a disposable Convex **development** deployment. Read the
target printed by the CLI before every write. Stop if it says Production, and
never add `--prod`.

1. Copy `.env.example` to `.env.local`, then run `pnpm dev:convex --once` and
   verify the CLI prints `[Development]` and the intended deployment name.
2. Set `SITE_URL=http://localhost:3000`, a unique local
   `BETTER_AUTH_SECRET`, `EMAIL_PROVIDER=console`, `MUX_PROVIDER=fake`, and
   `ALLOW_DEMO_SEED=true` in that development deployment. These are Convex
   server values; only the public Convex URLs and `NEXT_PUBLIC_SITE_URL` belong
   in `.env.local`.
3. Start `pnpm dev:convex` and `pnpm dev` in separate terminals.
4. Sign up with email/password, open the console verification link, and create
   one Brand. This proves the real account and onboarding path without Google.
5. Open its Collection Form in a private browser window. Submit one text and
   one fake video Testimonial with Publication Consent. Open the console email
   links and verify both Submitter management and Owner notification routes.
6. In the Inbox, Publish both Testimonials, then inspect the hosted Public Wall
   and an iframe-free embed host. Confirm that email, consent text, tenant IDs,
   moderation state, and tokens never appear publicly.
7. Through the management link, revise the text and replace the video. Confirm
   both leave the Public Wall, return to Pending, and require renewed consent
   before re-publication. Withdraw one consent and confirm immediate public
   removal.
8. Exercise Archive, Spam and undo, Permanent Testimonial Deletion, the Free
   quota states, fake billing and downgrade fixtures, data export, and
   Workspace Deletion. Destructive confirmations must use synthetic data only.

`pnpm seed:demo -- --confirm-local-demo --owner-email <verified-local-email>`
is optional when role-scoped Project and Audit data are useful. It is
idempotent, requires `ALLOW_DEMO_SEED=true`, and refuses non-local `SITE_URL`
values. It does not replace the public collection journey above.

## Accessibility proof

`e2e/accessibility.spec.ts` runs on desktop and mobile and combines automated
WCAG 2.2 A/AA scans with behavior checks that an automated scanner alone cannot
establish:

- keyboard entry and focus transfer between Collection Form stages;
- disabled validation until the text and identity state is valid;
- effective 44 by 44 pixel targets for buttons, rating choices, and consent
  controls;
- alert-dialog focus containment and irreversible-warning text;
- contrast on Collection Form, Inbox, Billing, Public Wall, and destructive
  confirmations;
- reduced-motion rendering;
- iframe-free embed semantics, a named poster alternative, lazy Mux loading,
  no autoplay, captions enabled by default when available, and a named player.

Axe cannot certify every assistive-technology combination. Screen-reader
announcements, 200% zoom/reflow, browser/OS high-contrast modes, and real-device
camera permissions remain manual pre-launch checks.

## Security proof ledger

| Boundary                                              | Authoritative automated proof                                                                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Brand tenancy and role enforcement                    | `tests/organizations.test.ts`, `tests/testimonial-moderation.test.ts`, `tests/mvp-happy-path.test.ts`                                     |
| Public/private field separation                       | `tests/testimonial-moderation.test.ts`, `tests/wall-customization.test.ts`, `tests/mvp-happy-path.test.ts`                                |
| Management, invitation, retry, and destructive tokens | `tests/submission-management.test.ts`, `tests/video-submissions.test.ts`, `tests/workspace-deletion.test.ts`, `tests/invitations.test.ts` |
| Signed, replay-safe provider webhooks                 | `tests/video-submissions.test.ts`, `tests/stripe-webhook-sync.test.ts`, `src/app/api/mux/webhook/route.test.ts`                           |
| Public read and collection rate limits                | `tests/public-read-rate-limit.test.ts`, `tests/submissions.test.ts`, `tests/turnstile-integration.test.ts`                                |
| Free credits, Video Reservations, downgrade limits    | `tests/collection-quotas.test.ts`, `tests/video-submissions.test.ts`, `tests/billing-downgrade.test.ts`                                   |
| Testimonial and Workspace destruction                 | `tests/testimonial-moderation.test.ts`, `tests/video-media.test.ts`, `tests/workspace-deletion.test.ts`                                   |

## Provider evidence boundary

Fake Stripe/Mux/email paths prove application contracts, authorization,
idempotency, retries, state transitions, and public/private projections. They do
not prove that an external dashboard is configured correctly.

- Stripe sandbox rehearsal is optional and separately documented in
  `docs/stripe-billing.md`. Keep its evidence separate from this local gate.
- A Mux sandbox rehearsal requires development-only token credentials, a
  development webhook, a real upload, playback, captions observation, MP4
  generation, replacement, and source deletion. No such credential is required
  for local certification.
- Resend, Google OAuth, and deployed Turnstile hostnames require provider and
  final-origin evidence before launch.

## Visual evidence

The canonical visual suite captures desktop and mobile Collection Form states,
Inbox, hosted Public Wall, Billing and downgrade states, Permanent Testimonial
Deletion, and Workspace Deletion. The Testimonial cards follow the approved
`astro-lp` reference recorded in
`docs/research/astro-lp-testimonial-reference.md`, without its banners or copied
branding. Published PR evidence must point to the exact reviewed commit; a local
folder or CI artifact alone is not delivery proof.

## Honest pre-launch gates

The local MVP can be certified while these remain intentionally unapproved:

- final privacy notice, consent wording, retention policy, terms, and legal
  review for the operating jurisdictions;
- tax treatment, invoices, price display details, refunds, and accounting
  workflow;
- final product name, public domains, sender domain, support and privacy contact;
- real Stripe test-mode lifecycle, Mux lifecycle, Resend delivery/authentication,
  Google OAuth, and Turnstile hostname evidence;
- final hosted-platform headers, caching, CSP, observability, backups, incident
  response, and restore rehearsal;
- cross-browser assistive-technology and real-device media-permission checks;
- any production Convex, Stripe live-mode, Mux, Resend, DNS, or hosting change.

Production remains blocked until those applicable rows have evidence and the
operator gives explicit approval for the exact production targets.
