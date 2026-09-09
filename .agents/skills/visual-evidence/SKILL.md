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

- The publisher commits the PNGs under a ref of their own (`refs/visual-evidence/<kind>-<number>`) with the job's token, links them by commit-pinned raw URLs and verifies every byte before touching the comment. Follow [the publication guide](../../../docs/agents/visual-evidence.md) for local publication and manual CI runs.
- Pull requests: push the reviewed commit. `Visual evidence capture` creates an untrusted artifact; `Visual evidence publish` validates it with trusted code, publishes and byte-verifies the images, and replaces the marked PR comment.
- Local publication: build the exact-commit manifest for `pull` or `issue`, then run `pnpm visual:publish` from a clean reviewed checkout. Re-check the remote PR head before reporting success.
- Verify every desktop/mobile image is embedded in the marked comment with the current full SHA. A GitHub artifact alone is not published evidence.
- Report local publication and automatic workflow success separately. A change to the publisher runs automatically only once merged; prove it before that by dispatching `Visual evidence publish` on its branch with the capture run id.
