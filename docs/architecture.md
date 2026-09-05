# Architecture and security

## Request boundary

Better Auth owns user identity, accounts, providers, verification, two-factor authentication, and Sessions. `@convex-dev/better-auth` stores that state in Convex and exposes the authenticated identity to Convex functions. The application tables own Organizations, Memberships, Invitations, Projects, and Audit Events. `@djpanda/convex-authz` owns effective Organization roles and permissions.

Every Organization-scoped server operation follows the same boundary:

1. `requireVerifiedPrincipal` validates the Better Auth Session and verified email, then derives the actor ID from server identity.
2. `findActiveOrganizationAccess` loads the canonical Organization and active Membership from application tables.
3. The loaded Organization ID becomes the convex-authz Tenant ID. A client-supplied Tenant ID, user ID, route slug, or hidden button is never authorization evidence.
4. `requireOrganizationPermission` asks convex-authz for the required permission.
5. Only then does the function query or mutate data whose index begins with `organizationId`.

The reusable boundary is in `convex/security/organizationAccess.ts`; roles and permissions are code-defined in `convex/authorization.ts`. Queries, mutations, and actions must enforce authorization on the server even when the interface also hides unavailable actions.

## Organizations, Memberships, and Invitations

An Organization is the product boundary; its ID is the technical Tenant partition. Membership records prove active participation and preserve inactive history. Removing a Member deactivates the Membership and revokes its Tenant roles in the same transaction. The last Owner cannot be demoted, removed, or leave.

Invitations are application records rather than Better Auth Organizations. Tokens are random, stored only as hashes, expire after seven days, rotate on resend or role change, and are single-use. Acceptance requires an authenticated verified email matching the normalized recipient before the Membership and initial convex-authz role are created.

## Roles

The starter ships four fixed roles:

| Role   | Resources                     | Members and Invitations | Settings and Audit | Ownership |
| ------ | ----------------------------- | ----------------------- | ------------------ | --------- |
| Viewer | Read                          | Read directory          | No                 | No        |
| Editor | Read, create, update, archive | Read directory          | No                 | No        |
| Admin  | Editor plus permanent delete  | Manage non-owners       | Yes                | No        |
| Owner  | Admin                         | Manage all Members      | Yes                | Yes       |

Extend the permission tree and role definitions in `convex/authorization.ts`, then add server-boundary tests before exposing a new action.

## Email providers

All transactional email goes through `convex/email/provider.ts`. Callers and templates use the application interface; provider credentials and result mapping remain in the selected adapter. The included choices are a silent `test` adapter, a localhost-only `console` preview, and Resend. To add Lumail or another provider, implement the same port, select it by environment configuration, and leave Invitation and Better Auth workflows unchanged.

## Audit Events

`auditEvents` is an append-only application table partitioned by Organization. Events copy stable actor and target labels so attribution survives Project deletion or Membership deactivation. Permanent Testimonial deletion is the narrow privacy exception: the prior event stream for that Testimonial is deleted in bounded resumable batches and replaced by one immutable `testimonial.deleted` event containing no submitter content or identity. Payloads expose no Invitation token, credential, provider secret, or delivery idempotency value. Owner and Admin can read the paginated application log. convex-authz keeps its own separate history of authorization changes.

## Permanent Testimonial deletion

Permanent Deletion stays separate from reversible Archive. The Inbox names the submitter, type, submission time, and Testimonial ID, offers an authorized Pro MP4 download as an independent action, and requires a second destructive confirmation. The confirmation transaction immediately removes the Public Projection, private content, consent, avatar storage, and the first bounded batch of related history. Any remaining Spam quarantine, delivery, replacement-link, revision, and audit rows are purged by resumable scheduled batches while the consumed Free Collection Credit and one content-free audit result remain; replay is idempotent through that audit tombstone.

Video deletion first records an application tombstone containing only provider cleanup targets and immediately removes the Public Projection. Mux source and derived download assets are deleted through the provider adapter; failures leave the tombstone retryable and cannot republish the Testimonial. Finalization removes consent, private identity, delivery and replacement state, reservations, local media metadata, retention state, and avatar storage, which frees the Pro Video Slot. Provider retries and late derived-asset cleanup are idempotent.

## Workspace Billing and Pro Entitlement

One Platform Stripe Account belongs to the company operating the deployment. Every Organization is a Customer of that account and may have one non-terminal fixed-price subscription. Stripe Connect, Organization-owned merchant accounts, and browser-managed credentials are outside this architecture.

`@convex-dev/stripe` verifies the Stripe webhook signature and synchronizes Customer, Checkout, Subscription, Invoice, and Payment records in its isolated component tables. Application code wraps those component queries behind the same verified-principal, active-Membership, canonical-Organization, and convex-authz boundary used elsewhere. `billingProfiles` owns the one-to-one Organization Customer mapping, Billing Contact, and serialized Checkout or contact-update reservations. Temporary Checkout and Customer Portal URLs are returned directly to an authorized Owner and are never stored.

The Billing permission split is deliberate:

| Role   | Billing cockpit | Financial actions |
| ------ | --------------- | ----------------- |
| Owner  | Read            | Manage            |
| Admin  | Read            | None              |
| Editor | None            | None              |
| Viewer | None            | None              |

The server derives Pro Entitlement from synchronized Subscription state only when the synchronized Customer and Price match the server-owned `billingProfiles` mapping created during Checkout. `active` and `past_due` grant Pro; cancellation scheduled on one of those states grants it through the synchronized period end. Trialing, terminal, unpaid, incomplete, missing, unavailable, or mismatched states do not. The product capability boundaries independently enforce unlimited Pro text collection, 25 stored Ready videos, MP4 download, and removable attribution.

The browser can request only `pro_monthly`. The server resolves exactly one active recurring EUR 29 monthly Stripe Price for that lookup key, persists the trusted Price mapping before Checkout, creates or reuses the Organization Customer, attaches canonical Organization metadata, and uses serialized reservations plus Stripe idempotency keys. The Checkout success or cancellation query parameter controls explanatory UI copy only. Pro is granted only after the signed webhook synchronization matches both mappings and the Subscription changes.

Provider boundaries, supported lifecycle states, setup, and sandbox checks are documented in `docs/stripe-billing.md`. The accepted global-account decision is recorded in ADR 0031.

Billing downgrade is an application-owned workflow rather than a Stripe-side side effect. Each Subscription has one versioned `billingDowngradeTransitions` record. Signed provider snapshots schedule either period-end, payment-grace, or immediate terminal processing; recovery increments the version so stale jobs cannot archive proof. D-7 and D-1 notices have durable delivery keys and pass through the same transactional email adapter.

At the effective downgrade instant, Convex revalidates the Workspace's aggregate trusted entitlement, then freezes the Owner's valid keepers with a descending-`publishedAt` fallback. A versioned cursor applies the downgrade in bounded, durable batches so unlimited Pro text volume cannot exceed transaction limits: at most two videos and thirteen text Testimonials stay Published, excess text is archived, and excess video leaves public projections. Free Collection Credit records are never rewritten. Each excess video receives a separate 30-day retention record: its Mux media remains exceptionally downloadable while retained, warning deliveries are idempotent, re-publication after Pro recovery atomically cancels retention, and a leased provider-deletion outbox with an atomic watchdog retries safely before the local media record is finalized.

## Workspace deletion

Only an Owner with a Better Auth Session created in the previous five minutes may begin Workspace Deletion. The server verifies the exact Brand name and a separate irreversible-confirmation literal; the data export is an independent read action and never creates deletion state. The first deletion mutation stores a content-free tombstone plus the stable Stripe subscription identifiers and marks the Organization as deleting. Every public reader and collection or management mutation treats that flag as unavailable, so a provider failure cannot reopen the Brand.

The resumable workflow leases one bounded step at a time and schedules a watchdog before external work, so an Action crash, closed browser, or expired lease wakes another worker. It cancels Stripe subscriptions with stable idempotency keys, drains detached provider-cleanup jobs, deletes attached Mux uploads and assets, and only then removes local video metadata. It purges organization-scoped records, storage objects, synchronized Stripe webhook state, convex-authz roles, Memberships, and the Organization in bounded batches. A minimal subscription-deletion marker is created atomically with the tombstone: an earlier webhook is included in the purge, while a later webhook is ignored, adds its subscription to the cancellation queue, and cannot recreate entitlement. Provider failure clears the lease, records a content-free error, schedules bounded backoff, and remains manually retryable. Completion retains only content-free workflow and webhook-suppression state for idempotent reporting, not Brand content or a recoverable copy.

## Dashboard and Bklit boundary

Tailwind CSS and repository-owned shadcn components implement the interface. `src/components/charts/` contains the Bklit `@bklit/bar-chart` registry source and its preserved MIT notice. Bklit Studio and proprietary source or assets are not included. Brand and chart replacement points are documented in `docs/customization.md`.

## Removing the Project example

`Project` is intentionally removable. To replace it with the first real Organization resource:

1. Add the new table with an `organizationId` field and Organization-first indexes.
2. Add its permissions to `convex/authorization.ts` and map them to roles.
3. Build server functions around `requireOrganizationPermission`; verify loaded resources belong to the resolved Organization before returning or mutating them.
4. Add role-matrix, cross-Tenant, and Audit Event tests.
5. Replace `convex/projects.ts`, `tests/projects.test.ts`, Project dashboard metrics, routes, navigation, and components.
6. Remove the `projects` table only after any retained data has an explicit migration or purge decision.

## Shared upload, deletion, and credit modules

The browser Video Asset upload module (`src/hooks/use-video-upload.ts`) owns an attempt's phase, progress, abort signal, navigation guard, and reservation cleanup. Its interface accepts a reservation adapter and optional confirmation policy. Collection Form retains a completed upload after uncertain confirmation, Video Retry Link keeps its consumed-link context, and Submission Revision waits for Ready and renewed Publication Consent before confirmation. Those callers keep their domain policy; the module keeps the upload lifecycle and transport adapter. Cancellation before reservation creation finishes still releases the late reservation, and a second attempt cannot overlap the first.

`convex/testimonialDeletion.ts` owns current-media removal and the bounded Testimonial relationship purge. Owner Permanent Deletion enters after current provider media deletion; Consent Withdrawal and Spam expiry enqueue provider cleanup before deleting local media. Each path removes the Testimonial and Public Projection in the first transaction. Later batches remove delivery records, retry links, revisions, their media and reservations, and grouped management-link items. Delivery claims ignore Testimonials already removed between batches. Owner deletion removes quarantine history, while withdrawal and expiry retain that history because the rolling Spam restoration limit depends on it. Collection Credits survive all three paths. Workspace Deletion retains its separate orchestration.

All three deletion paths use the bounded audit purge from `convex/auditEvents.ts`, retaining only their content-free `testimonial.deleted`, `testimonial.consent_withdrawn`, or `testimonial.spam_expired` event as required by ADR 0010. Spam expiry previously only replaced historic event labels; it now applies the same privacy exception. Withdrawal and expiry also remove obsolete downgrade-retention records.

`convex/collectionQuotas.ts` owns credit consumption, automatic/manual Spam restoration, and reversal on Undo. Both Spam-after-Ready and Ready-after-Spam cross the same transactional interface. Restoring a credit updates the ledger and quarantine together, enforces the rolling three-per-30-day automatic limit, and ignores duplicate restoration. Support restoration remains explicit and audit attribution stays with the authenticated entry point. This gives locality to credit policy without combining Collection Credits with Video Slots.

Regression evidence is in the three browser journey suites, `src/hooks/use-video-upload.test.ts`, the connected `managed-submission-upload.test.tsx`, and the backend moderation, collection-quota, submission-management, and media suites. The deletion tests exercise 65 related records per relation, 129 old audit events, provider failure/retry, and completion via the scheduler.
