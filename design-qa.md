# Members invitation flow design QA

## Comparison target

- Source visual truth: `/var/folders/4q/0rvcnp8x0pl_nclw7wbyzs2w0000gn/T/codex-clipboard-74e30d7e-c737-4340-afc7-38d2addd19b9.png`
- Source pixels: 768 × 521. The source is a Slack administration screenshot with browser and Mobbin framing.
- Implementation: `visual-evidence/manual/members-pending-desktop-final.png`
- Implementation pixels and CSS viewport: 1440 × 900 at device scale factor 1.
- Mobile implementation: `visual-evidence/manual/members-pending-mobile.png`
- Mobile pixels and CSS viewport: 390 × 844 at device scale factor 1.
- State: light theme, authenticated Owner, one pending Admin invitation after a successful resend.
- Density normalization: both desktop images were proportionally scaled into 768 × 521 white frames for the full-view comparison. The focused comparison crops each product-owned header, tabs, search, table, metadata, and row-action region before scaling them to equal widths.

## Evidence

- Full-view comparison: `visual-evidence/manual/design-comparison.png`
- Focused management-region comparison: `visual-evidence/manual/design-comparison-focused.png`
- Mobile pending state: `visual-evidence/manual/members-pending-mobile.png`
- Mobile invitation error state: `visual-evidence/manual/members-invite-error-mobile.png`
- Mobile expired, revoked, or already-used state: `visual-evidence/manual/invitation-unavailable-mobile.png`
- Post-polish tab comparison: `visual-evidence/manual/design-comparison-tabs-outline-fixed.png`
- Post-polish desktop tabs: `visual-evidence/manual/members-tabs-outline-fixed.png`
- Post-polish mobile tabs: `visual-evidence/manual/members-tabs-outline-fixed-mobile.png`

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: the implementation intentionally retains the starter typography rather than copying Slack. Title, description, tab, metadata, and action weights preserve the reference hierarchy and remain readable at desktop and mobile sizes.
- Spacing and layout rhythm: title and primary action share the header, tabs sit directly above a full-width search field, and invitation rows use a compact single-border table. The surrounding shell spacing remains consistent with the existing Linear-inspired application.
- Colors and visual tokens: the implementation uses the starter's neutral foreground, muted, border, destructive, and success tokens. Slack's green action color is intentionally not copied.
- Image quality and assets: the selected reference contains no product imagery required by the management surface. Existing shell icons and initials remain sourced from the starter; no custom SVG, CSS art, placeholder illustration, or generated raster substitute was introduced.
- Copy and content: unsupported Slack states such as Requests, Accepted, and Invite Links were omitted. The supported views are Members, Pending invitations, and Former members. Invitation metadata describes inviter, expiry, role, sent date, and status without exposing provider details.
- Behavior and accessibility: tabs expose full accessible names, the search input is labelled per view, destructive actions require confirmation, status feedback uses live regions, and row controls remain keyboard reachable.
- Tab focus treatment: the browser-default rectangular outline no longer appears after a pointer click. Keyboard focus is preserved through a thicker `ring`-colored underline, while the selected state keeps the compact neutral underline used by the reference.

## Comparison history

1. Initial mobile pass found a P2 responsive issue: the desktop labels `Pending invitations` and `Former members` clipped the final tab at 390 px.
2. The tab controls received short mobile labels (`Pending` and `Former`) while preserving their full `aria-label` values.
3. Post-fix evidence in `visual-evidence/manual/members-pending-mobile.png` shows all three tabs, the primary action, search field, invitation metadata, role selector, and row actions without horizontal page overflow.
4. The follow-up tab polish removed the native rectangular outline visible around the selected tab. Desktop and mobile captures show a single clean underline with no surrounding box.

## Primary interactions tested

- Open and close the Invite people dialog.
- Submit an email with an initial role and observe the pending list update.
- Search pending invitations and observe the no-results state.
- Resend an invitation and observe success feedback.
- Change the initial role and observe success feedback.
- Revoke an invitation through the confirmation dialog.
- Submit a duplicate pending email and observe the safe inline error state.
- Open the delivered invitation link as a new verified user, accept it, and
  observe the redirect into the invited Organization with the Viewer role.
- Reopen the same invitation token and observe the shared privacy-safe expired,
  revoked, or already-used error rather than a distinguishable backend state.
- Observe the page skeleton during the first authenticated navigation and the
  purpose-built empty state before the first pending invitation was created.
- Inspect desktop and mobile layouts and verify zero document-level horizontal overflow.
- Check browser console output; the only error was the intentionally triggered and user-visible duplicate-invitation rejection.

## Open questions

None for this scope. Resolved and revoked invitations remain available through the existing organization audit log rather than adding a Slack-like Accepted tab.

## Follow-up polish

No P3 follow-up is required for the selected reference adaptation.

final result: passed

---

# Senja-style public Wall of Love

## Comparison target

- Reference: `/var/folders/4q/0rvcnp8x0pl_nclw7wbyzs2w0000gn/T/codex-clipboard-78fb0eda-33fc-4036-9882-f9af93b9ba82.png`
- Desktop implementation: `/tmp/get-some-proof-wall-evidence-ratio-fix/desktop-chromium/public-wall.png`
- Mobile implementation: `/tmp/get-some-proof-wall-evidence-ratio-fix/mobile-chromium/public-wall.png`
- Side-by-side comparison input: `/tmp/get-some-proof-wall-design-qa.png`
- State: dark hosted public wall containing landscape, portrait, rated, unrated, video, and text testimonials.

## Findings

- The implementation preserves the reference's two-column desktop masonry and single-column mobile flow.
- Video cards now follow each source asset's ratio instead of forcing every asset into a portrait frame.
- Rating, customer name, role or company, and play affordance sit over a bottom gradient on the video, matching the reference card anatomy.
- Text cards retain Get Some Proof's existing design tokens while matching the reference's dark surface, subtle border, radius, density, and type hierarchy.
- The final desktop and mobile captures show no clipping or horizontal overflow. The poster is intentionally cover-fitted inside the source-ratio frame; no new encoded crop is produced.
- The free-plan attribution remains in a narrow footer below video cards so it stays a valid, accessible link rather than nesting a link inside the video play button.

## Verification

- Focused public-wall visual capture: passed on desktop and mobile.
- Full Playwright suite: 102 passed and 46 intentionally skipped.
- Vitest suite: 83 files and 482 tests passed.
- TypeScript, ESLint, Prettier, and embedded script syntax: passed.
- Production build: passed with the documented webpack fallback. The default Turbopack build is blocked in this local execution environment when its CSS worker attempts to bind an internal port.
- React Doctor found no diagnostic in the changed public-wall or testimonial-card components. Its reported warnings belong to other already-modified files on the branch.

## Follow-up: bounded wall and playback handoff

- Current captures: `visual-evidence/desktop-chromium/public-wall.png` and `visual-evidence/mobile-chromium/public-wall.png`.
- The hosted wall and embed are capped at 72rem and retain two desktop columns. In the Atrakt integration preview, the host measured 1065px inside the page container, with two 525px cards; the embed reported a 1152px maximum.
- The Atrakt page was proxied locally without changing its repository, and its native testimonial section was replaced at runtime by the real `embed/v1.js` output using deterministic fixture data.
- A 9:16 card measured 523 × 929px and a 3:4 card measured 523 × 697px. Both matched their declared source ratios, so the portrait subject was no longer cropped into a landscape frame.
- At a 385px Atrakt viewport, the embed switched to one 338px column with no document-level horizontal overflow.
- Mux Player is prepared behind the poster with `preload="none"`. The poster remains interactive and visible until the media emits `playing`; the player is inert before playback so its hidden controls do not steal keyboard focus.
- The real Atrakt-browser playback reached `readyState=4`, advanced past ten seconds, retained `prefer-playback="mse"`, and exposed a browser-local `blob:` media URL as expected.
- Targeted component tests, TypeScript, and the four desktop embed integration tests passed. The full visual capture run produced the updated public-wall desktop/mobile images; 52 screens passed and six unrelated dialog fixture captures failed because their expected headings/content were absent.
- React Doctor reported no finding in the changed public-wall/player files. Its remaining 26 warnings point to other pre-existing changed files, and its global score was unavailable because maintainability analysis did not complete.

## Follow-up: real Atrakt landscape-ratio repair

- Initial live signal: the public card declared and displayed 9:16 while the Mux media element reported an intrinsic 1280 × 720 video.
- Boundary inspection showed Mux stored `aspect_ratio: "16:9"`, while both the ready Convex Video Asset and its existing Public Projection had no `aspectRatio` value.
- The observed Mux event sequence included `video.asset.ready` followed by `video.asset.updated`; the latter was stored with outcome `ignored`.
- The webhook handler now accepts a valid ratio from `video.asset.updated`, persists it on the ready Video Asset, and refreshes an already-published video projection.
- The affected development asset was repaired from Mux's authoritative metadata. After reload, the live card declared `16:9`, computed to `16 / 9`, and the playing media still reported 1280 × 720.
- The focused regression test first publishes the projection without a ratio, then verifies that the later metadata event changes the webhook outcome to `metadata_updated` and updates the public result to 16:9.
- Live visual inspection passed, as did the focused regression, all 484 Vitest tests, lint, TypeScript, webpack production build, and deterministic desktop/mobile Public Wall captures.

final result: passed

---

# Design QA: Profile Images and Organization Logos

## Sources

- GitHub profile entry: `/Users/johanleroch/.codex/visualizations/2026/08/31/01a05741-f397-7f63-b774-2fface0465d5/org-profile-mobbin/05-github-profile-photo-entry.jpg`
- GitHub upload menu: `/Users/johanleroch/.codex/visualizations/2026/08/31/01a05741-f397-7f63-b774-2fface0465d5/org-profile-mobbin/06-github-profile-photo-upload.jpg`
- GitHub circular crop: `/Users/johanleroch/.codex/visualizations/2026/08/31/01a05741-f397-7f63-b774-2fface0465d5/org-profile-mobbin/07-github-profile-photo-crop.jpg`
- Dovetail logo settings: `/Users/johanleroch/.codex/visualizations/2026/08/31/01a05741-f397-7f63-b774-2fface0465d5/alternative-logo-profile-mobbin/04-dovetail-logo-saved.jpg`
- monday.com square logo crop: `/Users/johanleroch/.codex/visualizations/2026/08/31/01a05741-f397-7f63-b774-2fface0465d5/alternative-logo-profile-mobbin/01-monday-logo-crop.jpg`

## Implementation captures

- Desktop profile, 1440 x 1000: `/Users/johanleroch/.codex/visualizations/2026/08/31/01a05741-f397-7f63-b774-2fface0465d5/profile-image-implementation/profile-desktop.png`
- Mobile profile, 390 x 844: `/Users/johanleroch/.codex/visualizations/2026/08/31/01a05741-f397-7f63-b774-2fface0465d5/profile-image-implementation/profile-mobile.png`
- Circular crop dialog, 1440 x 1000: `/Users/johanleroch/.codex/visualizations/2026/08/31/01a05741-f397-7f63-b774-2fface0465d5/profile-image-implementation/profile-crop-dialog-desktop.png`
- Uploaded profile image, 1440 x 1000: `/Users/johanleroch/.codex/visualizations/2026/08/31/01a05741-f397-7f63-b774-2fface0465d5/profile-image-implementation/profile-uploaded-desktop.png`
- Desktop Organization settings, 1440 x 1000: `/Users/johanleroch/.codex/visualizations/2026/08/31/01a05741-f397-7f63-b774-2fface0465d5/profile-image-implementation/organization-settings-desktop.png`
- Mobile Organization settings, 390 x 844: `/Users/johanleroch/.codex/visualizations/2026/08/31/01a05741-f397-7f63-b774-2fface0465d5/profile-image-implementation/organization-settings-mobile.png`
- Square crop dialog, 1440 x 1000: `/Users/johanleroch/.codex/visualizations/2026/08/31/01a05741-f397-7f63-b774-2fface0465d5/profile-image-implementation/organization-logo-crop-dialog-desktop.png`
- Uploaded Organization logo, 1440 x 1000: `/Users/johanleroch/.codex/visualizations/2026/08/31/01a05741-f397-7f63-b774-2fface0465d5/profile-image-implementation/organization-logo-uploaded-desktop.png`
- Organization onboarding, 1440 x 1000: `/Users/johanleroch/.codex/visualizations/2026/08/31/01a05741-f397-7f63-b774-2fface0465d5/profile-image-implementation/onboarding-desktop.png`

## Comparison history

1. Compared GitHub's circular crop with the implemented crop dialog in `/Users/johanleroch/.codex/visualizations/2026/08/31/01a05741-f397-7f63-b774-2fface0465d5/profile-image-implementation/github-profile-comparison.png`. Preserved the circular mask, direct manipulation, zoom, cancel, and explicit confirmation while using the starter's dialog, typography, spacing, and button system.
2. Compared Dovetail's inline logo settings with the implemented Organization settings in `/Users/johanleroch/.codex/visualizations/2026/08/31/01a05741-f397-7f63-b774-2fface0465d5/profile-image-implementation/organization-logo-comparison.png`. Preserved the inline identity card, visible logo, replace/remove actions, and stable identifier while keeping the starter's denser shell.
3. Verified 390 px layouts: controls stack without horizontal overflow, the sidebar becomes the existing mobile sheet, and all primary actions remain visible.
4. Exercised both crop dialogs against real local routes, uploaded neutral project imagery to the dev deployment, and confirmed reactive image rendering in the profile, settings, user navigation, and Organization switcher.

## Final result

passed

### Edit overlay polish

- Reference: `/var/folders/4q/0rvcnp8x0pl_nclw7wbyzs2w0000gn/T/codex-clipboard-ef537527-5d45-4472-aa61-1d19dd371a5b.png`
- Rest state: `/Users/johanleroch/.codex/visualizations/2026/08/31/01a05741-f397-7f63-b774-2fface0465d5/profile-image-hover/profile-image-rest.png`
- Hover state: `/Users/johanleroch/.codex/visualizations/2026/08/31/01a05741-f397-7f63-b774-2fface0465d5/profile-image-hover/profile-image-hover.png`

The reference exposed the edit overlay permanently. The revised control keeps the image unobstructed at rest, fades the overlay in on hover, and also reveals it for keyboard focus. The separate upload or replace action remains visible for touch input.

final result: passed
