# URL import working-state review

Base: `f45921a27d2a8bef8f5a3522be09b9d2dc6ca7fd`. Reviewed on 2026-09-09.
Scope: tracked diff plus untracked feature sources in `codex/url-testimonial-import`.
This report accompanies the first implementation snapshot. This is an interim
review, not the final delivery review required by `docs/agents/delivery.md`.

## Standards

- **P3, resolved locally:** JWT verification captures request time explicitly;
  the component query compares expiry against that verified time. Independent
  review confirmed the fix and re-ran 4 passing boundary/adapter tests.
- **P2, resolved locally, judgement:** Testimonial.to text now uses stable
  provider IDs correlated through keyed RSC records and visible DOM controls.
  Changed names/quotations retain identity. Missing or conflicting metadata
  reports a provider format change. Exact legacy content hashes are reconciled
  by private lookup key without modifying original proof; uncertain legacy
  matches require review and old unprocessed hash previews require refresh.
  Independent review confirmed this resolution and re-ran 23 tests successfully.

## Spec

- **P1, resolved locally:** ChatGPT reads persisted import results and video states,
  polls processing copies, and retries failed items using the website's shared
  authorization and capacity policy. Stale responses are ignored. Safe failure
  messages and typed capacity refusals are displayed. Independent review confirms
  this resolution; real local OAuth status access and five browser targets pass.
- **P2, resolved locally:** The shared selection assessment checks all selected
  items against Project activity, existing source identities and Account video
  capacity. Website and ChatGPT show counts before confirmation. Excess video
  selection blocks confirmation; the website can keep only eligible items and
  ChatGPT allows returning to selection. Capacity loss rolls back the whole
  confirmation. Project activity is rechecked in the shared transaction.
  Independent Standards and Spec review confirmed both race fixes; the spinner
  belongs to the Project button which starts the check.
- **P2, resolved locally:** Source comparison now includes original proof type
  and video reference. Both preview and confirmation use the same comparator.
  Mux rendition changes preserve identity; replacement playback IDs and format
  changes are flagged. Legacy videos without a saved reference require review.
  A public-operation regression reproduced the old false duplicate and now passes;
  original video provenance remains unchanged and no second testimonial is created.

Standards: the P3 query wall clock and P2 identity findings are resolved locally. All three initial
Spec findings are resolved locally. The complete delivery gate remains open.

## Browser and installation evidence

The first complete behavioral browser run (excluding screenshot capture tests)
finished with 565 passing, 31 failing and four skipped checks across five browser
projects. This is not a passing browser gate. Failures include Safari keyboard
and Inbox interactions, the Free-plan copy assertion, and password recovery.

The import correction opener now explicitly receives focus before opening its
dialog, fixing Safari return focus. The publication fixture now represents that
same opener contract. Targeted correction/publication checks pass in all five
browser projects; the ChatGPT simulator regression also passes desktop Safari.
The stale Free-plan assertion now checks the actual one-active-Project limit,
and passes all five projects. Password recovery still fails desktop Chromium;
the remaining Inbox failures need diagnosis.

A fresh local clone plus the working diff and 80 untracked source files installed
with `pnpm install --frozen-lockfile`. No `.env.local` or `node_modules` was copied.
The first isolated full check reached tests but one account pagination test timed
out while the full browser suite was also running. Bounded-worker verification
and the isolated build are tracked separately in the delivery ledger. This
snapshot is not a clean clone of a published feature commit.

## Testimonial.to identity investigation

A fresh bounded read of `https://testimonial.to/testimonial/all` returned five
text cards and four video cards in a 136,007-byte page. The text card DOM has no
stable testimonial ID. React server records contain wrapper keys of the form
`<provider-id>-<position>`, with a child reference (`$L<record-id>`) whose text
card contains the same show-more control ID as the DOM. This allows correlating
the stable wrapper identity to the visible card without treating its position,
author or quote as identity. The adapter now uses this relationship. Changed-source and reorder regressions
pass, and a second real page read returned the same IDs for all nine cards.
Evidence: `.scratch/url-import-live/text-source-identity-evidence.json`. Exact
legacy snapshots migrate only their private lookup key; uncertain legacy
matching refuses new additions rather than guessing. Local source evidence: `.scratch/testimonial-source-current.html`.

### Follow-up: ChatGPT video progress (2026-09-09)

Private OAuth status/retry operations, shared website retry policy, app-only MCP
tools and widget polling are implemented. Provider diagnostics are replaced by
allowlisted explanations; capacity refusal no longer asks for reconnection.
Independent Spec review re-ran 13 tests and confirmed both the original P1 and
its failure-message follow-up resolved. Standards review found no new finding.

`pnpm check` passes: 781 tests in 138 files, lint, types and production build.
The failed → retry → processing → ready simulator passes desktop Chromium,
Firefox, WebKit and mobile Chromium/WebKit; light/dark axe scans pass. Four final
Chromium desktop/mobile screenshots were inspected under
`.scratch/import-progress-design/`. Mobile actions wrap under the explanation.
OAuth status access through the real local Next MCP and Convex endpoint succeeds
for the existing synthetic import and challenges anonymous access; evidence is
`.scratch/url-import-live/import-progress-evidence.json`.

React Doctor: 76/100, 12 warnings in other files, none in the progress component.
No PR, remote CI, real Mux copy or actual ChatGPT host proof is implied.

### Selection assessment evidence (2026-09-09)

`pnpm check` passes with 782 tests in 138 files and production build. The local
Convex watcher accepted the final backend at 14:49:42. Regression coverage includes
4 selected items with only 3 importable, rollback without testimonials or video
reservations on over-capacity confirmation, explicit eligible selection, current
duplicate checks, unclaimed OAuth preview, cross-Project denial, and Pro→Free
Project deactivation between assessment and text confirmation.

The Project selection simulator passes desktop/mobile Chromium with light/dark
accessibility scans; four Project screenshots in `.scratch/import-eligibility-design`
were inspected. The real local OAuth→Next MCP→Convex assessment succeeds while
leaving the synthetic preview unclaimed, recorded in
`.scratch/url-import-live/import-eligibility-evidence.json`. This is not a real
ChatGPT-host or Mux-copy proof. Website selection-review UI still needs dedicated
browser verification; the complete browser and remote delivery gates remain open.

One unrelated upload cancellation test had observed beforeunload before effect
cleanup. It now waits for a fresh navigation event to stop being prevented; the
existing upload hook was inspected and no production behavior was changed.

### First snapshot publication

The owner authorized committing and pushing this first draft on 2026-09-09.
Delivery remains incomplete: the full browser gate, real Mux copy, actual
ChatGPT host, final review and remote CI remain unverified. The latest OAuth
request-time fix passes 8 targeted tests across 3 files; independent review
confirmed the resolution with 4 passing tests. Earlier full-check evidence predates this last fix.

### Integration with current main

PR #105 was opened as a draft on first snapshot `0b47082`. GitHub reported
conflicts with `main` at `f11193a`. The account, security and billing resolutions
retain main exactly; the visual route, capture procedure and registry retain
both upstream account screens and import screens. No new UI behavior was added
by the resolution. `pnpm check` passes after integration: 806 tests in 143 files,
formatting, lint, types and production build. The isolated desktop Chromium
password-recovery test also passed before this merge; intermittent behavior and
the broader browser gate are not certified resolved.
