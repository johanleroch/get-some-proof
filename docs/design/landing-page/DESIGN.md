# Landing page: Get Some Proof

The design of the public homepage at `/`, specified in issue #181 and built
from the copy that issue makes canonical. It extends `DESIGN.md` (tokens,
type, hand-drawn signature, motion, banned patterns) and never contradicts
it; where this file and `DESIGN.md` disagree, `DESIGN.md` wins and this file
is wrong.

Status: first version, awaiting the founder's review. Review it in `/screens`
(section "Marketing site (public)") at the four artboards, and mark it OK
there when it matches this file on desktop and mobile.

## 1. What the page has to do

Lead with the result — published proof on a website — then explain how it is
collected, chosen and published. One call to action, "Start for free",
repeated four times (header, hero, closing panel, and the header again when
it sticks). "Sign in" stays a secondary utility link, visible at every width.

Nothing on the page is a Get Some Proof customer. Every demonstration is one
fictional studio, labeled on the frame that holds it and again in a line
above the footer.

## 2. Route

`/` decides three ways, in this order: an unconfigured deployment keeps the
`SetupRequired` screen; a signed-in Owner still goes to `/dashboard`; a
signed-out visitor reads this page. The page is indexable
(`robots: index, follow`) and joins `/templates` in `sitemap.ts`.

## 3. Composition

Container 1280px, page padding 20px (mobile) and 32px (from `sm`), section
rhythm `clamp(3rem, 8vw, 6rem)`. Every multi-column section collapses to one
column below `lg` (1024px) and every grid child carries `min-w-0`, because a
Testimonial card truncates its identity line and would otherwise refuse to
shrink under 320px.

Bands alternate so the page breathes: paper, then `--surface-2` on the
problem, the three steps and the FAQ, and the closing panel on `--ink`.

| #   | Section        | Desktop (1440)                                          | Phone (390)                              |
| --- | -------------- | ------------------------------------------------------- | ---------------------------------------- |
| 1   | Hero           | 5:7 split, words centred against the proof panel        | Words, actions, then the Widget          |
| 2   | Problem        | 6 columns of words, the four chores as a chain on 5     | Words, then the chain                    |
| 3   | Collection     | The real Collection Form on 6, words on 5 from column 8 | Form first, then words                   |
| 4   | Relevant proof | Title on 5, words on 6; below, two Widgets at 7:5       | Title, words, one Widget, then the other |
| 5   | Presentation   | Sticky controls on 4, live embed on 8                   | Words, controls, preview                 |
| 6   | Three steps    | Rows: numeral, verb, sentence at columns 1 / 2-5 / 7-12 | Numeral and verb, sentence under         |
| 7   | Capabilities   | Sticky title on 4, four rows in two columns on 7        | One column of four rows                  |
| 8   | FAQ            | Sticky title on 4, six questions in two columns on 7    | One column                               |
| 9   | Closing        | Ink panel, words left, mascot cropped right             | Words, mascot under, cropped             |

Hand-drawn elements, one per region and no more (`DESIGN.md` section 4):
the marker swash behind "happy" in the hero title, the arrow note "still
nothing on your site" at the end of the problem chain, the two Collection
Form drawings that belong to the product screen itself, the arrow note
"paste this on your site" under the embed code, the ring around "three" in
the steps title, and the mascot on the closing panel.

## 4. Components

New, in `src/components/landing/`:

- `landing-page.tsx` — the composition and the header's links.
- `landing-primitives.tsx` — `LandingSection` (band + rhythm), `SectionTitle`,
  `SectionLead`, `Eyebrow`, `Highlighted` (the marker swash), and `DemoFrame`.
- `demo-cards.tsx` — `DemoCardColumn` and `DemoCardMasonry`, which lay out the
  real `TestimonialCard`.
- One file per section: hero, problem, collection, selection, studio, steps,
  capabilities, faq, cta.
- `src/lib/landing-demo.ts` — the fictional Brand, its Testimonials, the
  Widget configuration and the embed snippet.

`DemoFrame` is the only way a demonstration reaches the page: it draws the
`--surface` panel, the label of the place the Widget lives, the "Demo" badge
and the caption. The badge is not a prop a section can forget.

Reused as they are: `TestimonialCard` (the same markup the Wall, the Inbox
and the embed render), `CollectionFormPreview`, `WidgetPreview` (the real
`/embed/v2.js` runtime, in its own shadow root), `Select`, `ColorPicker` with
the product's `accentPresets`, `EmbedCode`, `Button`, `Badge`, `Label`,
`Blob`, `ArrowNote`, `CircleAround`, `MarkerHighlight`, and the public
header and footer.

Changed: `PublicSiteHeader` now takes in-page links, says "Start for free"
everywhere (the templates pages said "Get started free"), keeps "Sign in"
at every width, and drops to the mark alone below `sm` so both actions fit
at 320px.

## 5. Interaction states

- **Primary button** (`Start for free`): `--brand` fill, `--brand-ink` text,
  `--brand-strong` on hover, 1px down on press, 3px `--brand-ring` on focus,
  44px tall (`lg`) wherever it sells, 40px in the header.
- **Secondary**: "See how it works" and "Sign in" are ghost buttons —
  `--surface-2` on hover, same focus ring.
- **Header links**: `--ink-2` to `--ink` with a `--surface-2` tint on hover,
  150ms on `--ease-out-soft`.
- **Template select**: the product's own `Select`; the Pro templates carry
  the " · Pro" suffix the Studio gives them.
- **Accent swatches**: the product's `ColorPicker` — 28px swatches in 44px
  targets, a check on the chosen one, and the custom well opening our panel.
  Changing either control re-renders the real embed runtime.
- **Testimonial cards**: hover does nothing; the play button scales 1.05 on
  hover and focus and opens the player on click, never on load.
- **Sticky**: the header (`top-0`), and the titles of sections 5, 7 and 8
  from `lg`.

## 6. Motion

No scroll-triggered reveal, no parallax, no marquee, no autoplay: the only
motion is the interaction states above and the `Select`/`Popover` entrances,
which use the product's curves. Under `prefers-reduced-motion` the global
rule in `globals.css` collapses every transition, the embed runtime holds
its own animations, and the page is identical in every other respect. This
is deliberate: `DESIGN.md` bans decorative perpetual motion, and a marketing
page that animates on scroll is exactly the generic pattern the founder
asked to avoid.

## 7. Responsive behaviour

- **1440 → 1024**: the 12-column grids hold; the hero panel and the embed
  preview shrink with their columns.
- **1024 → 768**: every section is one column, the demonstrations run full
  width, the sticky titles stop sticking.
- **768 → 390**: the header keeps the wordmark until `sm` (640px) and shows
  the mark alone below it; the hero puts the written proof before the video,
  the cards stack, the accent hex value hides and the embed code wraps.
- **390 → 320**: nothing is hidden and nothing scrolls sideways; the e2e
  test `e2e/landing.spec.ts` holds that floor.

Verified at 1440, 1280, 834, 390 and 320 (Chromium), and the whole spec runs
on the five Playwright browsers.

## 8. Accessibility

One `h1`; every section titled by its own `h2` and labelled through
`aria-labelledby`. The FAQ is a `dl`, the steps an `ol`, the chores an `ol`.
Demonstrations are `figure`/`figcaption`. Doodles are `aria-hidden`. Touch
targets stay at 44px where they sell and 40px in the header. `/` is part of
`e2e/accessibility.spec.ts` and passes axe WCAG 2.2 A/AA.

## 9. Demonstration content policy

The fictional Brand is Fernhill Studio, the same one the visual-evidence
fixtures use, and its Testimonials talk about _its_ work — never about Get
Some Proof — so a visitor cannot read them as our endorsements. One video
only, and its name matches the person recorded in it. No user counts, no
ratings of our product, no customer logos, no conversion claims, no urgency.

## 10. Asset inventory

Blocking before launch:

1. **A demonstration video we are allowed to show.** The current clip is the
   public Mux sample the fixtures use: it carries burned-in French captions
   and a third-party logo watermark, and it is a two-speaker recording. Two
   or three short English testimonial videos (portrait, 15 to 30 seconds,
   no third-party branding) would replace it in `src/lib/landing-demo.ts`
   alone.
2. **An English sharing card.** `public/brand/social-card.png` and its alt
   text in `src/lib/seo.ts` are in French.

Wanted, not blocking:

3. Authorized customer Testimonials, to replace the fictional set and drop
   the "Demo" labels honestly.
4. A customer photo or two, so the cards can show a face instead of the
   display quote mark.
5. A real Brand logo for the Collection Form demonstration (the preview
   currently shows the two-letter fallback tile).

## 11. Copy: what the page says that the issue did not

The issue's copy is used verbatim. Four strings had to be written for the
layout, all navigation or captions, none of them a product claim:

- Header: "How it works", "Templates", "FAQ".
- Hero: the secondary action "See how it works".
- Frame labels: "Fernhill Studio · homepage", "/c/fernhill-studio",
  "Widget on the homepage", "Widget on the pricing page", "Your website".
- Captions under the frames, and the disclosure line above the footer.

Suggested edits, for the founder to accept or refuse:

- Section 2 repeats the four chores that the chain on the right already
  draws. Either keeps its meaning alone; the paragraph could lose its first
  sentence if the chain stays.
- Section 6's three steps are the shortest part of the page and sit after
  three sections that already show the journey. It could move above section
  5 so the page reads collect → choose → publish in order.

## 12. Open questions

- The Studio demonstration offers three of the five templates: Testimonial
  highlights needs marked phrases and Avatar stack needs customer photos.
  With assets 3 and 4 above, it can offer all five.
- Whether the Free plan's promotion card should appear in the demonstration
  Widget. It is the truthful Free state; it is left off today because the
  same demonstration also shows Pro templates.
