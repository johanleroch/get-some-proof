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
