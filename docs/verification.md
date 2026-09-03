# Specification verification matrix

This matrix maps the first-release scope to an automated check or an explicit adoption-time verification.

| Requirement                                                                                                       | Verification                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Email/password, Google, verification, reset, Session revocation, optional TOTP and recovery codes                 | Auth page and security component tests; production build; manual provider validation in `docs/deployment.md`               |
| Organization creation, stable slug, switching, and inactive Membership routing                                    | `tests/organizations.test.ts`; `organization-switcher.test.tsx`                                                            |
| Owner, Admin, Editor, Viewer role matrix                                                                          | `tests/projects.test.ts`, `tests/members.test.ts`, `tests/dashboard.test.ts`                                               |
| Server-derived Tenant and cross-Tenant isolation                                                                  | Organization, Project, Member, Invitation, Dashboard, and Audit server tests                                               |
| Invitation hashing, matching verified email, rotation, expiry, delivery state, and provider neutrality            | `tests/invitations.test.ts`; `convex/email/provider.test.ts`; provider architecture documentation                          |
| Last-Owner invariant and preserved inactive Membership history                                                    | `tests/members.test.ts` including concurrent mutation coverage                                                             |
| Immutable application Audit Events, stable attribution, ordering, and read restrictions                           | `tests/auditEvents.test.ts`                                                                                                |
| Responsive permission-aware navigation and collapsed/mobile keyboard behavior                                     | `app-shell.test.tsx`; desktop and mobile Playwright projects                                                               |
| Light, dark, and system persistence without incorrect-theme flash                                                 | `theme.test.ts`; pre-hydration script in root layout                                                                       |
| Real Organization metrics and MIT Bklit charts                                                                    | `tests/dashboard.test.ts`; Bklit notice and source boundary in `docs/customization.md`                                     |
| Organization settings and account security screens                                                                | Server permission tests, component tests, production route build                                                           |
| Explicit non-production demonstration seed                                                                        | `tests/seed.test.ts` proves opt-in, local-only blocking, role data, and idempotency                                        |
| Platform Stripe Account and Organization Customer isolation                                                       | ADR 0031; `tests/billingCheckout.test.ts`; `tests/billingManagement.test.ts`                                               |
| Server-only Stripe secrets, optional unavailable mode, and Free fallback                                          | `docs/stripe-billing.md` safety boundary; `tests/billing.test.ts`; billing capability tests                                |
| Test-mode Prices, lookup keys, webhook events, Portal features, Checkout branding, and return origins             | Manual setup record from sections 1-4 and the catalog/target rows in section 7 of `docs/stripe-billing.md`                 |
| Owner-managed and Admin-read-only Billing with Editor, Viewer, inactive, and cross-Tenant denial                  | `tests/billing.test.ts`; `tests/billingCheckout.test.ts`; `tests/billingManagement.test.ts`                                |
| Allowlisted runtime Price catalog, Checkout idempotency, duplicate prevention, and safe recovery                  | `convex/billingService.test.ts`; `convex/billingActions.test.ts`; `convex/stripeBillingProvider.test.ts`                   |
| Webhook-derived Pro states and cancellation-at-period-end date                                                    | `convex/billingEntitlements.test.ts`; `tests/billingEntitlementOverview.test.ts`                                           |
| Pro text, video, download, and attribution capability boundaries                                                  | `tests/collection-quotas.test.ts`; `tests/video-media.test.ts`; `tests/wall-customization.test.ts`                         |
| Fresh Portal sessions, payment recovery, same-Customer contact updates, and sanitized audit events                | `convex/billingActions.test.ts`; `tests/billingManagement.test.ts`; `src/components/billing/organization-billing.test.tsx` |
| Forged Checkout success return never grants Pro                                                                   | `src/components/billing/organization-billing.test.tsx`; entitlement mismatch tests; sandbox section 5.A                    |
| Billing lifecycle, semantic alerts, role affordances, duplicate-click handling, and responsive states             | `src/components/billing/organization-billing.test.tsx`; canonical desktop and mobile visual evidence                       |
| Seven-day grace, deterministic 2/13 downgrade, keeper races, durable reminders, 30-day retention, and Mux retries | `tests/billing-downgrade.test.ts`; downgrade-selection desktop and mobile visual evidence                                  |
| Stripe test-mode Checkout, webhook, Portal, recovery, and cancellation lifecycle                                  | Adoption-time sandbox record in `docs/stripe-billing.md`; provider-dependent manual proof                                  |
| Live-mode and production changes require separate explicit approval                                               | Safety boundary in `docs/stripe-billing.md`; promotion gate in section 6 of `docs/deployment.md`                           |
| UI research sources and unavailable Mobbin tooling remain traceable                                               | `docs/research/stripe-billing-ui-flows.md`; UI research traceability section in `docs/stripe-billing.md`                   |
| Clean install, formatting, lint, type checking, server tests, build, and browser smoke                            | `.github/workflows/ci.yml`; the release validation commands below                                                          |
| Marketing site, blog, runtime custom roles, full i18n, and Organization deletion excluded                         | Recorded in `docs/product-scope.md`; no implementation required for v1                                                     |

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
