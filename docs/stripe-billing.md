# Stripe Billing adoption and sandbox rehearsal

This guide enables the complete Organization Billing flow without reading implementation code or touching production. It uses one Platform Stripe Account owned by the company operating the SaaS. Every Organization is a Customer buying that company's Premium Plan. This is not Stripe Connect, merchant onboarding, or one Stripe account per Organization.

## Safety boundary

Perform this procedure only in a disposable Convex development deployment and a Stripe sandbox or test mode. Confirm both targets in their dashboards before changing anything. None of the commands below uses `--prod`, and the Stripe API key must start with `sk_test_`. Webhook signing secrets use the same `whsec_` prefix in test and live modes, so their prefix is not evidence of mode: copy the secret only from the endpoint whose Stripe Dashboard test-mode context and development Convex URL were just verified.

Production and Stripe live mode are not part of this rehearsal. They require a separate explicit approval for the exact account, deployment, webhook, Prices, and charge plan. See `docs/deployment.md` before any promotion.

Stripe is optional. If either `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` is absent, Billing reports unavailable, every Organization remains on Free, Project reads continue to work, Project writes remain gated, and no payment action is offered. Leave both values unset when an adopter does not want Billing.

## What stays server-only

Store these values only in the linked Convex deployment environment:

- `STRIPE_SECRET_KEY`: the Stripe sandbox secret API key, for example an `sk_test_...` value;
- `STRIPE_WEBHOOK_SECRET`: the signing secret for this deployment's test-mode webhook endpoint, for example a `whsec_...` value;
- `SITE_URL`: the public frontend origin used to build Checkout success, cancellation, and Customer Portal return URLs.

Do not put those values in `.env.local`, Vercel public variables, browser code, screenshots, issue comments, or any `NEXT_PUBLIC_` variable. This hosted Checkout integration does not need a publishable key in the browser.

## 1. Create the Premium catalog in Stripe test mode

In the Platform Stripe Account's sandbox or test mode:

1. Create one recurring Product named for the paid plan, for example `Premium`.
2. Create one active recurring monthly Price with lookup key `premium_monthly`.
3. Create one active recurring annual Price with lookup key `premium_annual`.
4. Keep one active Price per lookup key. The monthly Price must use the `month` interval and the annual Price the `year` interval. The server rejects missing, duplicate, inactive, non-recurring, negative, or mismatched offers.
5. Set the desired amount and currency in Stripe. The Billing UI reads them from Stripe; do not copy them into application code.

Stripe lookup-key guidance: <https://docs.stripe.com/products-prices/manage-prices>

## 2. Configure hosted Checkout and the Customer Portal

In Stripe test mode:

1. Configure account and Checkout branding: business name, icon or logo, accent color, support details, and any required policy links.
2. Activate the Customer Portal test configuration.
3. Enable payment-method updates and invoice history.
4. Enable subscription cancellation at the end of the current billing period. Do not configure immediate cancellation if the product promise is access through the paid period.
5. If plan switching is enabled, expose only the supported Premium monthly and annual Prices and verify the desired proration behavior.
6. Set the Portal business profile and default return link. The application also supplies an Organization-specific `return_url` for every fresh Portal session.

The application creates Stripe-hosted Checkout in subscription mode and creates a new short-lived Portal session for every Owner action. A past-due recovery action deep-links to Stripe's `payment_method_update` flow. The application builds no local card form or invoice-history interface and stores no Portal URL or payment credential. The isolated `@convex-dev/stripe` component does synchronize provider invoice snapshots from signed events for server-side billing state.

Stripe Portal guidance: <https://docs.stripe.com/customer-management> and <https://docs.stripe.com/customer-management/portal-deep-links>

## 3. Register the test webhook

Use the linked development deployment's public Convex site URL:

```text
https://<development-deployment>.convex.site/stripe/webhook
```

This is the `NEXT_PUBLIC_CONVEX_SITE_URL` host written by Convex, not the Next.js frontend URL. Create the endpoint in Stripe test mode and select the events synchronized by the pinned `@convex-dev/stripe` component:

- `customer.created`, `customer.updated`, `customer.deleted`;
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`;
- `checkout.session.completed`;
- `invoice.created`, `invoice.finalized`, `invoice.updated`, `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`;
- `payment_intent.succeeded`.

Copy that endpoint's test signing secret into the development Convex environment. Signature verification happens before component synchronization. A secret from another endpoint or mode will fail verification.

Stripe's current Billing testing guide may recommend additional notification events for adopter-specific dunning or trials. Add application handlers before depending on events not synchronized by the pinned component: <https://docs.stripe.com/billing/testing>.

## 4. Configure the development deployment

First verify that `.env.local` points to the intended disposable development deployment and that the Stripe Dashboard is in test mode. Then set only the server environment values, without `--prod`:

```bash
pnpm convex env set SITE_URL http://localhost:3000
pnpm convex env set STRIPE_SECRET_KEY 'sk_test_...'
pnpm convex env set STRIPE_WEBHOOK_SECRET 'whsec_...'
pnpm dev:convex --once
```

Start Convex and Next.js in separate terminals:

```bash
pnpm dev:convex
```

```bash
pnpm dev
```

Use distinct Stripe and Convex test deployments for independent preview environments. Never reuse a live signing secret, and update `SITE_URL` when the frontend origin changes.

## 5. Run the sandbox lifecycle rehearsal

Record the Organization slug, test Customer ID, Subscription ID, webhook event IDs, observed state, and result in a private adoption worksheet. Do not paste secret keys, card data, Checkout URLs, or Portal URLs into the record.

### A. Free and forged return

1. Sign in as a verified Owner and create a new Organization.
2. Open Organization Billing. Verify `Free`, the monthly and annual offers loaded from Stripe, and the expected currency and amounts.
3. Before paying, manually open `/org/<slug>/billing?checkout=success`.
4. Verify the page may explain that confirmation is pending but still shows Free.
5. Verify Project write controls still show the Premium gate and existing Project reads still work. The automated `tests/projectsPremium.test.ts` check separately calls every public Project mutation and proves that the server refuses it while the synchronized entitlement remains Free.

This proves that a success query parameter is presentation state only. Never mark this step passed merely because the browser hides a control.

### B. Checkout and webhook-confirmed Premium

1. Choose monthly or annual and continue to Stripe.
2. Verify the browser leaves the application for Stripe-hosted Checkout and that a double click cannot open two sessions.
3. Complete Checkout with Stripe's successful test card `4242 4242 4242 4242`, any future expiry, and any valid CVC. Never use real card details in a sandbox.
4. On return, verify the application remains pending or Free until the signed webhook synchronizes the Subscription.
5. In Stripe, confirm one Customer and one non-terminal Subscription with canonical Organization metadata.
6. In the webhook delivery log, confirm successful delivery to the Convex endpoint.
7. Verify the Billing page becomes Premium reactively, shows the synchronized cadence, price, state, and period end, and allows the previously refused Project write.

### C. Customer Portal and Billing Contact

1. As Owner, open `Manage subscription` twice as separate actions.
2. Verify each action creates a fresh Stripe-hosted Portal session and returns to the same Organization Billing page.
3. Review invoices, the current plan, and payment-method controls in Stripe.
4. Change the Billing Contact in the application. Verify the same Stripe Customer ID remains mapped and the Stripe Customer email changes.
5. Sign in as Admin. Verify the full plan, cadence, dates, state, and contact are readable, with no financial or edit action. Editor and Viewer must not receive Billing access.

### D. Past-due payment recovery

Use a separate Stripe sandbox simulation or test clock so the successful baseline remains available. Attach Stripe's test card `4000 0000 0000 0341` as the Customer default payment method; it attaches successfully but fails when charged. Advance the simulation to a renewal and allow the invoice attempt and subscription update events to reach Convex.

1. Verify the synchronized Subscription becomes `past_due` and the Organization retains Premium during Stripe retries.
2. Verify an Owner sees a semantic `Payment needs attention` alert and `Update payment method`; Admin sees the state but no recovery action.
3. Open recovery and verify Stripe uses its hosted payment-method-update flow.
4. Replace the method with Stripe's successful test card and complete payment of the open invoice.
5. Verify signed webhooks return the Subscription and UI to active without changing the Customer or Organization mapping.

Stripe documents the failure card and test clocks at <https://docs.stripe.com/billing/testing> and <https://docs.stripe.com/billing/testing/test-clocks/simulate-subscriptions>.

### E. Cancellation at period end

1. As Owner, use the Customer Portal to schedule cancellation at the end of the current period.
2. Verify `customer.subscription.updated` reaches Convex with cancellation scheduled.
3. Verify Billing shows the exact access end date, Premium remains effective, and Project writes still work before that date.
4. Advance the sandbox simulation past the period end or wait for the test-mode lifecycle to emit `customer.subscription.deleted`.
5. Verify the Organization returns to Free, Project reads remain available, and Project writes are refused.

## 6. Automated proof before the provider rehearsal

Run the deterministic application and provider-adapter checks without real credentials:

```bash
pnpm vitest run \
  convex/billingService.test.ts \
  convex/billingActions.test.ts \
  convex/billingEntitlements.test.ts \
  convex/stripeBillingProvider.test.ts \
  tests/billing.test.ts \
  tests/billingCheckout.test.ts \
  tests/billingEntitlementOverview.test.ts \
  tests/billingManagement.test.ts \
  tests/projectsPremium.test.ts \
  src/components/billing/organization-billing.test.tsx \
  src/components/projects/project-manager.test.tsx
```

Then run the repository gate:

```bash
pnpm check
pnpm test:e2e
```

Automated provider doubles prove authorization, idempotency, concurrency, state normalization, Project gating, UI semantics, and that temporary URLs or secrets are not persisted. They do not prove that an adopter configured the external Stripe Dashboard correctly. Keep the sandbox lifecycle record as the authoritative provider-dependent proof.

## 7. Rehearsal record template

| Check            | Evidence to record                                                                 | Result  |
| ---------------- | ---------------------------------------------------------------------------------- | ------- |
| Target isolation | Convex development deployment and Stripe test-mode account names                   | Pending |
| Catalog          | Both lookup keys, intervals, amounts, and currency observed through the Billing UI | Pending |
| Forged return    | Free remains effective and Project write is refused                                | Pending |
| Checkout         | Hosted session, one Customer, one Subscription, successful signed webhook          | Pending |
| Premium          | Reactive plan update and successful Project write                                  | Pending |
| Portal           | Fresh Owner session, return to same Organization, Admin read-only                  | Pending |
| Recovery         | `past_due`, Premium retained, hosted method update, active recovery                | Pending |
| Cancellation     | Exact end date, Premium through period, Free after deletion event                  | Pending |
| Data hygiene     | No secret, card data, Checkout URL, or Portal URL in evidence                      | Pending |

Every row must be completed for the adopter's own sandbox before live-mode approval. A screenshot of a success page, a Stripe Dashboard object without webhook delivery, or an application URL containing `checkout=success` is not sufficient evidence.

## UI research traceability

The Billing cockpit and hosted-provider boundary are grounded in `docs/research/stripe-billing-ui-flows.md`. Mobbin was requested as the first inspiration source, but no callable Mobbin tool was available in the implementation session. The research therefore uses current primary Stripe documentation and official Linear and Slack documentation, records that limitation explicitly, and adapts patterns to this repository instead of claiming a Mobbin reproduction.
