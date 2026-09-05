# Visual evidence

Playwright captures canonical desktop and mobile screens. The publisher uploads PNGs with `gh-image`, verifies their bytes through an authenticated download, then creates or replaces one GitHub comment. Images are GitHub `user-attachments`; no R2 bucket, public hostname or AWS SDK is needed.

## Local publication

Use the installed `drogers0/gh-image` extension (the workflow pins v1.3.0) and authenticated GitHub CLI. `gh-image` first tries the CLI token for images in repositories the user can push to; it can fall back to an existing browser session. Keep credentials inside the tools, never in command arguments or logs.

Commit and review the changes, capture the exact commit, and inspect every image. Build a manifest with `GITHUB_REPOSITORY`, `VISUAL_EVIDENCE_HEAD_SHA`, `VISUAL_EVIDENCE_TARGET_KIND` (`pull` or `issue`), and `VISUAL_EVIDENCE_TARGET_NUMBER`. Set `VISUAL_EVIDENCE_DIR` for both manifest creation and publication. Run `pnpm visual:manifest`, then `pnpm visual:publish`. `pnpm visual:publish:issue` remains a compatibility alias for the same publisher.

The publisher requires a clean worktree and matching HEAD. For PRs it checks the remote head before upload and again before updating the comment. An issue manifest cannot target a PR. Every upload must return a GitHub image attachment URL and its authenticated download must match the local SHA-256. A failed upload or verification leaves the previous comment intact.

## Automatic publication

`Visual evidence capture` runs PR code without upload credentials and emits an artifact. `Visual evidence publish` runs only trusted default-branch code after a successful capture. It validates the repository, project, triggering run, PR, commit and file paths before invoking `gh-image`; artifact content is never executed.

The publisher's `GH_TOKEN` is the job's GitHub token, with content-write permission for image upload and issue/PR-write permission for the comment. `GH_SESSION_TOKEN` is an optional fallback if GitHub's attachment endpoint rejects that token. A local upload succeeding does not prove the Actions token works: verify the real publish run before marking automatic publication complete. If a session fallback is required, use a dedicated attachment account and a protected trusted environment; provisioning or exporting a personal browser session requires the Owner's explicit approval. Neither token is needed by capture jobs.

A `workflow_run` publisher executes the version on the default branch. A PR changing this publisher cannot activate its new code until that change is merged. During bootstrap, use the reviewed local publisher and record the actual attachment comment as local publication. Keep automatic activation pending until a subsequent capture/publish run succeeds. Do not merge or deploy solely to satisfy the evidence gate without Owner authorization.

## Completion

Verify the marked `Visual evidence` comment embeds every desktop/mobile attachment and names the current full commit SHA. A local PNG, a successful upload without a comment, or a CI artifact alone is incomplete evidence. The trusted project and screen list live in `visual-evidence.config.json`; a clone only needs its own project identity, screens and GitHub authentication.
