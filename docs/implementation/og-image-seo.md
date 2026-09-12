# Branded sharing and SEO

Source: owner request on 2026-09-12 to use the mascot and brand typography in the Open Graph image and make shared links display correctly.

## Acceptance and evidence

- A public 1200 × 630 PNG uses the official happy mascot, Gelica Black and the paper/amber palette. Source: `scripts/brand/build-social-card.mjs`; regenerate with `node scripts/brand/build-social-card.mjs` after installing Playwright Chromium. The generator uses only local assets. The image contains only the wordmark, mascot and amber underline, with no tagline. Serving the committed PNG needs no font fetch or backend.
- Open Graph and X large-image cards include image dimensions and alt text. `e2e/seo.spec.ts` checks crawler HTML and the actual PNG response.
- Public templates and Walls have self-canonical URLs and page-specific sharing titles/descriptions. `src/lib/public-wall-metadata.test.ts` covers Wall metadata and empty-Wall noindex behavior.
- Default noindex keeps authentication, account, invitation, import, developer and token routes out of search. The template gallery and nonempty Walls opt into indexing. Robots permits fetching noindex pages and share assets; the sitemap contains only the indexable template gallery. The root still redirects to authentication and is intentionally absent from the sitemap.
- `social-card` in `visual-evidence.config.json` demonstrates the committed PNG in desktop/mobile link-preview fixtures. This is a local preview, not evidence of an external social platform refreshing its cache.

## Delivery

Base: `7346604`.

The original checkout contains unrelated billing work; this change lives in the isolated `codex/og-image-seo` worktree. Merge and production deployment are separate from this implementation.

React Doctor was invoked with the skill command, but the current CLI requires project installation and did not scan. No dependency or skill installation is included in this SEO change. ESLint, TypeScript, unit/browser tests and the two-axis review remain the validation sources.
