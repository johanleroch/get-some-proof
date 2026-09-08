# Deploy with Vercel, Convex, Resend, and Google

This is the primary documented path, not an architectural requirement. Next.js can run on another compatible host, and the email and OAuth providers are replaceable.

## Environment files and production placement

The environment files have separate consumers. Replace placeholders and remove unused optional values before importing; never import an example file directly. All four working files below are ignored by Git. Never commit real keys or the downloaded Google client JSON.

| Runtime | Local file                                          | Production reference                          | Apply changes                                                                                                                            |
| ------- | --------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js | `.env.local`, based on `.env.example`               | `.env`, based on `.env.example`               | Local Next.js loads `.env.local` before `.env`; production variables must be configured in Vercel and the frontend rebuilt when changed. |
| Convex  | `.env.convex.local`, based on `.env.convex.example` | `.env.convex`, based on `.env.convex.example` | Import into the selected Convex deployment using the CLI; these files are not loaded automatically.                                      |

Editing `.env` does not upload anything to Vercel. Keep Google credentials only in the Convex files and deployments.

| Variable                                     | Production placement          | Source and purpose                                                                                            |
| -------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `CONVEX_DEPLOY_KEY`                          | Vercel, Production scope only | Convex Production deploy key with `deployment:deploy`; authenticates the build CLI.                           |
| `NEXT_PUBLIC_CONVEX_URL`                     | Vercel build                  | Production `.convex.cloud` URL; supplied by the Convex build command.                                         |
| `NEXT_PUBLIC_CONVEX_SITE_URL`                | Vercel                        | Production `.convex.site` URL for authentication HTTP requests.                                               |
| `NEXT_PUBLIC_SITE_URL`                       | Vercel                        | Canonical application origin, `https://www.getsomeproof.com` for this project; public build-time value.       |
| `SITE_URL`                                   | Convex Production             | Same canonical origin for authentication and email links.                                                     |
| `BETTER_AUTH_SECRET`                         | Convex Production             | Independently generated random authentication secret, at least 32 characters.                                 |
| `EMAIL_PROVIDER`                             | Convex Production             | Set to `resend` for real email delivery.                                                                      |
| `RESEND_API_KEY`                             | Convex Production             | Resend key with Sending access restricted to the verified sending domain.                                     |
| `EMAIL_FROM`                                 | Convex Production             | Sender on that verified domain, e.g. `Get Some Proof <noreply@getsomeproof.com>`.                             |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`             | Vercel                        | Cloudflare widget public key.                                                                                 |
| `TURNSTILE_SECRET`, `TURNSTILE_HOSTNAMES`    | Convex Production             | Matching Cloudflare secret and accepted hostnames; hostnames default to the `SITE_URL` hostname.              |
| `PUBLIC_READ_RATE_LIMIT_SECRET`              | Vercel and Convex Production  | Same random secret in both, for the Embedded Wall read limiter.                                               |
| `MUX_PROVIDER`                               | Convex Production             | Set to `mux` for real video processing.                                                                       |
| `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`           | Convex Production             | Mux Video token with Read and Write permissions in the intended Mux environment.                              |
| `MUX_WEBHOOK_SECRET`                         | Convex Production             | Signing secret of the Mux endpoint targeting `https://<prod-deployment>.convex.site/mux/webhook`.             |
| `VIDEO_WEBHOOK_INGEST_SECRET`                | Convex Production             | Random secret of at least 32 characters, required for video retry tokens even with the direct Convex webhook. |
| `MANAGEMENT_LINK_TOKEN_SECRET`               | Convex Production, optional   | Dedicated random delivery secret; falls back to `BETTER_AUTH_SECRET`.                                         |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`   | Convex Production, optional   | Google Cloud OAuth credentials.                                                                               |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Convex Production, optional   | Separately approved live billing configuration; see the Stripe section below.                                 |

If Mux instead calls the Next.js `/api/mux/webhook` route, also configure `MUX_WEBHOOK_SECRET` and the matching `VIDEO_WEBHOOK_INGEST_SECRET` in Vercel. Use the signing secret belonging to that particular Mux endpoint.

For the current project, the production deployment is `brazen-shark-68`; verify it before each import:

```bash
pnpm exec convex dashboard --prod --no-open
pnpm exec convex env set --prod --from-file .env.convex --force
pnpm exec convex env list --prod --names-only
```

The import overwrites only the supplied variables. It does not publish backend functions. `CONVEX_DEPLOYMENT` selects a CLI target but does not authenticate it; keep it and `CONVEX_DEPLOY_KEY` out of the backend import file. The build command below publishes the backend. Missing CLI authentication in Vercel produces `MissingAccessToken`: check that `CONVEX_DEPLOY_KEY` is configured for Production.

Use one canonical site origin consistently, including whether it has `www`. After changing any `NEXT_PUBLIC_*` value in Vercel, rebuild the frontend. A missing `NEXT_PUBLIC_SITE_URL` triggers the setup screen even in production.

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
NEXT_PUBLIC_SITE_URL=https://www.getsomeproof.com
```

Set the corresponding production server origin inside Convex:

```bash
pnpm convex env set SITE_URL https://www.getsomeproof.com --prod
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

Google OAuth is already wired in `convex/auth.ts`; Next.js forwards `/api/auth/*` to Convex. The Google provider is enabled only when both credentials are set. The sign-in page still displays its Google button when credentials are missing, but that flow cannot succeed; email/password remains available.

### Create the Google web client

In [Google Auth Platform](https://console.cloud.google.com/auth/overview), select the Get Some Proof project, configure the app name and contact details, then create a **Web application** client named **Get Some Proof - Web**. Choose the audience appropriate for your users; public customer sign-in uses an external audience. If Google restricts the app to test users, add the accounts used for validation before testing.

Register these exact values for the environments you use:

| Environment | Authorized JavaScript origin   | Authorized redirect URI                                 |
| ----------- | ------------------------------ | ------------------------------------------------------- |
| Local       | `http://localhost:3000`        | `http://localhost:3000/api/auth/callback/google`        |
| Production  | `https://www.getsomeproof.com` | `https://www.getsomeproof.com/api/auth/callback/google` |

The redirect is on the website, not the Convex `.convex.site` domain. `SITE_URL` in Convex and `NEXT_PUBLIC_SITE_URL` in Next.js must match the origin in this table. A different scheme, port, or `www` changes the callback URI. One web client can cover both listed environments; separate clients also work if each deployment receives its own matching credentials. See [Better Auth Google setup](https://www.better-auth.com/docs/authentication/google).

### Map the downloaded JSON to Convex

| Google JSON field   | Environment variable   | Placement                                                                       |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| `web.client_id`     | `GOOGLE_CLIENT_ID`     | `.env.convex.local` and `.env.convex`, then their respective Convex deployments |
| `web.client_secret` | `GOOGLE_CLIENT_SECRET` | Same Convex-only placement                                                      |

Uncomment and replace the two Google placeholders in each real Convex file. Do not paste the entire JSON into an environment variable. No Google variable is needed in Next.js or Vercel, including under `NEXT_PUBLIC_*`.

For a running local Convex deployment:

```bash
pnpm exec convex dashboard --deployment local --no-open
pnpm exec convex env set --deployment local --from-file .env.convex.local --force
pnpm exec convex env list --deployment local --names-only
```

For production, first verify that the dashboard URL identifies the intended deployment (`brazen-shark-68` for this project), then import:

```bash
pnpm exec convex dashboard --prod --no-open
pnpm exec convex env set --prod --from-file .env.convex --force
pnpm exec convex env list --prod --names-only
```

These commands overwrite every variable supplied by the file, not only Google credentials. For an existing deployment where only Google should change, import a temporary private file containing only `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then delete it. Do not reapply unrelated placeholder values. `--names-only` confirms presence without printing secrets; verify values against the JSON privately when needed.

Changing these Convex variables does not require deploying backend functions or rebuilding Next.js. Changing Next.js public URLs does require updating the hosting environment and rebuilding.

### Verify the complete flow

1. Open `/sign-in` on the target website and choose **Continue with Google**.
2. Confirm the authorization page is on `accounts.google.com` and uses the expected client and exact callback URI.
3. Complete account selection and consent, then verify the application receives an authenticated session after the callback.

An authorization URL alone proves provider configuration, not a completed login. `redirect_uri_mismatch` means the generated callback does not exactly match a registered Google redirect URI. A missing-provider error means one or both credentials are absent on the Convex deployment reached by Next.js. Google configuration changes can take time to propagate.

On 2026-09-08, both credentials were imported and privately compared with the downloaded JSON on local `local-johan_roch-get_some_proof` and production `brazen-shark-68`. Both websites returned HTTP 200 with an `accounts.google.com` authorization URL and the callback listed above. Account selection, consent and the final authenticated session were not verified in that setup check; repeat the complete flow after configuration changes.

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

## Public Wall server boundary

Configure the matching server-side read credential in Next.js and the selected Convex deployment before serving hosted or embedded Walls. See [Public Wall delivery boundary](public-wall-boundary.md) for credential placement, requester trust, rotation, entry-point inventory and the optional gateway origin lock. This document describes configuration requirements; repository changes do not establish deployment state.
