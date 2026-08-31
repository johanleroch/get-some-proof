# Convex Admin Starter

An opinionated, production-oriented foundation for secure multi-tenant administration products with Next.js, Convex, Better Auth, and convex-authz.

## Requirements

- Node.js 24 or newer
- pnpm 11.24.0 through Corepack
- A Convex account

## Clean-clone quickstart

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

Configure secrets in the Convex deployment environment, never in a `NEXT_PUBLIC_` variable:

```bash
pnpm convex env set SITE_URL http://localhost:3000
pnpm convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 48)"
```

Choose one authentication-email path:

- For API and UI development that must not send email, set `pnpm convex env set EMAIL_PROVIDER test`. This adapter deliberately does not deliver verification or reset links.
- For a complete email/password flow, configure Resend:

```bash
pnpm convex env set EMAIL_PROVIDER resend
pnpm convex env set RESEND_API_KEY 're_your_key'
pnpm convex env set EMAIL_FROM 'Your Product <noreply@example.com>'
```

Google sign-in is optional and enabled only when both credentials exist:

```bash
pnpm convex env set GOOGLE_CLIENT_ID 'your-client-id'
pnpm convex env set GOOGLE_CLIENT_SECRET 'your-client-secret'
```

Register `http://localhost:3000/api/auth/callback/google` as the local Google OAuth redirect URI.

Start Convex and Next.js in separate terminals:

```bash
pnpm dev:convex
```

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), create or sign into a verified User, then create the first Organization in onboarding. The User becomes its first Owner and receives a stable Organization URL.

## Optional local demonstration seed

The seed creates one Organization, all four Membership roles, active and archived Projects, convex-authz assignments, and Audit Events. It is idempotent and is an internal Convex function. It requires all three protections: a local `SITE_URL`, the temporary server flag, and a literal CLI confirmation.

Inspect the current development target, enable the flag, run the seed, and immediately remove the flag:

```bash
pnpm convex env list
pnpm convex env set ALLOW_DEMO_SEED true
pnpm seed:demo -- --confirm-local-demo
pnpm convex env remove ALLOW_DEMO_SEED
```

To make an existing verified Better Auth User the demo Owner:

```bash
pnpm seed:demo -- --confirm-local-demo --owner-email you@example.com
```

The function refuses a non-local `SITE_URL` even when the temporary flag is present. It never creates login credentials; without `--owner-email`, the seeded identities are synthetic examples for data and server evaluation.

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

`pnpm check` runs every non-browser quality and production-build check. CI additionally runs the Playwright suite in desktop and mobile Chromium projects.

## Documentation

- [Product scope](docs/product-scope.md)
- [Architecture and security](docs/architecture.md)
- [Authentication and authorization research](docs/research/authentication-authorization-multitenancy.md)
- [Customization and Bklit boundary](docs/customization.md)
- [Vercel + Convex deployment](docs/deployment.md)
- [Specification verification matrix](docs/verification.md)
- [Domain language](CONTEXT.md) and [architecture decisions](docs/adr/)
