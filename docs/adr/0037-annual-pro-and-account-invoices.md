# Annual Pro and Account invoices

Owner decision, 2026-09-08. Supersedes the monthly-only restriction in ADR 0021.

Owner update, 2026-09-12: production pricing is EUR 15 monthly and EUR 150 annually, excluding tax, with Stripe Managed Payments. This replaces the original EUR 29/290 offer; existing subscriptions remain Stripe-owned.

Pro offers EUR 15 monthly (`pro_monthly`) and EUR 150 annually (`pro_annual`), paid in one annual charge. Both grant identical Account entitlements and quotas. Display the billed amount prominently, and the annual monthly equivalent below it. Show “2 months free” only when the current catalog prices substantiate that saving. Stripe remains authoritative for amounts and existing subscriptions; no automatic migration or custom proration is introduced.

Account Billing lists finalized Stripe invoices with bounded pagination and available PDF links. Resolve the Customer from the authenticated Owner's Account on the server, never from a browser-supplied Customer or Project ID. Invoice history and a fresh Customer Portal session remain accessible after downgrade and after the last Project is deleted, until Account deletion starts. Keep Stripe invoice URLs out of persistent storage and hide draft invoices.

Delivery is limited to code, tests, review and sandbox validation; production activation remains separate.
