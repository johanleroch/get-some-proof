# 4. Collect and revise Submitter Photos through private R2 storage

## Parent

#168 — Independent Cloudflare delivery for Walls, Widgets and product media. This ticket implements stories 19, 21, 22, 27. The full parent contract and accepted delivery decisions apply.

## What to build

A Submitter uploads or replaces a photo, an Owner moderates it privately, and publication delivers the photo from Cloudflare with revocable public access.

## Acceptance criteria

- [ ] Expand the image registry/reference contract to support existing Convex storage and R2 concurrently without breaking current callers. Keep provider details behind the media lifecycle interface.
- [ ] Wire actual collection, management-link revision and imported Submitter Photo paths through verified upload intent, existing WebP normalization/limits, trusted content validation, owned object registration and attachment.
- [ ] Use separate environment resources, Project-first stable asset/variant/hash keys and technical object metadata; strip personal EXIF/GPS and avoid private data in public URLs or metadata responses.
- [ ] Use private R2 with controlled media serving and no direct public bucket bypass. Private preview requires a bounded authorized capability; public delivery checks Cloudflare policy before cache hits/misses without any visitor Convex/Next.js call. Require browser revalidation for revocable media and check access before conditional responses as well as edge byte-cache hits.
- [ ] Revise/archive/withdraw/delete a photo and prove public direct-URL access ceases after allowed propagation while authorized Owner access to archived media remains. Handle orphaned uploads, unknown-result provider operations and retryable deletion.
- [ ] Integrate verified R2 URLs into the publication contract, keeping public state and media readiness coherent. Account for per-media authorization reads in cost counters.
- [ ] Test end-to-end upload to published image, wrong owner/Project, tampering, unsafe type, expired capability, cache bypass and concurrent replacement/deletion. Pass gates and targeted collection/management/public proof evidence.

## Blocked by

- #169

## Implementation workflow

Use /implement with /tdd at the agreed publication/delivery, media lifecycle and browser seams, then /code-review on both Standards and Spec. Consult current Context7/provider docs and repository Convex/Next.js guidance when applicable. Use the relevant Cloudflare, Convex, React and visual-evidence skills; publish current-head screenshots through gh-image for visible changes. Record real local/remote gates and keep unproven checkboxes open. Preserve unrelated work in an isolated codex worktree. This issue does not authorize merging, new paid services or production changes; the separate execution gate carries production approval and elapsed-retention requirements.
