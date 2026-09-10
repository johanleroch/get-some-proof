## Problem Statement

An Owner wants Claude or Codex to migrate existing testimonials from one supplied page into Get Some Proof, including photos and videos, without manual re-entry. The existing ChatGPT wall flow is tied to an embedded app and provider-specific extraction; it is not a generic agent-supplied import API.

## Solution

The assistant gathers the source data with its own tools and submits structured records through an authenticated, paid-account MCP connection. An explicit import request saves directly as Pending in the selected Project's Inbox. Convex handles persistence, ownership, reservations and durable background work; Mux handles video ingest and playback. No Get Some Proof page-analysis or OpenAI extraction call is part of this release.

## User Stories

1. As an Owner, I want to connect Claude or Codex to my paid Account so I can import existing proof.
2. As a Free user, I want to understand the integration and upgrade before using it.
3. As an Owner, I want to revoke an assistant connection.
4. As an Owner, I want to attest to reuse rights once when activating MCP import without impersonating author consent.
5. As an Owner, I want the assistant to migrate only the page I supplied.
6. As an Owner, I want my sole Project selected automatically, or a choice when I own several.
7. As an Owner, I want an explicit import request to save directly as Pending without an extra preview step.
8. As an Owner, I want the original text and Highlights preserved without invented or rewritten claims.
9. As an Owner, I want explicit author identity, role/company, portrait and individual rating preserved.
10. As an Owner, I want missing or ambiguous values left unset, and aggregate ratings excluded.
11. As an Owner, I want videos without written quotations to remain video Testimonials.
12. As an Owner, I want source provenance, import date and per-item results retained.
13. As an Owner, I want batches of up to 50 and an accurate overall result for successive batches.
14. As an Owner, I want duplicate submissions and interrupted retries to avoid duplicate records or media transfers.
15. As an Owner, I want changed identifiable source items flagged without overwriting existing proof.
16. As an Owner, I want public video-file URLs copied to our hosted media.
17. As an Owner, I want local video files uploaded when no usable public file URL exists.
18. As an Owner, I want imported videos limited to ten minutes and 512 MB while collection remains two minutes.
19. As an Owner, I want processing to continue after closing the assistant.
20. As an Owner, I want three total attempts for transient copy errors and immediate actionable permanent failures.
21. As an Owner, I want partial success and failed video records retained in Pending with retry/file replacement.
22. As an Owner, I want to choose which videos fit when storage capacity is insufficient.
23. As an Owner, I want accepted reserved copies to finish after subscription expiry, with new imports blocked.
24. As an Owner, I want assistant access limited to Project listing, importing, own-import status and media retries.
25. As an Owner, I want an Inbox entry and dedicated MCP screen with Claude/Codex logos and copyable setup instructions.
26. As an Owner, I want instructions to explain real client capabilities, local-file transfer and optional yt-dlp usage.
27. As an Owner, I want only Ready videos eligible for publication, with publication remaining a separate product action.

## Implementation Decisions

- Paid authenticated access is mandatory for this new generic import surface, including server-side entitlement and ownership checks. Preserve the separate existing wall/ChatGPT journey; this specification does not authorize globally removing its anonymous preview.
- Expose model-callable operations without requiring an embedded app. A minimal interface covers destinations, structured import, status, media upload/retry and connection management. Exclude publishing, deleting and editing unrelated Testimonials.
- Require a supplied source page and explicit fields. Treat assistant data and website text as untrusted input; validate sizes, field types and safe formatting. Do not claim the server independently proved every author association.
- Preserve original words, Highlights, explicit role/company, individual ratings, portrait versus Thumbnail distinction, and source provenance. Do not generate missing quotations, infer ratings from a page aggregate, or synthesize author consent.
- Persist imports as Pending and preserve the actual reuse attestation separately from Collection Form consent. Imported text follows existing import accounting rather than consuming Collection Credits.
- Use at most 50 records per submission with bounded payloads. Report created, duplicate, conflicted, blocked and failed outcomes separately. Persist retry/idempotency state and use source identity where available; uncertain matches must not overwrite records.
- Copy public direct video-file URLs or upload local files; do not pass local paths as remote URLs or encode 512 MB files in MCP JSON. Use a scoped, expiring upload capability tied to the authorized import item and enforce completion validation.
- Fetch media safely with bounded size/time, validated redirects and public destinations; protect against private-network access. Keep secrets, capability URLs and raw sensitive errors out of public data and setup instructions.
- Enforce 512 MB and 600 seconds for imported video; retain the 120-second collection limit. Reuse existing Mux and durable workflow boundaries rather than adding a parallel media lifecycle.
- Reserve shared Account capacity atomically before transfer. On insufficient capacity, eligible text proceeds and the assistant asks which videos to transfer; remaining items are marked blocked. Do not silently select an arbitrary subset.
- Finish previously accepted reserved copies after entitlement expiry; block new imports and apply existing payment-grace restrictions. Connection revocation blocks new user calls, without requiring the assistant session to keep accepted background work alive.
- Retry transient media-copy failures at most three attempts total. Permanent URL/format failures need a corrected source. Keep failed video records and metadata in the Inbox with retry and file replacement; never label a source link as a copied video.
- Show the integration in the Inbox (greyed for Free) and a dedicated MCP screen. Free users can read the explanation but see an upgrade action instead of connection. Follow the existing design system.
- Provide verified Claude and Codex setup instructions with logos/tabs and copy buttons, no embedded secrets. Explain optional yt-dlp usage only in environments able to execute commands; provide Inbox file upload fallback where local assistant transfer is unavailable.

## Testing Decisions

Test behavior through public authenticated import/status/upload operations and existing Convex test seams, not private implementation structure. Reuse ownership, video reservation, public-projection and import tests. Test the MCP transport contract so an ordinary model client can complete the flow without widget-only state.

Required negative and recovery cases include anonymous/Free/revoked access, cross-Owner Project/job/upload IDs, malformed or oversized batches, concurrent replay, source changes, forged media completion, hostile redirects, quota races, over-limit video, transient versus permanent errors, webhook duplication, subscription expiry and browser/session closure. Fixtures should cover text-only, video-only and mixed records.

Browser tests prove Inbox Pending states, failure/replacement, Free/Pro entry and MCP setup copying on desktop/mobile. Real supported Claude and Codex sessions must establish setup compatibility; mocks do not prove client installation. Optional yt-dlp support must be reported at the actual verified capability level.

Every implementation ticket requires relevant local checks, Standards/Spec review and successful required remote CI on the PR head. User-visible work requires inspected current-head desktop/mobile screenshots published through gh-image and gallery review status updates per repository instructions. Keep checkboxes unchecked until evidenced.

## Out of Scope

- Website crawling, cross-site discovery, SaaS-side OpenAI analysis, automatic transcription/clipping, continuous synchronization.
- Anonymous or Free use of this new generic MCP import, automatic publication or deletion, arbitrary management access.
- Guaranteed extraction from every protected/player URL; the assistant may supply a file or the item remains actionable.
- Additional assistant logos before verifying their setup.
- Public marketplace listing or production deployment without separate authorization.

## Further Notes

Related existing work: #42 (broader discovery), #97 (provider wall specification), #100 (media imports), #102 (ChatGPT app flow). These remain separate and must not be closed as part of this planning pass.

At planning time, local code already contains a wall import engine, OAuth/import permissions, Mux media workflow and Inbox UI. Generic batches, headless setup and arbitrary media transfer still need implementation. Audit current main and existing PRs before deciding what to reuse.

An uncommitted website-analysis worktree contains an earlier OpenAI direction. Do not merge it wholesale. The current checkout also contains unrelated local files and secrets; preserve them and never stage environment files.

Owner authorized specification/ticket publication and a handoff prompt. This planning task does not implement, merge or deploy product changes.
