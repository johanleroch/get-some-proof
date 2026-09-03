# Get Some Proof

Get Some Proof helps a small Brand collect text and video Testimonials, review them privately, and publish selected proof on a hosted or embedded wall.

The application is built on the Convex Admin Starter foundations for verified authentication, secure tenant authorization, audit history, account security, optional transactional email, and optional Stripe billing. Product behavior is specified in `docs/product-scope.md` and the domain language lives in `CONTEXT.md`.

## Requirements

- Node.js 24 or newer
- pnpm 11.24.0 through Corepack
- A Convex development deployment for interactive local use

## Local setup

Install exactly what the committed lockfile describes:

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev:convex --once
```

The Convex command creates or connects a development deployment and writes its public URLs to `.env.local`. Set the local public origin there:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Configure local-only server values in that Convex development deployment:

```bash
pnpm convex env set SITE_URL http://localhost:3000
pnpm convex env set BETTER_AUTH_SECRET "replace-with-a-local-random-secret"
pnpm convex env set EMAIL_PROVIDER console
```

The console email provider refuses non-localhost origins and prints verification and reset links to the Convex development logs. Automated tests use the silent test adapter.

Public collection requests are verified with Cloudflare Turnstile before quota
or persistence logic runs. Localhost uses Cloudflare's official visible test
widget and matching test secret automatically. Any deployed environment must
set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Next.js plus `TURNSTILE_SECRET` and a
comma-separated, deployment-specific `TURNSTILE_HOSTNAMES` in Convex; missing
deployment configuration fails closed.

Run Convex and Next.js in separate terminals:

```bash
pnpm dev:convex
```

```bash
pnpm dev
```

Open `http://localhost:3000`, create a verified Owner, then configure the one Brand and its Collection Form. No production provider is required or configured by this setup.

## Optional providers

- Google sign-in requires development OAuth credentials.
- Stripe remains disabled without sandbox secrets; live billing is not part of local setup.
- Mux is introduced behind a fake/local provider before any sandbox or production access is required.

Never place server credentials in a `NEXT_PUBLIC_` variable. Do not provision production services from these instructions.

## Quality commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm check` runs every non-browser quality check and the production build.

## Documentation

- [Approved MVP scope](docs/product-scope.md)
- [Architecture and security](docs/architecture.md)
- [Authentication and authorization research](docs/research/authentication-authorization-multitenancy.md)
- [Stripe sandbox adoption](docs/stripe-billing.md)
- [Verification matrix](docs/verification.md)
- [Domain language](CONTEXT.md) and [architecture decisions](docs/adr/)
