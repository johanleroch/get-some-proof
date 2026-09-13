# 5. Move testimonial attachments and Brand or Account images to the R2 lifecycle

## Parent

#168 — Independent Cloudflare delivery for Walls, Widgets and product media. This ticket implements stories 19, 20, 21, 22, 27, 28. The full parent contract and accepted delivery decisions apply.

## What to build

Owners and Submitters use existing attachment, logo, customization and profile flows with R2-backed files, including export and restore.

## Acceptance criteria

- [ ] Migrate Testimonial Images, Brand logos, customization images and Owner account photos through the expanded registry and existing upload/import/revision workflows. Preserve normalization, transparent logos, limits and Account-versus-Project ownership.
- [ ] Use Account-first keys for Account-owned photos and Project-first keys for Project media. Private account/profile images must not inherit public eligibility accidentally.
- [ ] Apply expiry, replacement, quarantine, withdrawal, Project/Account deletion and orphan cleanup consistently across both providers during transition; no cross-Project deduplication of private uploads.
- [ ] Ensure public projections emit verified Cloudflare media references and that every affected publication is refreshed when media or visibility changes.
- [ ] Adapt export/backup/restore to authorized R2 media without SSRF, arbitrary URL fetching or leaked credentials; restored media belongs to the restored Project and reuses normal processing/registration.
- [ ] Demonstrate private-to-public attachments, logo/account changes, revision and deletion, and byte-verified export/restore with existing Convex and new R2 records mixed.
- [ ] Pass media lifecycle regression checks, integration and browser gates with desktop/mobile proof only for affected flows.

## Blocked by

- #172

## Implementation workflow

Use /implement with /tdd at the agreed publication/delivery, media lifecycle and browser seams, then /code-review on both Standards and Spec. Consult current Context7/provider docs and repository Convex/Next.js guidance when applicable. Use the relevant Cloudflare, Convex, React and visual-evidence skills; publish current-head screenshots through gh-image for visible changes. Record real local/remote gates and keep unproven checkboxes open. Preserve unrelated work in an isolated codex worktree. This issue does not authorize merging, new paid services or production changes; the separate execution gate carries production approval and elapsed-retention requirements.
