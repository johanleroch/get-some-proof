# Image asset migration

The image migration is intentionally separate from deployment. Deploying the
code does not enqueue or transform existing files.

First run each inventory migration with `{ "dryRun": true }`, then run it
without `dryRun` only on an explicitly approved non-production deployment:

```sh
pnpm convex run migrations:queueLegacyOwnerPhotos '{"dryRun":true}'
pnpm convex run migrations:queueLegacyBrandLogos '{"dryRun":true}'
pnpm convex run migrations:queueLegacyTestimonialImages '{"dryRun":true}'
pnpm convex run migrations:queueLegacyTestimonialAvatars '{"dryRun":true}'
pnpm convex run migrations:queueLegacyTestimonialPosters '{"dryRun":true}'
```

Preview queued transformations in batches of at most 20:

```sh
pnpm convex run imageAssetMigration:process '{"dryRun":true,"limit":5}'
```

After checking the before/after byte counts, omit `dryRun` and repeat until
`processed` is zero. Failed jobs retain their original reference and record a
safe diagnostic. Retry them explicitly with `{"retryFailed":true}` after the
cause is fixed.

Never add `--prod` without fresh production authorization. Record row counts
for queued, complete, skipped, and failed jobs before tightening any schema.
