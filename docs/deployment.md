# Deploy with Vercel, Convex, Resend, and Google

This is the primary documented path, not an architectural requirement. Next.js can run on another compatible host, and the email and OAuth providers are replaceable.

## 1. Create the production Convex deployment

Create or select the Convex project, then generate a production deploy key with deployment permission. Add it to the Vercel project as the secret `CONVEX_DEPLOY_KEY`. Never prefix it with `NEXT_PUBLIC_`.

Set the Vercel build command to:

```bash
pnpm exec convex deploy --cmd 'pnpm build'
```

Convex deploys the backend and supplies the production Convex URL while the frontend build runs.

## 2. Configure the public site

Set this Vercel environment variable for Production and Preview as appropriate:

```dotenv
NEXT_PUBLIC_SITE_URL=https://admin.example.com
```

Set the corresponding production server origin inside Convex:

```bash
pnpm convex env set SITE_URL https://admin.example.com --prod
pnpm convex env set BETTER_AUTH_SECRET 'a-unique-random-secret-of-at-least-32-characters' --prod
```

Use a different Better Auth secret for every environment.

## 3. Configure Resend

Verify the sending domain in Resend, then set the provider only in the Convex production environment:

```bash
pnpm convex env set EMAIL_PROVIDER resend --prod
pnpm convex env set RESEND_API_KEY 're_...' --prod
pnpm convex env set EMAIL_FROM 'Your Product <noreply@example.com>' --prod
```

To replace Resend, add another adapter behind `convex/email/provider.ts`; no Invitation or authentication caller should import a vendor SDK.

## 4. Configure Google OAuth

Create Google OAuth web credentials and register this authorized redirect URI:

```text
https://admin.example.com/api/auth/callback/google
```

Store the credentials in Convex, not Vercel public variables:

```bash
pnpm convex env set GOOGLE_CLIENT_ID '...' --prod
pnpm convex env set GOOGLE_CLIENT_SECRET '...' --prod
```

Google login is omitted when either credential is absent; email/password remains available.

## 5. Validate before traffic

- Open signup, verification, signin, password reset, Google callback, and two-factor flows on the final domain.
- Create the first Organization and verify the slug remains stable after a rename.
- Exercise all four roles, cross-Organization selectors, Invitations, Session revocation, and the Audit Log.
- Confirm real emails arrive with the correct absolute links and sender authentication.
- Keep `ALLOW_DEMO_SEED` unset. The demonstration seed additionally refuses any non-local `SITE_URL`, but it is not a production migration tool.

## 6. Promote Stripe Billing separately

Stripe Billing is optional and must first pass the complete sandbox rehearsal in `docs/stripe-billing.md`. That rehearsal deliberately configures only a disposable Convex development deployment and Stripe test mode.

Enabling live billing is a separate production change. It requires explicit approval for the exact Platform Stripe Account and Convex production deployment before any live-mode webhook, `sk_live_` secret, production `whsec_` secret, Price, Portal configuration, or `--prod` command is created or changed. Do not copy test-mode object IDs or secrets into live mode.

After approval, repeat the documented setup in Stripe live mode with the final production origin and the production webhook URL. Store `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` only in the Convex production environment. Then repeat the verification matrix with a deliberately controlled live charge and refund plan agreed by the operator before opening traffic. Documentation or sandbox success alone is not authorization to perform these actions.
