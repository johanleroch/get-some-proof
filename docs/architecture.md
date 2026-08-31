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
