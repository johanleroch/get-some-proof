# Product scope

This document records the product decisions accepted during the initial framing of Convex Admin Starter. It defines the intended first release; implementation specifications will be captured in GitHub Issues later.

## Positioning

- The repository is an opinionated, cloneable foundation for building an administration product or SaaS, not a no-code product or a UI-only kit.
- It serves Johan's projects and the non-technical operators he accompanies, while remaining understandable and reusable by other template adopters.
- It is described as production-oriented, not unconditionally production-ready.
- It remains private during validation. The eventual paid or open-source model and public license will be selected later.
- Code, documentation, and default interface copy are written in English. Interface copy is kept easy to centralize, but full internationalization is outside the first release.

## Application scope

The first release includes:

- email/password and Google sign-in;
- email verification, password reset, optional TOTP two-factor authentication, and recovery codes;
- active-session listing and revocation;
- organization onboarding and organization switching;
- memberships, invitations, and the Owner, Admin, Editor, and Viewer roles;
- dashboard navigation and an overview page;
- a removable organization-scoped `Project` example with listing, creation, editing, and archiving;
- member, invitation, organization-settings, audit-log, and account-security screens;
- responsive light, dark, and system themes;
- an explicit, optional demonstration seed that cannot run accidentally in production.

The first release excludes billing, a marketing site, a blog, runtime custom-role builders, full internationalization, and organization deletion. A safe organization-deletion workflow requires an explicit retention, recovery, and purge design and is left as a documented extension.

## Authentication and account security

- Better Auth and `@convex-dev/better-auth` own identity, accounts, providers, and sessions.
- An email must be verified before a user can create an organization, accept an invitation, or receive an active membership.
- Two-factor authentication is available to every user but is not mandatory or enforceable by an organization in the first release.
- The account-security screen lists active sessions and can revoke one or every other session.
- A password reset revokes existing sessions.
- Verification and reset emails use the same application-wide transactional-email port as invitations.

## Organizations and memberships

- `Organization` is the product term; `Tenant` describes the corresponding technical security partition.
- A user may belong to multiple organizations.
- A non-invited user creates an organization during onboarding before reaching its dashboard.
- Organization routes use `/org/<stable-slug>/...`. The slug is derived from the creation-time name and a random four-character lowercase alphanumeric suffix, then remains stable when the name changes.
- The organization switcher appears only when a user has multiple active memberships. Creating another organization is a separate action.
- A deployment may present a single-organization interface, but it retains the same multi-tenant data and authorization architecture.
- Removing a member deactivates the membership and revokes organization roles atomically while preserving historical attribution.
- A member may leave an organization. An Owner may leave only when another Owner remains.
- An organization may have multiple Owners and must always retain at least one.

## Roles and permissions

- Roles form the hierarchy Owner → Admin → Editor → Viewer.
- Viewer reads organization resources and the member directory.
- Editor creates, updates, and archives resources but cannot permanently delete them or administer members.
- Admin includes Editor permissions, may permanently delete resources, and administers non-owner members and invitations.
- Owner includes Admin permissions and exclusively controls ownership governance.
- Owner and Admin may invite Viewer, Editor, or Admin members. Owner changes remain Owner-only.
- Every member can see member names and roles; only Owner and Admin receive membership-management actions.
- The starter ships only these four code-defined roles. ABAC, ReBAC, and application-specific permission extensions are documented advanced paths rather than runtime UI features.

## Invitations

- Invitations belong to the application domain and are delivered through a provider-neutral transactional-email interface.
- Resend is the initial provider adapter, and a deployment selects one provider for all transactional email. Lumail or another provider can replace it without changing callers or templates.
- Templates live and render in the repository rather than in the provider account.
- Delivery state tracks pending, sent, and failed, together with an idempotency key and provider message ID. Normalized provider webhooks are outside the first release.
- An invitation expires after seven days. Resending or changing its intended role rotates the token and resets the expiry, invalidating every previous link.
- Tokens are random, single-use, and stored only as hashes.
- Acceptance survives signup or login but requires the verified authenticated email to match the recipient after trimming and case normalization. Provider-specific alias rewriting is not applied.
- Owner and Admin can list, resend, revoke, and change the intended role of pending invitations.

## Authorization and tenancy

- Application-owned Convex tables own organizations, memberships, invitations, resources, and business audit events.
- `@djpanda/convex-authz` is the source of effective organization roles and permissions.
- Server functions validate the Better Auth session, derive the actor from the authenticated user, resolve the organization from a verified membership or loaded resource, and only then call convex-authz.
- Client-provided user IDs, tenant IDs, slugs, active-organization state, and hidden buttons are never authorization evidence.
- Every tenant-scoped resource carries an organization ID, and its query indexes begin with that partition key.
- Queries, mutations, and actions enforce authorization at their public Convex boundary and again around privileged internal operations when appropriate.

## Dashboard interface

- Next.js App Router is the React framework.
- Tailwind CSS and shadcn/ui form the general design system.
- Only MIT-licensed Bklit registry chart components may be included; Bklit Studio and proprietary assets are excluded.
- The visual direction is sober, responsive, accessible B2B software with replaceable brand tokens, logo, colors, and themes.
- The main navigation covers overview, Projects, members and invitations, audit, organization settings, and account security.
- The application audit log is immutable, organization-scoped, visible to Owner and Admin, and records security-sensitive and administratively significant operations.

## Quality, versions, and deployment

- The known-compatible authentication and authorization dependency set is pinned exactly and the lockfile is committed.
- Updates to that set are grouped in dedicated pull requests and validated with authentication, role-matrix, and cross-tenant isolation tests.
- Automated coverage includes server authorization and tenant-isolation tests plus end-to-end signup, invitation, and role-management paths.
- The architecture remains portable across suitable Next.js hosts. Vercel + Convex + Resend + Google is the primary documented deployment path, not a mandatory runtime lock-in.
