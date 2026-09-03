# Customize the starter

## Brand

- Change the product name and default description in `src/lib/brand.ts`.
- Replace the icon implementation in `src/components/brand-mark.tsx`. Keep its accessible decorative behavior when the adjacent product or Organization name already identifies the application.
- Replace the Geist font imports and `--font-sans` / `--font-mono` mappings in `src/app/layout.tsx` and `src/app/globals.css` to change typography.

## Colors and themes

The semantic light and dark tokens live in `src/app/globals.css`. Change `--primary`, `--background`, `--card`, `--muted`, `--border`, and the matching `.dark` values instead of adding one-off colors to components. The `ThemeToggle` supports light, dark, and system preferences and stores the choice under `get-some-proof-theme`.

## Charts

The chart palette uses `--chart-1` through `--chart-5`; the default series map to `--chart-line-primary` and `--chart-line-secondary`. Keep charts on those tokens so brand changes work in both themes.

The files in `src/components/charts/` were installed as source from the Bklit shadcn registry component `@bklit/bar-chart`. Bklit documents its registry chart components as MIT licensed, and the upstream notice is preserved in `src/components/charts/LICENSE.bklit.md`. Bklit Studio is proprietary and is intentionally not included. Update the chart source through the registry command documented in `components.json`, review the resulting diff, and preserve exact dependency pins.

The registry source has a narrowly scoped ESLint override in `eslint.config.mjs` for React hook/compiler rules that the upstream chart implementation does not currently satisfy. Application code remains subject to the full lint configuration.

## Stripe Billing

- Rename the Stripe Product and set its statement, support, logo, icon, accent color, and hosted Checkout branding in the Platform Stripe Account. Keep application colors on the existing semantic theme tokens; do not copy Stripe branding into the dashboard.
- Keep the code-level lookup key `pro_monthly` unless the provider contract, validators, tests, and adoption guide are changed together. It must resolve to exactly one active EUR 29 monthly Price. The server validates the catalog value; React only renders the sanitized server response.
- Configure Customer Portal features in Stripe rather than rebuilding payment methods, invoices, tax identifiers, or cancellation forms locally. Keep plan switching disabled for the one-plan MVP.
- Keep paid capability checks server-side for text collection, stored Ready videos, MP4 download, and attribution removal. Hidden buttons are never an entitlement boundary.

See `docs/stripe-billing.md` for the complete sandbox-first setup and verification procedure.
