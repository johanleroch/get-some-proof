# 1. Publish and render one Widget through Cloudflare without application reads

## Parent

#168 — Independent Cloudflare delivery for Walls, Widgets and product media. This ticket implements stories 1, 4, 5, 12, 34, 35. The full parent contract and accepted delivery decisions apply.

## What to build

An Owner publishes one text-only Widget in an isolated environment and loads it from a separate site while Next.js and Convex visitor access are denied. This is the first complete implementation slice, including the provider feasibility and cost baseline.

## Acceptance criteria

- [ ] Inspect the actual Cloudflare account/zone/Workers capabilities, deployment targets and existing authentication read-only. Report provider/runtime/purpose/placement for needed credentials without values. Price a minimum staging/production topology against EUR 10–20 Cloudflare-only monthly target before any paid provisioning.
- [ ] Create an independently built/deployed rendering runtime on Workers Static Assets and a dedicated Worker/KV binding; preserve the existing product renderer and design. A narrow text Widget is sufficient for this slice.
- [ ] Reuse and, where necessary, prefactor the current public projection and delivery preparation behind one publication/delivery interface. Publish a bounded public-safe versioned envelope from an authorized source action into KV with revision and absolute validity.
- [ ] The external browser receives the Widget through Cloudflare only on warm and cold reads. Missing keys, invalid queries, stale/unsupported schema and provider failures never call or redirect to Next.js/Convex and never trigger generation.
- [ ] Keep drafts private, wrong-Project writes denied, secrets out of browser output and current paths working until explicit cutover. Scope canary access to explicitly configured staging origins; production domain onboarding follows its own ticket.
- [ ] Add behavior tests at the module interface and a separate-origin browser fixture with explicit network-deny assertions. Demonstrate content, empty and unavailable cases with bounded requests.
- [ ] Record a canary deployment/run evidence trail with actual environment names and costs. All further public functionality remains gated from production until certification. Complete applicable local checks, review, current-head CI and targeted desktop/mobile evidence.

## Blocked by

None — can start immediately.

## Implementation workflow

Use /implement with /tdd at the agreed publication/delivery, media lifecycle and browser seams, then /code-review on both Standards and Spec. Consult current Context7/provider docs and repository Convex/Next.js guidance when applicable. Use the relevant Cloudflare, Convex, React and visual-evidence skills; publish current-head screenshots through gh-image for visible changes. Record real local/remote gates and keep unproven checkboxes open. Preserve unrelated work in an isolated codex worktree. This issue does not authorize merging, new paid services or production changes; the separate execution gate carries production approval and elapsed-retention requirements.
