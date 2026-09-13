# 2. Declare Project embedding sites and enforce localhost-aware delivery

## Parent

#168 — Independent Cloudflare delivery for Walls, Widgets and product media. This ticket implements stories 13, 14, 15, 16, 17. The full parent contract and accepted delivery decisions apply.

## What to build

An Owner adds production and local test sites, copies a Widget snippet and sees it work only on declared browser origins.

## Acceptance criteria

- [ ] Add Owner-authorized Project settings for explicit allowed origins and require at least one before a new external installation. HTTPS production and HTTP localhost with a chosen port are supported; normalize URLs without accepting suffix-match attacks or wildcard shared providers.
- [ ] Treat apex/www, ports, preview hosts and loopback aliases explicitly; no DNS verification in this version and no auto-authorization from first request/Referer.
- [ ] Synchronize policy into the delivery state and reject undeclared, missing and null external origins before returning content. Document separately authenticated dashboard preview and publicly navigable hosted surface behavior.
- [ ] Apply policy to cached and uncached responses; build CORS headers only for an authorized caller and demonstrate that allowed-origin responses cannot leak via cache to an unapproved origin.
- [ ] Handle KV propagation, policy changes and rollback revisions without silently broadening access. User-visible copy accurately describes eventual propagation and the limits of Origin/CORS.
- [ ] Provide actionable installation errors without breaking the customer's page or revealing private metadata. Existing sites get a staged transition; discovered sites can only be suggestions awaiting Owner declaration.
- [ ] Test another Owner's Project, HTTPS production, explicit localhost ports, missing/null origin, browser denial, spoofed non-browser headers and several Widgets on a page. Pass delivery gates and publish changed settings/install desktop/mobile evidence.

## Blocked by

- #169

## Implementation workflow

Use /implement with /tdd at the agreed publication/delivery, media lifecycle and browser seams, then /code-review on both Standards and Spec. Consult current Context7/provider docs and repository Convex/Next.js guidance when applicable. Use the relevant Cloudflare, Convex, React and visual-evidence skills; publish current-head screenshots through gh-image for visible changes. Record real local/remote gates and keep unproven checkboxes open. Preserve unrelated work in an isolated codex worktree. This issue does not authorize merging, new paid services or production changes; the separate execution gate carries production approval and elapsed-retention requirements.
