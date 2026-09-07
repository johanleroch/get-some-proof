# Visual evidence

Playwright captures canonical desktop and mobile screens. The publisher uploads PNGs with `gh-image`, verifies their bytes through an authenticated download, then creates or replaces one GitHub comment. Images are GitHub `user-attachments`; no R2 bucket, public hostname or AWS SDK is needed.

## Local publication

### Set up the contributor's machine

Resolve paths from this checkout. Owner-specific absolute paths and tools installed on another contributor's machine are not local prerequisites. `CLAUDE.md` imports `AGENTS.md`, which routes agents to this guide.

1. Check that GitHub CLI is installed, then run `gh auth status` and `gh extension list`. Confirm the authenticated account can push to the target repository and comment on its PRs.
2. If the extension is missing, install `drogers0/gh-image` with `gh extension install drogers0/gh-image` when local setup is authorized. Read the workflow's pinned version and the [upstream authentication documentation](https://github.com/drogers0/gh-image#authentication) when diagnosing version-specific behavior.
3. If CLI authentication is missing, guide the contributor through `gh auth login`. Attachment authentication can also use an existing local browser session through gh-image. If interactive login or an OS permission is required, state the exact user action and resume afterward. Let the tool handle credentials; never print or manually extract browser cookies or tokens.

Setup is verified by successful publication below, not merely by a successful CLI login. A missing Actions secret does not establish that local authentication is blocked.

### Publish the reviewed commit

Commit and review the changes, capture the exact commit, and inspect every image. Build a manifest with `GITHUB_REPOSITORY`, `VISUAL_EVIDENCE_HEAD_SHA`, `VISUAL_EVIDENCE_TARGET_KIND` (`pull` or `issue`), and `VISUAL_EVIDENCE_TARGET_NUMBER`. Set `VISUAL_EVIDENCE_DIR` for both manifest creation and publication. Run `pnpm visual:manifest`, then `pnpm visual:publish`. `pnpm visual:publish:issue` remains a compatibility alias for the same publisher.

The publisher requires a clean worktree and matching HEAD. For PRs it checks the remote head before upload and again before updating the comment. An issue manifest cannot target a PR. Every upload must return a GitHub image attachment URL and its authenticated download must match the local SHA-256. A failed upload or verification leaves the previous comment intact.

Preserve unrelated work; use a separate clean checkout when needed. Existing CI captures may be reused only after verifying their repository, target PR, run and full head SHA. Keep their manifest provenance intact and inspect every image. Otherwise, capture again from the reviewed commit with `pnpm test:visual` before building the manifest.

## Automatic publication

`Visual evidence capture` runs PR code without upload credentials and emits an artifact. `Visual evidence publish` runs only trusted default-branch code after a successful capture. It validates the repository, project, triggering run, PR, commit and file paths before invoking `gh-image`; artifact content is never executed.

The publisher's `GH_TOKEN` is the job's GitHub token, with content-write permission for image upload and issue/PR-write permission for the comment. `GH_SESSION_TOKEN` is an optional fallback if GitHub's attachment endpoint rejects that token. A local upload succeeding does not prove the Actions token works: verify the real publish run before marking automatic publication complete. If a session fallback is required, use a dedicated attachment account and a protected trusted environment; provisioning or exporting a personal browser session requires the Owner's explicit approval. Neither token is needed by capture jobs.

A `workflow_run` publisher executes the version on the default branch. A PR changing this publisher cannot activate its new code until that change is merged. During bootstrap, use the reviewed local publisher and record the actual attachment comment as local publication. Keep automatic activation pending until a subsequent capture/publish run succeeds. Do not merge or deploy solely to satisfy the evidence gate without Owner authorization.

### When capture succeeds but publication fails

Inspect the actual publisher run and error before attributing failure to `GH_SESSION_TOKEN`. Continue with the local publication procedure using the contributor's authentication. Report the verified comment link and SHA separately from the failed automation run. Local publication does not configure Actions, repair its failed check or waive a required check. Keep any required remote gate unresolved until it succeeds.

Continue independent delivery work, including the Matt review in `delivery.md`, while CI authentication is unresolved. If local publication also fails, report the failing command and sanitized error, plus the precise login, permission or configuration needed from the contributor.

## Completion

Verify the marked `Visual evidence` comment embeds every desktop/mobile attachment and names the current full commit SHA. A local PNG, a successful upload without a comment, or a CI artifact alone is incomplete evidence. The trusted project and screen list live in `visual-evidence.config.json`; a clone only needs its own project identity, screens and GitHub authentication.
