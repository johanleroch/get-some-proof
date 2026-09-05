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
