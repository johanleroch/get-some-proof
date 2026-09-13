# Landing page: Get Some Proof

The design of the public homepage at `/`, specified in issue #181 and built
from the copy that issue makes canonical. It extends `DESIGN.md` (tokens,
type, hand-drawn signature, motion, banned patterns) and never contradicts
it; where this file and `DESIGN.md` disagree, `DESIGN.md` wins and this file
is wrong.

Status: first version, awaiting the founder's review. Review the blocks at
`/kit/landing`, the page at `/`, and the four artboard widths in `/screens`
(section "Marketing site (public)").

## 1. What the page has to do

Lead with the result — published proof on a website — then explain how it is
collected, chosen and published. One call to action, "Start for free",
repeated in the header, the hero and the closing poster. "Sign in" stays a
secondary utility link, visible at every width.

Nothing on the page is a Get Some Proof customer. Every block of proof says
so where it stands, and the page repeats it above the footer.

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

The bands alternate down the page and each one is a change of voice:
paper, quiet (`--surface-2`), paper, quiet, paper, quiet, the amber poster
(`--brand-soft`, once), paper, and the ink panel at the end.

| #   | Block          | Desktop (1440)                                                                            | Phone (390)                                   |
| --- | -------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1   | Hero           | Words on 5, proof on 7: real cards on the paper in two offset columns, no frame           | Words, actions, written proof, then the video |
| 2   | The friction   | Statement title on 7, its two paragraphs side by side under it, the envelope drawing on 4 | One column; the drawing is dropped            |
| 3   | Collection     | The real Collection Form on 6, words on 5 from column 8                                   | Form first, then words                        |
| 4   | Two selections | Title on 5, words on 6; below, two Widgets at 7:5, the second starting 64px lower         | Title, words, one Widget, then the other      |
| 5   | Presentation   | Sticky Studio controls on 4, the Studio preview canvas on 8                               | Words, controls, preview                      |
| 6   | Three steps    | Rows: the count, the verb, the sentence at columns 1 / 2-6 / 7-12                         | Count and verb, sentence under                |
| 7   | Control        | Amber band: promise and Wall drawing on 4, four rows on 7                                 | Promise, then the rows                        |
| 8   | Questions      | Full-width title, six questions in two columns under it                                   | One column                                    |
| 9   | Closing        | Ink panel, words left, mascot cropped right                                               | Words, mascot under, cropped                  |

Hand-drawn elements, one per region (`DESIGN.md` section 4), in page order:
the marker swash on "happy" in the hero title and the note "demo wall,
nobody real yet" under the wall it names (the hero's two halves count as two
regions, as they do on `/templates`); the envelope on its way in the
friction; the note "what your customers open" under the Collection Form,
whose own two drawings belong to that product screen; "a different pick
here" beside the second Widget; "paste this on your site" under the embed
code; the ring around "three"; the Wall drawing on the amber band; and the
starstruck mascot on the closing poster.

## 4. Components

New, in `src/components/landing/`:

- `landing-page.tsx` — the composition and the header's links.
- `landing-primitives.tsx` — `LandingSection` (band + rhythm), `PageTitle`,
  `SectionTitle` (`default` and `statement`), `SectionLead`, `Eyebrow`,
  `Highlighted` (the marker swash) and `DemoLine`.
- `demo-cards.tsx` — `DemoCardColumn` and `DemoCardMasonry`, which lay out the
  real `TestimonialCard` on the paper.
- One file per block: hero, problem, collection, selection, studio, steps,
  capabilities, faq, cta.
- `src/lib/landing-demo.ts` — the fictional Brand, its Testimonials, the
  Widget configuration and the embed snippet.
- `src/lib/landing-blocks.ts` — the blocks, their notes and their files, for
  the development page.

There is no framed "demo panel" component: proof sits on the paper the way a
Wall renders it, and `DemoLine` (a neutral badge and one `small` sentence)
says what it is. A chrome bar over every demonstration was the first
version's mistake — it made six sections look like one screenshot viewer
repeated down the page.

Reused as they are: `TestimonialCard` (the same markup the Wall, the Inbox
and the embed render), `CollectionFormPreview`, `WidgetPreview` (the real
`/embed/v2.js` runtime, in its own shadow root) on `.studio-preview-canvas`
(the Studio's own 24px grid), `Select`, `ColorPicker` with the product's
`accentPresets`, `EmbedCode`, `Button`, `Badge`, `Label`, `Blob`,
`ArrowNote`, `CircleAround`, `MarkerHighlight`, `EnvelopeSent`, `WallFrames`,
and the public header and footer.

Changed: `PublicSiteHeader` now takes in-page links, says "Start for free"
everywhere (the templates pages said "Get started free"), keeps "Sign in" at
every width, and drops to the mark alone below `sm` so both actions fit at
320px.

## 5. Development page

`/kit/landing` renders every block live, full width, with what it has to do
and the file that draws it, under a specimen of the page's own pieces (the
two title cuts, the lead, the eyebrow, the demonstration caption, the notes,
the drawings, the four bands). Device widths belong to `/screens`, which
frames the real page at the four artboards: a block squeezed into a narrow
column in the kit would flatter, and a preview that flatters lies.

## 6. Interaction states

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
- **Sticky**: the header (`top-0`) and the Studio controls from `lg`.

## 7. Motion

No scroll-triggered reveal, no parallax, no marquee, no autoplay: the only
motion is the interaction states above, the `Select` and `Popover`
entrances, which use the product's curves, and the slow drift of the
envelope drawing (`float`, the doodle loop `DESIGN.md` section 4 allows).
Under `prefers-reduced-motion` the global rule in `globals.css` collapses
every transition, the drift stops, and the embed runtime holds its own
animations. A marketing page that animates on scroll is exactly the generic
pattern `DESIGN.md` bans.

## 8. Responsive behaviour

- **1440 → 1024**: the 12-column grids hold; the wall, the Studio canvas and
  the two Widgets shrink with their columns.
- **1024 → 768**: every section is one column, the Studio controls stop
  sticking, the friction drawing is dropped rather than shrunk to a stamp.
- **768 → 390**: the header keeps the wordmark until `sm` (640px) and shows
  the mark alone below it; the hero puts the written proof before the video,
  the cards stack, the accent hex value hides and the embed code wraps.
- **390 → 320**: nothing is hidden and nothing scrolls sideways; the e2e
  test `e2e/landing.spec.ts` holds that floor.

Verified at 1440, 1280, 834, 390 and 320 (Chromium), and the whole spec runs
on the five Playwright browsers.

## 9. Accessibility

One `h1`; every section titled by its own `h2` and labelled through
`aria-labelledby`. The questions and the capabilities are `dl`s, the steps an
`ol`. Doodles are `aria-hidden`. Touch targets stay at 44px where they sell
and 40px in the header. `/` is part of `e2e/accessibility.spec.ts` and passes
axe WCAG 2.2 A/AA.

## 10. Demonstration content policy

The fictional Brand is Fernhill Studio, the same one the visual-evidence
fixtures use, and its Testimonials talk about _its_ work — never about Get
Some Proof — so a visitor cannot read them as our endorsements. One video
only, and its name matches the person recorded in it. No user counts, no
ratings of our product, no customer logos, no conversion claims, no urgency.

## 11. Asset inventory

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
   the demonstration captions honestly.
4. A customer photo or two, so the cards can show a face instead of the
   display quote mark.
5. A real Brand logo for the Collection Form demonstration (the preview
   currently shows the two-letter fallback tile).

## 12. Copy: what the page says that the issue did not

The issue's copy is used verbatim. What had to be written for the layout is
navigation, labels and captions, never a product claim:

- Header: "How it works", "Templates", "FAQ".
- Hero: the secondary action "See how it works".
- Eyebrows and captions: "On the homepage", "On the pricing page", "Three
  testimonials, in the order this Owner set.", "Two others, chosen from the
  same workspace.", the Collection Form address, and the demonstration
  captions.
- Handwritten notes: "demo wall, nobody real yet", "what your customers
  open", "a different pick here", "paste this on your site".

Suggested edits, for the founder to accept or refuse:

- Section 2 lists the four chores in its first sentence. The block reads
  well without it, and the statement lands harder.
- Section 6's three steps sit after three sections that already show the
  journey. They could move above section 5 so the page reads collect →
  choose → publish in order.

## 13. Open questions

- The Studio demonstration offers three of the five templates: Testimonial
  highlights needs marked phrases and Avatar stack needs customer photos.
  With assets 3 and 4 above, it can offer all five.
- Whether the Free plan's promotion card should appear in the demonstration
  Widget. It is the truthful Free state; it is left off today because the
  same demonstration also shows Pro templates.
