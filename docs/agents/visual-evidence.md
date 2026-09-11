# Visual evidence

Playwright captures canonical desktop and mobile screens. The publisher commits the PNGs through the Git Data API under a ref of their own, `refs/visual-evidence/<kind>-<number>`, reads every blob back through the API and compares it byte for byte with the local file, links the images by commit-pinned `raw.githubusercontent.com` URLs, then creates or replaces one marked GitHub comment. Whether the raw host already serves the commit is probed and reported, never a reason to fail: the bytes are proven in the repository. It needs nothing but a token that may write contents and comments: no attachment endpoint, no browser session, no bucket, no public hostname.

Every pull request declares its capture scope once in the body with `<!-- visual-evidence-screens: slug-one, slug-two -->`. Use slugs from `visual-evidence.config.json`, `none` when the diff has no visual impact, and `all` only for an explicitly requested full visual audit. The workflow validates this marker and refuses missing, duplicate, mixed, or unknown selections. Editing the pull-request body reruns the capture workflow, so the selection applies to every branch without changing workflow code in that branch.

The ref lives outside `refs/heads`, so clones never fetch the images and no branch rule applies to it. It is force-updated on every publication and holds exactly one parentless commit: the latest head's images plus their manifest. The URLs pin that commit, so a replaced comment keeps showing what it showed.

## Local publication

### Set up the contributor's machine

Resolve paths from this checkout. Owner-specific absolute paths and tools installed on another contributor's machine are not local prerequisites. `CLAUDE.md` imports `AGENTS.md`, which routes agents to this guide.

1. Check that GitHub CLI is installed, then run `gh auth status`. The token must carry the `repo` scope and the account must be able to push to the target repository and comment on its PRs.
2. If CLI authentication is missing, guide the contributor through `gh auth login`. If interactive login or an OS permission is required, state the exact user action and resume afterward. Let the tool handle credentials; never print or manually extract tokens.

Setup is verified by successful publication below, not merely by a successful CLI login.

### Publish the reviewed commit

Commit and review the changes, capture the exact commit, and inspect every image. Set `VISUAL_EVIDENCE_SLUGS` to the comma-separated selected slugs before running `pnpm test:visual`; an unfiltered run is rejected, while the explicit value `all` is reserved for a requested full audit. Build a manifest with `GITHUB_REPOSITORY`, `VISUAL_EVIDENCE_HEAD_SHA`, `VISUAL_EVIDENCE_TARGET_KIND` (`pull` or `issue`), and `VISUAL_EVIDENCE_TARGET_NUMBER`. Set `VISUAL_EVIDENCE_DIR` for capture, manifest creation and publication, pointing at a fresh directory that holds only the capture folders (`desktop-chromium/`, `mobile-chromium/`): the manifest lists every PNG under it. Run `pnpm visual:manifest`, then `pnpm visual:publish`. `pnpm visual:publish:issue` remains a compatibility alias for the same publisher.

The publisher requires a clean worktree and matching HEAD. For PRs it checks the remote head before publishing and again before updating the comment. An issue manifest cannot target a PR. Every blob must read back with the local SHA-256. A failed publication or verification leaves the previous comment intact.

`VISUAL_EVIDENCE_TRANSPORT=attachments` keeps the older path, GitHub attachments through the `drogers0/gh-image` extension and a browser session, for a contributor who prefers it locally. It cannot run on Actions.

Preserve unrelated work; use a separate clean checkout when needed. Existing CI captures may be reused only after verifying their repository, target PR, run, full head SHA and that their scope matches the affected interfaces selected under [the skill](../../.agents/skills/visual-evidence/SKILL.md). Keep their manifest provenance intact and inspect every image. Otherwise, capture the selected tests again from the reviewed commit into a fresh `VISUAL_EVIDENCE_DIR` before building the manifest. Use that same directory for publication.

## Automatic publication

`Visual evidence capture` runs PR code without write credentials and emits an artifact. `Visual evidence publish` runs trusted default-branch code after a successful capture. It resolves the capture run through the API (name, conclusion, head commit, pull request), validates the repository, project, run, PR, commit and file paths of the artifact, then publishes; artifact content is never executed.

The publisher's `GH_TOKEN` is the job's GitHub token: content-write permission creates the blobs, tree, commit and ref, issue/PR-write permission writes the comment. Capture jobs need neither.

A `workflow_run` publisher executes the version on the default branch, so a PR changing the publisher cannot activate its new code automatically until it is merged. Prove such a change before merging: once its `Visual evidence capture` run has succeeded, a collaborator dispatches the publisher on the PR's own branch with that run's id:

```bash
gh workflow run visual-evidence-publish.yml --ref <branch> -f run_id=<capture run id>
```

The dispatched run checks out the branch, so it runs the branch's publisher with the job's token, exactly as the default branch will after the merge. Record its run and the resulting comment in the PR.

### When capture succeeds but publication fails

Inspect the actual publisher run and error before attributing failure to authentication. Continue with the local publication procedure using the contributor's authentication. Report the verified comment link and SHA separately from the failed automation run. Local publication does not repair a failed check or waive a required check. Keep any required remote gate unresolved until it succeeds.

Continue independent delivery work, including the Matt review in `delivery.md`, while the automation is unresolved. If local publication also fails, report the failing command and sanitized error, plus the precise login, permission or configuration needed from the contributor.

## Completion

Verify the marked `Visual evidence` comment embeds every desktop/mobile image and names the current full commit SHA and the ref it is served from. A local PNG, a commit on the evidence ref without a comment, or a CI artifact alone is incomplete evidence. The trusted project and screen list live in `visual-evidence.config.json`; a clone only needs its own project identity, screens and GitHub authentication.
