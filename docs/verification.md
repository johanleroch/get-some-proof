# Specification verification matrix

This matrix maps the first-release scope to an automated check or an explicit adoption-time verification.

| Requirement                                                                                            | Verification                                                                                                 |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Email/password, Google, verification, reset, Session revocation, optional TOTP and recovery codes      | Auth page and security component tests; production build; manual provider validation in `docs/deployment.md` |
| Organization creation, stable slug, switching, and inactive Membership routing                         | `tests/organizations.test.ts`; `organization-switcher.test.tsx`                                              |
| Owner, Admin, Editor, Viewer role matrix                                                               | `tests/projects.test.ts`, `tests/members.test.ts`, `tests/dashboard.test.ts`                                 |
| Server-derived Tenant and cross-Tenant isolation                                                       | Organization, Project, Member, Invitation, Dashboard, and Audit server tests                                 |
| Invitation hashing, matching verified email, rotation, expiry, delivery state, and provider neutrality | `tests/invitations.test.ts`; `convex/email/provider.test.ts`; provider architecture documentation            |
| Last-Owner invariant and preserved inactive Membership history                                         | `tests/members.test.ts` including concurrent mutation coverage                                               |
| Immutable application Audit Events, stable attribution, ordering, and read restrictions                | `tests/auditEvents.test.ts`                                                                                  |
| Responsive permission-aware navigation and collapsed/mobile keyboard behavior                          | `app-shell.test.tsx`; desktop and mobile Playwright projects                                                 |
| Light, dark, and system persistence without incorrect-theme flash                                      | `theme.test.ts`; pre-hydration script in root layout                                                         |
| Real Organization metrics and MIT Bklit charts                                                         | `tests/dashboard.test.ts`; Bklit notice and source boundary in `docs/customization.md`                       |
| Organization settings and account security screens                                                     | Server permission tests, component tests, production route build                                             |
| Explicit non-production demonstration seed                                                             | `tests/seed.test.ts` proves opt-in, local-only blocking, role data, and idempotency                          |
| Clean install, formatting, lint, type checking, server tests, build, and browser smoke                 | `.github/workflows/ci.yml`; the release validation commands below                                            |
| Billing, marketing site, blog, runtime custom roles, full i18n, Organization deletion excluded         | Recorded in `docs/product-scope.md`; no implementation required for v1                                       |

## Release validation

Run from a fresh clone with no copied `node_modules` or `.next` directory:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
```

Provider-dependent end-to-end flows require a disposable Convex development deployment and test credentials. They remain explicit manual release checks because CI does not receive production or developer secrets.
