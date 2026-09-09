# URL import delivery review

Reviewed implementation: `b35bf9bc7ea8b10afebe20b90f81e084ddd3ffdf`.
Base: `f11193a21b92e36690f27a8bfc9e038ecb8a2e60`. Date: 2026-09-09.
[Draft PR #105](https://github.com/johanleroch/get-some-proof/pull/105).
The implementation is published as a first draft. Full delivery remains open.
Documentation and gallery-status updates after this SHA do not represent a new
implementation test run; each proof below belongs to the stated implementation.

## Standards and Spec

Independent final reviews report no open code finding on the implementation
against the stated base. The Spec review reran 26 passing tests. Resolved findings:

- JWT verification captures request time at the HTTP boundary; the component
  query uses that verified time instead of reading a wall clock.
- Testimonial.to text identity uses stable keyed RSC records correlated to visible
  controls. Identity survives changed names, quotations and ordering. Ambiguous
  provider metadata fails explicitly. Exact legacy snapshots migrate their private
  lookup key; uncertain legacy matches require review.
- ChatGPT reads persisted results and video states, polls processing copies,
  ignores stale responses and retries through shared authorization/capacity rules.
  Provider diagnostics become allowlisted user explanations.
- Selection assessment includes Project activity, duplicates and shared Account
  capacity. Confirmation rechecks activity and capacity transactionally; capacity
  loss rolls back the batch. The initiating Project button owns its spinner.
- Source comparison preserves original format/video reference. Rendition changes
  retain identity; a replacement playback ID or format change requires review.

The merge preserved upstream account/security/billing behavior and combined the
capture registries without adding new UI behavior.

## Checks on the published implementation

- Local `pnpm check`: 806 tests in 143 files, formatting, lint, types and production
  build pass.
- Clean clone: Node 24.19.0, pnpm 11.24.0, frozen-lockfile install and full check
  pass. No environment files or node_modules were copied.
- [Remote quality/browser run](https://github.com/johanleroch/get-some-proof/actions/runs/34343542734):
  both pass; browser reports 760 passed, 4 flaky passing on retry and 4 skipped.
- [Capture run](https://github.com/johanleroch/get-some-proof/actions/runs/34343542720):
  passes. All 28 import captures were inspected; all attachments were downloaded
  and SHA-256 verified in the [visual evidence comment](https://github.com/johanleroch/get-some-proof/pull/105#issuecomment-5600872350).
  Desktop/mobile light/dark import, failure, processing and publication gallery
  entries are marked OK. The public acquisition entry remains TODO because its
  dark-theme review is not recorded.

The earlier local full browser run failed on macOS. Isolated password recovery
later passed, but remote Linux success does not establish that all earlier
macOS-only Inbox/Safari failures were fixed.

## Connected behavior

- Actual local desktop/mobile website preview and selection preserve selection
  after reload. Excess video capacity blocks confirmation; keeping eligible items
  enables it with 4 text and 2 video. This check did not confirm an import.
- Actual local MCP to fresh browser to signup, local email verification, new
  Project and claimed preview passes desktop/mobile. Selection and corrected
  identity survive. No capability appears in request URLs or referrers; automatic
  axe reports zero violations. The preview is synthetic; no import or publication
  was confirmed by this particular check. It is not actual ChatGPT-host evidence.
- The repository video helper copied a supported source into the verified Mux
  development environment Get Some Proof (5hrogn). The asset became ready with
  112.234278 seconds and public playback. Cleanup returned 204; subsequent lookup
  returned 404. This proves the helper/API copy, not the application queue/webhook.

Machine-readable local evidence is under `.scratch/url-import-live/`:
`website-capacity-evidence.json`, `fresh-signup-handoff-evidence.json` and
`mux-copy-evidence.json`. These ignored artifacts are local verification records,
not files available to a fresh clone. Public evidence is linked above.

## Open delivery requirements

- Real Mux queue/webhook delivery: the development token has Video Read/Write,
  but `mux webhooks listen` returned permission denied. System Read was requested.
- Actual ChatGPT developer-mode interaction and host/CSP verification; listing
  preparation exists locally but submission/publication have not happened.
- Complete the remaining source-reference, manual accessibility and per-ticket
  acceptance audit. Keep #98–#102 open until each criterion has matching proof.
- Automatic screenshot publication failed with HTTP 404. Local publication is
  verified; no dedicated runner fallback was provisioned and no personal browser
  session was exported.
- Reconcile applicable checks on any subsequent documentation commit.

No production deployment, merge or public ChatGPT availability is implied.
The current checkpoint in `url-import-delivery.json` supersedes its historical
working-state entries.

## Avatar supplement after 4bf612c

This supplement preserves provider avatars in independent storage and adds a
cropped photo override to the website, anonymous continuation and app-only MCP
flow. Cancelling the identity dialog discards its photo draft. Failed copies can
be retried by the owner. A five-minute attempt deadline prevents permanent
processing; generation checks fence late responses. Hourly orphan cleanup covers
interrupted storage writes.

Local validation: `pnpm check` passed (835 tests, 146 files, formatting, lint,
types and production build). After replacing the handler-only photo draft state
with a ref, all 13 dialog/avatar tests passed again. The four desktop/mobile MCP
browser tests pass, including saving and reopening the cropped photo. An actual
local MCP upload larger than 16 KiB was downloaded from Convex and byte-verified,
then removed. This is not a test inside the actual ChatGPT host.

Both independent review axes found no remaining issue in the interruption fix;
the focused avatar regression suite has 10 passing cases. React Doctor reports
73/100 versus 74/100 on the same-tool baseline: the sole additional remaining
warning is a false positive for object URL cleanup. The photoUrl effect revokes
each previous blob URL on replacement and the current URL on unmount. No rule
was suppressed. Remote checks and fresh screenshot publication for this
supplement remain pending until its commit is pushed.

## Senja custom wall paths

A live probe of https://senja.io/p/markpcolgan/testimonials reproduced
`UNSUPPORTED_WALL_URL` before retrieval: the allowlist required the literal
`wall-of-love` slug. Senja supports customized wall slugs, documented at
https://support.senja.io/how-do-i-make-a-custom-url-to-my-wall-of-love-dgny1.
The corrected matcher accepts one safe final slug under the exact Senja host;
HTTPS, credentials/port checks, bounded reads and redirect rejection remain.
Nested form and individual-testimonial URLs stay unsupported.

On 2026-09-09 the actual corrected parser returned 57 candidates from that
public wall: 51 text, 6 video, 57 avatars and 57 distinct source IDs. This was a
read-only extraction, not an import or a video-copy test. The 29 source/import
regressions pass; both independent reviews report no issue and separately reran
19 source tests. No UI layout changed, so this correction needs no new screenshots.
