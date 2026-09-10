## Parent

#110

## What to build

A paid Owner follows tested copyable instructions to connect Claude or Codex and complete a migration; a Free user can discover the capability and upgrade without access to import.

## Acceptance criteria

- [ ] Add an Inbox entry greyed out for non-Pro and a dedicated MCP screen reachable through the product navigation, following DESIGN and gallery conventions.
- [ ] Show Claude and Codex logos/tabs with copy-instructions buttons; include only assistants with verified supported setup.
- [ ] Free users can read the explanation and upgrade, but cannot connect/use the paid import capability; enforce server checks independently of UI.
- [ ] Provide account connection, one-time reuse-rights attestation and connection revocation in the setup flow.
- [ ] Copied instructions contain no credentials; explain one supplied page, original fields, source URLs, Project selection, batches, direct Pending save and accurate status reporting.
- [ ] Explain URL versus local-file transfer, ten minutes/512 MB and optional yt-dlp usage in environments that support it; do not promise automatic install or protected-media extraction.
- [ ] Prove a real Claude and Codex supported connection/import path, documenting exact client surfaces and limitations; mocks alone do not establish compatibility.
- [ ] Certify the full source-page-to-Inbox journey including text/photo/video and fallback, and publish current-head desktop/mobile evidence.
- [ ] Leave directory publication and production deployment outside this ticket unless separately authorized.
- [ ] Relevant local checks, Standards/Spec review and required remote CI succeed on the delivered PR head; synchronize checklists only with proven evidence.
- [ ] For visible changes, inspect and publish current-head desktop/mobile screenshots via gh-image and update the gallery review status.

## Blocked by

- #116

## Implementation context

Read #110 in full. Reuse verified existing wall-import and media infrastructure; do not merge the uncommitted OpenAI website-analysis draft wholesale. Preserve unrelated local work and secrets. Implement this as a complete behavior slice, not an isolated layer. Existing #97–#102 remain separate.
