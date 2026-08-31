# Visual evidence

The repository captures canonical public screens with Playwright at desktop and mobile sizes, publishes immutable PNG objects to Cloudflare R2, and maintains one replaceable GitHub comment per issue or pull request.

## Storage layout

Bucket: `screenshots`

Public base URL: `https://screenshots.johancode.fr`

Objects are isolated first by project, then by tracker target and exact commit:

```text
convex-admin-starter/
  pulls/<pr-number>/<40-character-sha>/<viewport>/<screen>.png
  issues/<issue-number>/<40-character-sha>/<viewport>/<screen>.png
```

The bucket lifecycle removes objects under `convex-admin-starter/` after 365 days. Comments point to commit-specific objects, so browser and CDN caches cannot show a screenshot from another revision.

## Security boundary

The capture workflow checks out and executes pull-request code without Cloudflare credentials. It uploads only a GitHub artifact.

The publisher is triggered by the completed capture workflow. It checks out trusted code from the default branch, validates the artifact manifest and every file path, refuses stale PR commits, then uploads to R2 and updates the GitHub comment. It never executes pull-request code or artifact content.

The manifest project must match the project in the trusted default-branch `visual-evidence.config.json`; pull-request code cannot select another R2 prefix. The bucket, endpoint, public hostname, project prefix, and screen list all live in that one configuration file.

For issues without a pull request, an agent runs `pnpm visual:publish:issue` after capture and manifest creation. The command uses the authenticated Wrangler and GitHub CLIs, requires the current commit to match the manifest, verifies every public object byte-for-byte, and updates the same marked comment instead of adding duplicates.

## Repository secrets

Configure these GitHub Actions secrets:

- `R2_ACCESS_KEY_ID`: access-key ID for an R2 Object Read & Write token limited to the `screenshots` bucket.
- `R2_SECRET_ACCESS_KEY`: matching secret access key.

The workflow commits the non-secret endpoint, bucket, and public hostname. Do not place credentials in `.env` files, workflow YAML, issue comments, or logs.

## Bootstrap and clones

GitHub only triggers a `workflow_run` publisher when its workflow file exists on the default branch. On the pull request that first introduces this system, the capture and local validation can pass, but automatic publication starts after that workflow reaches the default branch. All later pull requests are fully automatic.

For a clone under a different project or Cloudflare account, update every non-secret value in `visual-evidence.config.json`, create the project prefix and lifecycle rule, connect a public R2 hostname, and configure the two repository secrets.
