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

`auditEvents` is an append-only application table partitioned by Organization. Events copy stable actor and target labels so attribution survives Project deletion or Membership deactivation. Payloads expose no Invitation token, credential, provider secret, or delivery idempotency value. Owner and Admin can read the paginated application log. convex-authz keeps its own separate history of authorization changes.

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
