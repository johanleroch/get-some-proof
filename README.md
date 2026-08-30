# Convex Admin Starter

An opinionated, production-oriented foundation for building secure multi-tenant administration products with Next.js and Convex.

## Requirements

- Node.js 20.9 or newer
- pnpm 11.24.0 through Corepack
- A Convex account for a persistent development deployment

## Local setup

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev:convex
```

The Convex command creates or connects a development deployment and writes its public URL to `.env.local`. In another terminal, start Next.js:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Until the required public variables are configured, the application renders an actionable setup screen instead of failing during the build.

Add the local site URL to `.env.local` if it is not already present:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Authentication setup

Better Auth runs inside the Convex deployment. Configure its site URL and a unique secret:

```bash
pnpm convex env set SITE_URL http://localhost:3000
pnpm convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 48)"
```

For local API checks that must not send mail, use the explicit test adapter. It returns synthetic provider receipts and deliberately does not expose verification or reset tokens:

```bash
pnpm convex env set EMAIL_PROVIDER test
```

For real verification and password-reset messages, configure the included Resend adapter instead:

```bash
pnpm convex env set EMAIL_PROVIDER resend
pnpm convex env set RESEND_API_KEY re_your_key
pnpm convex env set EMAIL_FROM "Convex Admin Starter <noreply@your-domain.com>"
```

Google sign-in is enabled when both credentials are present in the Convex environment:

```bash
pnpm convex env set GOOGLE_CLIENT_ID your-client-id
pnpm convex env set GOOGLE_CLIENT_SECRET your-client-secret
```

Register `http://localhost:3000/api/auth/callback/google` as the local authorized redirect URI in Google Cloud. Use the equivalent application origin in deployed environments. Omitting the Google credentials removes the server provider without changing code.

Never put `BETTER_AUTH_SECRET`, provider secrets, or Resend credentials in a `NEXT_PUBLIC_` variable.

## Quality commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run all non-secret-dependent checks with `pnpm check`.

## Architecture

The accepted product scope and security decisions are documented in `docs/product-scope.md`, `CONTEXT.md`, and `docs/adr/`. The primary-source authentication and authorization research is in `docs/research/authentication-authorization-multitenancy.md`.
