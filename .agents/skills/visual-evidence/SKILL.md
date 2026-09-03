---
name: visual-evidence
description: Capture and publish current desktop and mobile UI screenshots whenever an issue, implementation, bug fix, or pull request changes or diagnoses user-visible behavior. Use automatically even when screenshots were not requested. Skip only for changes with no user-visible impact.
---

# Visual evidence

Make screenshots part of delivery, not an optional afterthought.

## Decide

- Use this skill for UI, layout, copy, navigation, responsive behavior, loading/error/empty states, and visual bug diagnosis.
- Skip it only when the diff cannot affect anything a user sees. Record that decision in the PR template.
- Never publish secrets, personal data, production customer data, browser chrome, or unrelated tabs.

## Capture

1. Read `visual-evidence.config.json` and add the smallest canonical screen that proves the change when the existing list is insufficient.
2. Put deterministic setup in the Playwright test. Use synthetic data and mask volatile or sensitive regions.
3. Run `pnpm test:visual`. Inspect every generated image under `visual-evidence/` at desktop and mobile sizes.
4. Keep the images tied to the exact Git commit. Re-capture after any UI-affecting edit.

## Publish

- Pull requests: push the reviewed commit. `Visual evidence capture` creates an untrusted artifact without credentials. `Visual evidence publish` validates it in a trusted workflow, uploads it to R2, and creates or replaces one PR comment.
- Issues without a PR: capture locally, build an issue manifest, then run the reusable publisher. It uploads only the validated images to `screenshots/<project>/issues/<issue-number>/<commit>/`, verifies each public R2 object byte-for-byte, and creates or replaces the marked issue comment. Do not ask the user to remind you.
- Treat an R2 upload plus the visible issue/PR comment as proof. A local file or GitHub artifact alone is not proof.

```bash
VISUAL_EVIDENCE_DIR=visual-evidence pnpm test:visual
GITHUB_REPOSITORY=<owner/repository> VISUAL_EVIDENCE_DIR=visual-evidence VISUAL_EVIDENCE_HEAD_SHA=<commit> VISUAL_EVIDENCE_TARGET_KIND=issue VISUAL_EVIDENCE_TARGET_NUMBER=<issue> pnpm visual:manifest
VISUAL_EVIDENCE_DIR=visual-evidence pnpm visual:publish:issue
```

## Storage contract

Read `docs/agents/visual-evidence.md` for paths, credentials, retention, bootstrap behavior, and clone setup.
