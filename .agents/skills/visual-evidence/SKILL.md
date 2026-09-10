---
name: visual-evidence
description: Capture and publish targeted desktop and mobile screenshots of interfaces changed by the current diff or involved in a visual bug diagnosis. Use automatically for user-visible work; skip changes without visible impact.
---

# Visual evidence

Prove the visible change with the smallest useful set of screenshots.

## Decide

- Use this skill for UI, layout, copy, navigation, responsive behavior, loading/error/empty states, and visual bug diagnosis.
- Skip it only when the diff cannot affect anything a user sees. Record that decision in the PR template.
- Never publish secrets, personal data, production customer data, browser chrome, or unrelated tabs.

## Scope

- Read the diff against the PR base (or the task's starting revision). Map each visible change to the affected screen, component and state before capturing.
- Select only screens that demonstrate that change or reproduce the diagnosed bug. The canonical screen config is a catalog, not a checklist to capture in full.
- For a shared component, choose representative affected interfaces; add another only when its layout or behavior provides distinct evidence. A button, sidebar or token change does not require capturing every page that uses it.
- Default to one desktop and one mobile image per distinct changed interface/state. Add variants only when needed to prove the change, and explain their purpose.
- Documentation, backend-only changes and conflict checks with no visible behavior change require zero screenshots.

## Capture

1. Read `visual-evidence.config.json` and add the smallest canonical screen that proves the change when the existing list is insufficient.
2. Put deterministic setup in the Playwright test. Use synthetic data and mask volatile or sensitive regions.
3. Run only the selected capture tests, using a filter matching their actual `captures <screen.title>` names. Use a fresh task-specific `VISUAL_EVIDENCE_DIR` so earlier screenshots cannot enter the manifest. An unfiltered full-suite run is reserved for an explicitly requested full visual audit.
4. Keep the images tied to the exact Git commit. Re-capture after any UI-affecting edit.
5. Frame the changed component or relevant viewport with enough context to understand it. Use full-page screenshots only when the change concerns the whole page. Inspect every selected desktop/mobile image and remove redundant or unrelated captures before building the manifest.

## Publish

- Use `gh-image` for GitHub attachments. Follow [the publication guide](../../../docs/agents/visual-evidence.md) for local PR/issue publication, CI authentication and default-branch bootstrap.
- Pull requests: push the reviewed commit. `Visual evidence capture` creates an untrusted artifact; `Visual evidence publish` validates it with trusted code, uploads and byte-verifies attachments, and replaces the marked PR comment.
- Local publication: build the exact-commit manifest for `pull` or `issue`, then run `pnpm visual:publish` from a clean reviewed checkout. Re-check the remote PR head before reporting success.
- Keep the manifest and marked comment limited to the selected evidence, with a short explanation of what changed. Replace the existing marked comment instead of appending another gallery.
- Verify every selected desktop/mobile image is embedded in the marked comment with the current full SHA, and no unrelated screen is included. A GitHub artifact alone is not published evidence.
- Check automatic capture scope too: a workflow running the whole catalog can overwrite targeted local evidence. Report that mismatch explicitly; changing this skill alone does not change workflow behavior.
- Report local publication and automatic workflow success separately. Changing a default-branch publisher requires an authorized merge before its new workflow can run automatically.
