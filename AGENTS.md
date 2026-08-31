# Agent instructions

## Agent skills

### Issue tracker

Issues and specs are tracked with GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

The project uses the default Matt Pocock triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository using a root `CONTEXT.md` and ADRs under `docs/adr/`. See `docs/agents/domain.md`.

### Delivery gate

When finishing implementation, a bug fix, an issue, or a pull request, follow `docs/agents/delivery.md`. A change is complete only after its remote CI checks succeed and its issue and pull-request checklists match the verified evidence.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
