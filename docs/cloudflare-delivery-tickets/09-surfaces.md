# 9. Serve hosted and existing embedded proof entirely through Cloudflare

## Parent

#168 — Independent Cloudflare delivery for Walls, Widgets and product media. This ticket implements stories 1, 2, 3, 11, 17, 18, 24, 36, 37, 38. The full parent contract and accepted delivery decisions apply.

This updates the existing delivery ticket under the new #168 contract; its former #65 delivery assumptions are superseded. Preserve the historical implementation evidence and unrelated Studio work.

## What to build

Existing v1/v2 installs, hosted Public Walls and hosted Widget links render through Cloudflare with all current templates and no application visitor dependency.

## Acceptance criteria

- [ ] Replace this ticket's former Vercel-origin/300-second-cache design with the new parent specification: Worker+KV publication delivery, accepted eventual propagation and no visitor Next.js/Convex request on any path.
- [ ] Serve public hosted HTML, shared renderer, scripts/CSS, decorative/static assets, images, fonts, player dependencies and revision-consistent pagination through the intended Cloudflare/Mux video paths. Preserve canonical links and public Wall/widget behavior.
- [ ] Prove routing/TLS feasibility for existing script/API/hosted URLs including cached immutable v1 runtimes. Old paths may be handled at Cloudflare but must not forward required visitor work to Next.js. Preserve explicit application navigation such as signup/collection.
- [ ] Preserve all delivered Studio templates, independent selections, order, visibility, highlights, source links/icons, typography, accessibility, Promotion Card rules and lazy videos rather than rebuilding delivered #68/#69 work.
- [ ] Keep domain onboarding mandatory for new installs with explicit localhost, while applying a documented progressive compatibility plan for old installs. Hosted public navigation is intentionally separate from external embedding policy.
- [ ] Deliver compatible automatic runtime releases through stable snippets and retained immutable artifacts. Rehearse rollback with a still-Cloudflare runtime; changing the pointer cannot make an old JS/dependency unavailable.
- [ ] Already-open pages neither poll nor clear themselves on a timer. Reload gets an available valid publication subject to KV propagation; user-triggered continuation/media operations obey validity.
- [ ] Use browser network deny rules to prove cold/warm hosted, v1/v2, all-template, multi-widget and pagination scenarios never call application serving origins or direct Convex. Pass local/clean-clone/CI/review gates and targeted desktop/mobile attachment proof.

## Blocked by

- #170
- #171
- #173
- #174
- #175
- #176

## Implementation workflow

Use /implement with /tdd at the agreed publication/delivery, media lifecycle and browser seams, then /code-review on both Standards and Spec. Consult current Context7/provider docs and repository Convex/Next.js guidance when applicable. Use the relevant Cloudflare, Convex, React and visual-evidence skills; publish current-head screenshots through gh-image for visible changes. Record real local/remote gates and keep unproven checkboxes open. Preserve unrelated work in an isolated codex worktree. This issue does not authorize merging, new paid services or production changes; the separate execution gate carries production approval and elapsed-retention requirements.
