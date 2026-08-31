# Delivery gate

Use this gate before reporting that implementation, a bug fix, an issue, or a pull request is complete.

## 1. Establish the completion ledger

Read the source issue, linked specification, and current pull-request description. List every acceptance criterion and required validation. Associate each criterion with authoritative evidence: a test, command result, inspected artifact, or explicit manual verification.

Completion criterion: every requirement has an identified proof; missing or indirect evidence remains unfinished work.

## 2. Pass the local gate

Run the repository checks from the pinned Node and pnpm toolchain:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test:e2e
```

Use a clean-clone installation when changing dependencies, the toolchain, the build, setup instructions, or release behavior. Add narrower regression checks for the behavior being fixed.

Completion criterion: every applicable local command exits successfully and the worktree contains only the intended changes.

For user-visible work, also follow `.agents/skills/visual-evidence/SKILL.md`: update the canonical screen list when necessary, run `pnpm test:visual`, and inspect the generated desktop and mobile images. Screenshots containing secrets, personal data, or unrelated browser state must never be published.

## 3. Run the Matt review gate

Use `/code-review` against the pull request's base. Resolve every Standards or Spec finding that affects correctness or an acceptance criterion. Re-run the affected local checks after review changes.

Completion criterion: the review has no unresolved correctness or specification findings.

## 4. Pass the remote gate

Push the reviewed commit, then observe the pull request's required checks until they reach a terminal state:

```bash
gh pr checks <pr-number> --watch
```

Treat a failed, cancelled, skipped, pending, queued, or missing required check as active work. Inspect the failing job, reproduce its exact signal locally where possible, apply `/diagnosing-bugs`, push the correction, and observe the new run. Local success never substitutes for the remote gate.

Completion criterion: every required check on the pull request's current head commit has conclusion `success`.

For user-visible work, the `Visual evidence capture` check must succeed and the trusted publisher must update the pull request's `Visual evidence` comment with R2 URLs for the current head commit. A GitHub artifact alone is not published visual evidence.

## 5. Synchronize the tracker

After the remote gate succeeds:

1. Update the pull-request summary to describe the final diff and replace planned validation with the commands and CI checks that actually passed.
2. Check an issue or pull-request task box only when its acceptance criterion is proven by the completion ledger.
3. Keep unproven boxes unchecked and the corresponding issue open.
4. Remove stale placeholders, duplicated claims, and superseded validation notes.
5. Close an implementation issue only when every acceptance criterion is checked or explicitly documented as out of scope in the source specification.

Completion criterion: issue state, issue checklists, pull-request description, current head commit, and CI results all describe the same completed work.

## Final report

Report the pull-request link, current head commit, local checks, remote checks, review result, and any intentionally deferred criterion. Use the word "complete" only after all five gates pass.
