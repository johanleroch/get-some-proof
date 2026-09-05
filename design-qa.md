# Inbox moderation design QA

## Evidence

- Source visual truth: `visual-evidence/desktop-chromium/public-wall.png` and `visual-evidence/mobile-chromium/public-wall.png`
- Implementation: `visual-evidence/desktop-chromium/testimonial-inbox.png` and `visual-evidence/mobile-chromium/testimonial-inbox.png`
- Combined comparisons: `visual-evidence/manual/inbox-wall-desktop-comparison.png` and `visual-evidence/manual/inbox-wall-mobile-comparison.png`
- Desktop source: 1280 x 1792 px; desktop implementation: 1280 x 1084 px; CSS viewport 1280 px wide; device scale factor 1.
- Mobile source: 412 x 2266 px; mobile implementation: 412 x 2007 px; CSS viewport 412 px wide; device scale factor 1.
- State: mixed Pending, Published, and Spam moderation cards; Published vertical video; curation collapsed.

## Full-view comparison

The Inbox now uses the Public Wall card itself for the customer-facing preview. Identity, avatar fallback, role/company hierarchy, star treatment, text typography, source-ratio video poster, play affordance, radii, and spacing therefore match by construction. The light dashboard surface and private moderation chrome are intentional context differences from the system-dark wall fixture. Three columns fit without overflow on desktop; mobile collapses to one column with all actions visible before the tall video preview.

## Focused comparison

The combined desktop and mobile comparisons were inspected around the identity block, stars, text quote, video poster, and player affordance. No separate crop was needed because these details remain readable at original resolution. The Inbox adds only a compact private header and action band around the unchanged wall card. The Published card exposes Unpublish and Delete permanently before the preview, so neither action is pushed below a vertical video.

## Required fidelity surfaces

- Fonts and typography: same Inter stack, weights, sizes, line heights, and wall-card markup; private metadata stays deliberately smaller and muted.
- Spacing and layout rhythm: wall card padding is unchanged; moderation header/action bands use consistent 16 px padding; desktop and mobile show no clipping or horizontal overflow.
- Colors and visual tokens: wall accent is passed from the Brand's wall settings; statuses use semantic muted, amber, emerald, and destructive tokens. The surrounding dashboard theme intentionally remains independent of the Public Wall theme.
- Image quality and asset fidelity: the shared card keeps the same Mux poster URL, source-ratio 9:16 frame, focal treatment, and lazy player. No placeholder or recreated asset replaces wall imagery.
- Copy and content: customer proof is unchanged; private email, consent date, status, video readiness, and moderation actions are clearly separated from the public preview.

## Findings

No actionable P0, P1, or P2 mismatch remains.

## Comparison history

1. Initial implementation placed moderation actions below the wall preview. On a vertical Published video, Unpublish and Delete permanently fell below the viewport.
2. The action band was moved before the preview in both visual and DOM order. The revised desktop and mobile captures show all Published actions immediately, with the wall-style preview preserved below.

## Follow-up polish

No P3 item is required for this scope.

final result: passed

---

# Testimonial deletion dialog design QA

## Evidence

- Source visual target: the user-provided Senja deletion dialog, `codex-clipboard-036bef48-e920-4d5a-988e-5f37d760d18a.png` (1220 x 578 px).
- Implementation: `visual-evidence/desktop-chromium/testimonial-delete.png` (1280 x 720 px) and `visual-evidence/mobile-chromium/testimonial-delete.png` (412 x 1098 px), device scale factor 1.
- Combined source/implementation comparison: `visual-evidence/manual/testimonial-delete-senja-comparison.png`.
- State: light-theme testimonial Inbox with the permanent-deletion confirmation open.

## Full-view and focused comparison

The implementation preserves the reference's compact hierarchy: warning icon, short title, one plain-language sentence, and Cancel/Delete actions. The destructive action remains visually primary. The desktop and mobile captures confirm that the dialog and both actions stay within the viewport; the mobile layout stacks the full-width actions without clipping.

The combined comparison keeps the title, description, warning treatment, and actions readable at the same time, so no additional focused crop is needed. The missing top-right close icon is intentional: this destructive AlertDialog requires an explicit Cancel or Delete decision and already exposes an accessible Cancel action.

## Required fidelity surfaces

- Fonts and typography: the existing product font and weight tokens preserve the reference's strong title and quieter description hierarchy.
- Spacing and layout rhythm: warning icon and copy align on one row; the action row has clear separation and no overflow at either captured breakpoint.
- Colors and tokens: existing background, muted copy, border, and destructive tokens replace Senja's brand-specific palette while retaining the same semantic contrast.
- Image quality: no raster asset is required; the warning symbol uses the project's installed icon library and renders sharply.
- Copy and content: the technical Mux, record, consent, timestamp, and identifier details are removed. The dialog now asks one question and states permanence once.

## Findings and comparison history

The first implementation already has no actionable P0, P1, or P2 mismatch. Desktop and mobile captures both keep every control inside the dialog. No visual fix was required after comparison.

## Follow-up polish

No P3 item is required for this scope.

final result: passed
