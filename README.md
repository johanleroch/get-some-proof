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
