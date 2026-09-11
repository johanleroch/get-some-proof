# MCP testimonial migration discovery

Status: specification and implementation tickets published following Owner authorization. Planning only; implementation delegated to a separate chat.

Canonical specification: https://github.com/johanleroch/get-some-proof/issues/110

Implementation tickets: #111–#117, attached as GitHub sub-issues with native blocking relationships. Read the published specification and tickets for the self-contained implementation contract.

## Confirmed decisions — 2026-09-10

- Migration starts from one page supplied by the user; broader discovery and crawling are outside scope.
- Claude or Codex collects and structures the testimonials using its available tools. The MCP receives those results; this version does not call a Get Some Proof page-analysis tool.
- An explicit user import request saves directly as Pending in the Inbox, without a separate preview confirmation. Publication remains separate. Imported videos retain the previously agreed ten-minute limit; collection retains its two-minute limit.
- Partial success is allowed. Copyable testimonials can proceed while unavailable videos retain their source link and an option to supply a file. A referenced video is not reported as copied.
- Initial video scope includes direct public video-file URLs and local-file uploads. Provide assistant setup guidance for yt-dlp where appropriate; actual command execution depends on the assistant environment. Local files require an upload mechanism, not a filesystem path sent to Convex.
- Preserve original testimonial words; do not invent missing information or guess uncertain author/media associations. Video testimonials need not have written quotes.
- MCP import requires an authenticated paid account. Anonymous and Free-account import access are excluded. Eligibility must be enforced server-side.

## Additional confirmed decisions

- Select the sole Project automatically; with multiple Projects, ask unless the user has already identified the destination.
- Skip certain duplicates and report their count. Do not silently overwrite existing Testimonials. A retry resumes missing work.
- Respect the Account's existing video capacity. If only three slots remain for ten videos, import eligible text and ask which three videos to copy before transferring them; report remaining videos as capacity-blocked.
- Preserve unavailable video items in the Inbox as Pending, including available identity, photo, text, and source link. Expose retry and file replacement. Publication as video requires a Ready asset.
- Preserve explicit Highlights, author role/company, and individual ratings. Never assign a page-wide rating to individual Testimonials. Distinguish author photos from video Thumbnails.

## Assistant setup placement

- Show the assistant connection entry in the Inbox, greyed out for non-paying accounts, and in a dedicated MCP screen.
- Present assistant logos/tabs and a copy-instructions button. Instructions guide connection and import; they are not a guarantee that every assistant can configure itself automatically.
- Launch with Claude and Codex instructions, each verified in its supported environment before claiming compatibility. Add other assistants only after verification.
- Free accounts can view the MCP screen and explanation, with an upgrade call to action instead of connection. Import remains blocked server-side.

## Additional confirmed policy decisions

- Accept batches of at most 50 items; assistants may send successive batches and return an overall summary after announcing the discovered total.
- Ask the Owner to attest to necessary rights once when activating MCP import. Preserve imported provenance without inventing author Publication Consent.
- Retain source page, media URL, import date, and per-copy outcome; keep technical errors in diagnostics. Do not archive the complete source website.
- Finish copies already accepted and reserved when subscription eligibility ends; refuse new imports. Apply existing Account restrictions during payment grace periods.

## Final confirmed behavior

- Limit connection capabilities to Project listing, import, own-import status and media retries. Exclude publication, deletion, and modification of unrelated Testimonials. Allow connection revocation from the MCP screen.
- Limit each imported video to 512 MB as well as ten minutes.
- Try transient copy failures at most three times total. Permanent source or format errors require a corrected source; expose terminal failures in the Inbox.
- When a source item is identifiable as previously imported but its content changed, report a conflict and preserve the existing Testimonial without automatically duplicating or overwriting it.

## Implementation verification obligations

Validate authentication and paid eligibility, safe media fetching and local-file upload, duplicate/retry behavior, and both assistant setup paths. Keep source content untrusted and credentials out of copied setup instructions. Technical implementation details follow the confirmed product rules; any newly discovered product trade-off must return for discussion.

## Verified existing capabilities

The existing MCP depends on an embedded app for most operations and does not accept generic assistant-supplied testimonial batches. Its anonymous previews can precede authenticated saving. Existing video copying supports Mux-hosted MP4 sources; arbitrary MP4 hosts, HLS ingestion, and YouTube/Vimeo extraction are not implemented. The generic website-analysis draft was removed. The implemented source imports remain limited to Senja and Testimonial.to.
