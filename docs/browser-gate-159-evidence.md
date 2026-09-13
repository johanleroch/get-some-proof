# Browser gate #159 repair

The failures were reproduced on the unchanged base and again at `ab9d02e265fc0b591b80c6136c2d243c8f06f569` before repair. The source issue is https://github.com/johanleroch/get-some-proof/issues/159. The Owner authorized their correction to unblock Cloudflare #169; no merge or production deployment is included.

## Diagnoses and fixes

- MCP import: the real standalone document threw `process is not defined`. Shared import UI had acquired Next Link/Image dependencies. The standalone esbuild target now resolves those two components to browser anchors/images. The application build retains Next components. Existing MCP handshake, selection, host theme, upload and video retry tests exercise the resulting real bundle.
- Studio selection: an `aria-label` on an overlay label violated ARIA. The label now has visually hidden text. Safari does not focus clicked buttons reliably, so the opener is recorded from the click event and restored explicitly. If selecting the first testimonial removes the empty-state opener, a surviving preview button receives focus. A new browser regression was observed red before this fallback.
- Studio layout: the initial repair exposed a fixture mismatch. During delivery, #183 merged the newer approved Studio design and its real fullscreen fixture. The rebase preserves that new shell, gallery, direct Save draft/Embed actions and device widths. The superseded fixture workaround and Back to project addition were discarded. Full viewport and no-sidebar assertions remain strict.
- Inbox actions, import introduction, Studio templates and embed code assertions now follow their current accessible controls. Selection, destructive confirmation, save/publish, embed contents, ordering, highlights and clipboard outcomes remain checked.
- Settings scrolling now uses the actual settings sections; the removed section navigation is no longer assumed. Fixed shell position, scroll completion and reduced-motion behavior remain checked.
- Canvas export preserves alpha in both WebP and the native PNG fallback. The test independently detects browser WebP encoding support and still checks transparent corners and opaque red center pixels. The fallback is defined by [the canvas API](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob).

## Verification ledger

Targeted browser coverage passed on all five projects before the final review corrections (108 passed, 2 existing skips). After the review, the strict Studio desktop Chromium and mobile WebKit suite passed all 18 tests, including the disconnected-opener regression. Shell/Studio unit tests passed (24 tests). Standards and Spec reviews have no remaining findings. The complete current-head local/remote results and published commit-pinned screenshots are recorded in PR #180 and issue #159; this document does not replace those delivery gates.
