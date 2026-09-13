# 7. Serve inherited, catalogue and uploaded Widget fonts through Cloudflare

## Parent

#168 — Independent Cloudflare delivery for Walls, Widgets and product media. This ticket implements stories 25, 26, 27, 36. The full parent contract and accepted delivery decisions apply.

## What to build

An Owner previews and publishes a Widget using host inheritance, a catalogue family or an uploaded WOFF2 font, with Cloudflare delivering all fonts supplied by the product.

## Acceptance criteria

- [ ] Preserve inheritance and system fallback behavior without introducing a font download on behalf of Get Some Proof; host-site font resources remain the host's responsibility.
- [ ] Move uploaded fonts through validated Project-owned R2 storage with current format/size/library/entitlement limits, private preview and applicable published access.
- [ ] Prepare self-hostable catalogue faces before publication, preserve source/licence/version metadata and required language/style/weight coverage, and ensure no visitor request fetches Google Fonts or invokes a conversion.
- [ ] Use versioned catalogue/upload keys, correct MIME/CORS, scoped family aliases, readable fallback and deduplicated on-demand loading across multiple Widgets. Account for browser CSP requirements in install guidance.
- [ ] Match preview and public rendering and refresh publication on selected-font changes, removal and entitlement changes. Do not automatically redistribute licensed application-only fonts.
- [ ] Test multiple fonts/Widgets, non-Latin or supported subset coverage, missing font fallback, CORS, removal and wrong-Project access. Pass gates and targeted font settings/public visual evidence.

## Blocked by

- #172
- #170

## Implementation workflow

Use /implement with /tdd at the agreed publication/delivery, media lifecycle and browser seams, then /code-review on both Standards and Spec. Consult current Context7/provider docs and repository Convex/Next.js guidance when applicable. Use the relevant Cloudflare, Convex, React and visual-evidence skills; publish current-head screenshots through gh-image for visible changes. Record real local/remote gates and keep unproven checkboxes open. Preserve unrelated work in an isolated codex worktree. This issue does not authorize merging, new paid services or production changes; the separate execution gate carries production approval and elapsed-retention requirements.
