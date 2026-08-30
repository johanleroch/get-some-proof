# Domain docs

How engineering agents should consume this repository's domain documentation when exploring the codebase.

## Before exploring, read these

- `CONTEXT.md` at the repository root.
- `CONTEXT-MAP.md` at the repository root if it exists; it points to the relevant context-specific `CONTEXT.md` files.
- ADRs under `docs/adr/` that touch the area being changed.

If any of these files do not exist, proceed silently. Do not create them pre-emptively. The domain-modeling workflow creates them when terminology or decisions are actually resolved.

## File structure

This is a single-context repository:

```text
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Use the glossary vocabulary

When an issue, test, proposal, or implementation names a domain concept, use the term defined in `CONTEXT.md`. Do not drift to synonyms that the glossary explicitly avoids.

If a required concept is missing from the glossary, reconsider whether the new language is necessary or record the gap for the domain-modeling workflow.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, surface the conflict explicitly instead of silently overriding the recorded decision.
