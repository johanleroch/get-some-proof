# 6. Publish default and selected video thumbnails from Cloudflare R2

## Parent

#168 — Independent Cloudflare delivery for Walls, Widgets and product media. This ticket implements stories 23, 24, 27. The full parent contract and accepted delivery decisions apply.

## What to build

A default video still, selected frame or custom Thumbnail appears on published proof from Cloudflare while the actual video continues playing through Mux.

## Acceptance criteria

- [ ] Materialize default stills and Owner-selected frame images into normalized owned R2 assets before activating references. Preserve the current default-frame and selected-time behavior.
- [ ] Cover custom Thumbnail upload, video replacement, Mux readiness/callback changes, selected-frame changes and late duplicate processing without resurrecting deleted video proof.
- [ ] Keep an eligible prior thumbnail during an ordinary processing failure without incorrectly extending withdrawn publication. Provide observable retry/failure behavior and clean failed temporary assets.
- [ ] Refresh affected public copies and remove old R2/Convex thumbnail references through verified lifecycle cleanup. All published still/image loads use Cloudflare, including list/template variants.
- [ ] Keep video playback on Mux and load it only on intent; player runtime/policy dependencies use Static Assets. Private thumbnail-selection tooling may use Mux.
- [ ] Test default/selected/custom paths, portrait/landscape, failed conversion, late callbacks, deletion race and network assertions distinguishing Mux video from forbidden direct still loads. Pass gates and targeted visual proof.

## Blocked by

- #172
- #171

## Implementation workflow

Use /implement with /tdd at the agreed publication/delivery, media lifecycle and browser seams, then /code-review on both Standards and Spec. Consult current Context7/provider docs and repository Convex/Next.js guidance when applicable. Use the relevant Cloudflare, Convex, React and visual-evidence skills; publish current-head screenshots through gh-image for visible changes. Record real local/remote gates and keep unproven checkboxes open. Preserve unrelated work in an isolated codex worktree. This issue does not authorize merging, new paid services or production changes; the separate execution gate carries production approval and elapsed-retention requirements.
