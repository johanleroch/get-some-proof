# Design System: Get Some Proof

This file is the single source of truth for the visual redesign. Agents and
contributors read it before touching any UI. When a rule here conflicts with
what the code currently does, the code is wrong and this file wins. When a rule
here conflicts with `docs/product-scope.md` (behavior) or `CONTEXT.md` (domain
language), those win and this file must be updated.

Status: direction approved on 2026-09-07 by the founder (designer). The accent
hue is **not final**: it is built from one source token so it can change in one
line (see 2.2). Review progress screen by screen in the development gallery at
`/screens` and mark each screen OK there.

References that set the tone (borrow the grammar, never the brand): Tally
(warm light canvas, one accent, lists over cards, hand-drawn empty states),
Toggl (one loud accent, chunky confidence), Datafast (bold tight headlines,
handwritten annotations with arrows, avatars as social proof).

## 1. Visual theme and atmosphere

Indie SaaS, not corporate. A warm paper-white canvas, one amber accent taken
from the star logo, bold grotesque headlines with tight tracking, and a
hand-drawn signature (scribbled stars, wavy underlines, handwritten notes with
arrows) used with restraint. The interface feels like a well-made tool built by
a small team that cares, not a template.

Calibration (1 to 10):

- Density 5, "balanced and generous": body 15px, page titles 28 to 32px,
  lists rather than stacked cards, the essentials visible without scrolling.
- Variance 6, "offset": left-aligned headers, asymmetric two-column splits,
  one hand-drawn element per region. Never a centered card floating on a void.
- Motion 5, "fluid and discreet": 150 to 250ms, light spring on enters,
  staggered lists, tactile press on buttons. Nothing choreographed.

Light is the primary theme. Dark exists, stays warm, and is finished second.
Both themes share the same structure: no decorative layer that only exists in
one theme (this removes the current dark-only "shine" and gradient chrome).

## 2. Color

All colors are OKLCH. Neutrals carry a slight warm cast (hue 60 to 85, chroma
0.005 to 0.015) so white never reads clinical. Pure black and pure gray are
banned. Chromatic color appears in exactly three places: the brand accent, the
semantic statuses, and each customer Brand's own accent on public surfaces.

### 2.1 Neutrals

Light (default):

| Token         | Value                   | Approx.   | Role                                     |
| ------------- | ----------------------- | --------- | ---------------------------------------- |
| `--paper`     | `oklch(0.985 0.005 85)` | `#FCFAF5` | Page background                          |
| `--surface`   | `oklch(1 0 0)`          | `#FFFFFF` | Cards, inputs, popovers, sidebar panels  |
| `--surface-2` | `oklch(0.965 0.008 85)` | `#F5F1EA` | Muted fills, hover rows, table headers   |
| `--ink`       | `oklch(0.25 0.012 60)`  | `#2E2A25` | Primary text, icons                      |
| `--ink-2`     | `oklch(0.48 0.015 60)`  | `#6B655C` | Secondary text, descriptions, metadata   |
| `--ink-3`     | `oklch(0.65 0.012 60)`  | `#9A948B` | Placeholders, disabled text              |
| `--line`      | `oklch(0.90 0.012 80)`  | `#E6E0D5` | Borders, dividers                        |
| `--line-2`    | `oklch(0.82 0.014 80)`  | `#D1C9BB` | Stronger borders (inputs, focused cards) |

Dark (secondary):

| Token         | Value                  | Role                           |
| ------------- | ---------------------- | ------------------------------ |
| `--paper`     | `oklch(0.19 0.010 60)` | Page background, warm not blue |
| `--surface`   | `oklch(0.23 0.010 60)` | Cards, sidebar                 |
| `--surface-2` | `oklch(0.27 0.010 60)` | Muted fills, hover rows        |
| `--ink`       | `oklch(0.94 0.010 85)` | Primary text                   |
| `--ink-2`     | `oklch(0.72 0.012 80)` | Secondary text                 |
| `--ink-3`     | `oklch(0.55 0.012 80)` | Placeholders                   |
| `--line`      | `oklch(1 0 0 / 10%)`   | Borders                        |
| `--line-2`    | `oklch(1 0 0 / 18%)`   | Stronger borders               |

Contrast floors (WCAG 2.2 AA, verified by `e2e/accessibility.spec.ts`): text
on `--paper` or `--surface` uses `--ink` (about 13:1) or `--ink-2` (about
5.5:1). `--ink-3` is never used for text that carries meaning.

### 2.2 Brand accent, built from one source token

The accent is "Proof Amber", the star logo's `#FFBB16`. Everything amber in the
UI derives from a single token with OKLCH relative color syntax, so changing the
brand color later is one edit:

```css
:root {
  /* The only value to change if the brand hue changes. */
  --brand: oklch(0.82 0.17 82);

  /* Derived. Do not hard-code amber anywhere else. */
  --brand-strong: oklch(
    from var(--brand) calc(l - 0.08) c h
  ); /* hover, pressed */
  --brand-soft: oklch(from var(--brand) 0.96 0.05 h); /* tints, selected rows */
  --brand-soft-2: oklch(from var(--brand) 0.91 0.09 h); /* hover on tints */
  --brand-text: oklch(
    from var(--brand) 0.48 0.13 h
  ); /* links and text on paper, AA */
  --brand-ink: oklch(
    0.25 0.012 60
  ); /* text on a --brand fill, dark in both themes */
  --brand-ring: oklch(from var(--brand) 0.7 0.15 h / 50%); /* focus rings */
}

.dark {
  --brand-text: oklch(from var(--brand) 0.85 0.15 h);
  --brand-soft: oklch(from var(--brand) 0.3 0.05 h);
  --brand-soft-2: oklch(from var(--brand) 0.36 0.07 h);
}
```

Rules:

- Text on a `--brand` fill is always `--brand-ink`, which stays dark in both
  themes. Amber with white or light text fails contrast and is banned.
- Amber text on paper always uses `--brand-text`, never `--brand`.
- Stars (ratings) and the star logo use `--brand`. Nothing else in the
  dashboard uses raw `--brand` as a fill except primary buttons, the active
  navigation marker, and progress fills.
- Do not add a second accent. Charts use the neutral ramp plus `--brand` for
  the one highlighted series.

### 2.3 Semantic statuses

| Token       | Light                  | Dark                   | Role                       |
| ----------- | ---------------------- | ---------------------- | -------------------------- |
| `--success` | `oklch(0.50 0.14 150)` | `oklch(0.75 0.14 150)` | Published, verified, saved |
| `--warning` | `oklch(0.52 0.16 45)`  | `oklch(0.78 0.15 50)`  | Pending, processing, quota |
| `--danger`  | `oklch(0.52 0.19 27)`  | `oklch(0.72 0.17 25)`  | Destructive, errors        |
| `--info`    | `oklch(0.52 0.09 250)` | `oklch(0.75 0.09 250)` | Neutral notices            |

Each status has a `-soft` tint for badges and toasts, derived the same way as
the brand. Warning is orange, deliberately away from amber so "pending" never
looks like "brand".

### 2.4 Mapping to the existing shadcn tokens

Keep the shadcn variable names so every primitive keeps working, and point them
at the tokens above: `--background: var(--paper)`, `--card: var(--surface)`,
`--foreground: var(--ink)`, `--muted: var(--surface-2)`,
`--muted-foreground: var(--ink-2)`, `--border: var(--line)`,
`--input: var(--line-2)`, `--primary: var(--brand)`,
`--primary-foreground: var(--brand-ink)`, `--accent: var(--surface-2)`,
`--ring: var(--brand-ring)`, `--destructive: var(--danger)`,
`--sidebar: var(--paper)`, `--sidebar-accent: var(--brand-soft)`,
`--sidebar-accent-foreground: var(--ink)`. `--muted` and `--secondary` are
the quiet fill (`--surface-2`); `--accent` is one step darker so hover rows
read as hover, and the active sidebar item uses `--brand-soft` directly.

### 2.5 Customer Brand accent on public surfaces

The Collection Form, the hosted Wall and the embed keep using each customer
Brand's own color (`--brand-accent`, `--wall-accent`, `--gsp-accent`). Our
amber never appears there. Two fixes are mandatory:

- Ship a computed `accentInk` (dark or light) next to every Brand accent and
  use it instead of the hard-coded white text on accent fills. Prefer warm
  ink or white when either meets 4.5:1; use black only for customer colors
  where neither does. This is the sole exception to the pure-black ban.
- Change the default Brand color seeded at onboarding from violet `#6d5dfc` to
  Proof Amber, and derive the embed's neutral palette from the same warm values
  as `globals.css` so the three palettes become one.

## 3. Typography

Three families plus a mono. The display face is a licensed font, self-hosted;
the others come from Google Fonts through `next/font/google`. The
founder chose Gelica on 2026-09-07, the same day Bricolage Grotesque and DM
Sans were retired because that pair is the identity of the direct competitor
(see section 10).

- Display: **Gelica** (Dave Rowland Type), a soft slab with rounded, concave
  serifs in the Cooper and Goudy Heavyface line: friendly without being cute.
  Static weights 200 to 700 plus 900, with italics. We use 600 (Semi Bold)
  and 700 (Bold); Black (900) is reserved for the wordmark and posters. Page
  titles, section titles, KPI numbers, the Wall header, the Collection Form
  title, empty-state titles. Tracking -0.005em to -0.02em: a slab needs less
  squeeze than a grotesque. Never below 18px. Self-hosted through
  `next/font/local` from `src/app/fonts/gelica/` (Regular, Medium, Semi Bold,
  Bold, Black as WOFF2, converted losslessly from the licensed OTFs: same 479
  glyphs, 704 KB down to 256 KB). The five files are committed, because the
  site is built from this repository and a font kept out of it does not exist
  in production: the first deploy fell back to Figtree for that exact reason,
  and every heading read as body copy. Gelica comes from the founder's
  Monotype Fonts subscription and the repository is public, so the founder
  owns that call; confirm web use with the Monotype license before launch.
- Body and UI: **Figtree** (Erik Kennedy, Google Fonts), variable 300 to 900,
  used at 400, 500, 600. Everything else. A calm geometric with humanist
  warmth: it lets Gelica carry the character and stays crisp at 13 to 15px.
  Chosen over Funnel Sans on 2026-09-07 because Funnel's compact, large
  x-height eye read "techy" next to a soft slab.
- Handwriting: **Caveat**, weights 500 and 600. Only for hand-drawn
  annotations (see section 4). Never for labels, buttons, inputs, or data.
- Mono: **Geist Mono** (already loaded). Public slugs, embed snippets, tokens,
  timestamps, and any number that must align (tabular figures).

Scale (size / line-height, Figtree unless noted):

| Name       | Size | Line | Weight | Tracking | Family  | Use                                    |
| ---------- | ---- | ---- | ------ | -------- | ------- | -------------------------------------- |
| display-xl | 40px | 44px | 700    | -0.02em  | Gelica  | Public Wall and Collection Form titles |
| display    | 32px | 36px | 700    | -0.015em | Gelica  | Dashboard page titles                  |
| heading    | 24px | 30px | 600    | -0.01em  | Gelica  | Section titles, dialog titles          |
| subheading | 18px | 26px | 600    | -0.005em | Gelica  | Card titles, empty-state titles        |
| body       | 15px | 24px | 400    | -0.011em | Figtree | Paragraphs                             |
| quote      | 17px | 26px | 400    | -0.011em | Figtree | The words on a Testimonial card        |
| ui         | 14px | 20px | 500    | -0.008em | Figtree | Buttons, inputs, navigation, table     |
| small      | 13px | 18px | 400    | -0.004em | Figtree | Metadata, helper text                  |
| micro      | 12px | 16px | 600    | +0.06em  | Figtree | Eyebrows and group labels, uppercase   |
| kpi        | 40px | 44px | 700    | -0.02em  | Gelica  | Counts on the dashboard, tabular nums  |
| hand       | 20px | 24px | 500    | 0        | Caveat  | Hand-drawn annotations only            |

Every style is four CSS variables (`--type-<name>-size|leading|weight|tracking`)
in `globals.css` and one composite utility (`type-<name>`). Tracking is
deliberately tight on the sans (Figtree sets loose by default and the founder
asked for less air between letters) and only slightly negative on Gelica,
whose serifs touch when squeezed. The Gelica values are provisional until the
founder tunes them by eye. Tune live in the development `/kit` page and paste
the copied CSS back into `globals.css`.

Headlines get hierarchy from weight and color, not from size alone. Body copy
never exceeds 65 characters per line. Page titles must be real `h1` elements
at `display`: the current 20px page title is retired, as are the literal
weights 510 and 590 and the `SF Pro Display` fallback stack.

Fallback stacks: Gelica falls back to `"Figtree", system-ui, sans-serif`;
Figtree to `system-ui, sans-serif`; Caveat to `cursive`.

## 4. The hand-drawn signature

This is the one thing that makes the product recognizable. Used with restraint,
it says "made by people". Overused, it becomes a theme park.

Vocabulary, shipped as React SVG components under `src/components/doodles/`,
all generated by `scripts/doodles/build.mjs` (`pnpm doodles:build`) so the
marks and the illustrations share one hand; never edit `marks.tsx` or
`spots.tsx` directly:

- `Sparkle`: a big four-point sparkle with a small one, the same accent that
  lights every illustration. Marks the Wall header (in the Brand accent), the
  success step and the dev quick access.
- `Marker highlight`: a highlighter stroke behind one key word in a display
  title, soft amber by default, the text painted on top.
- `Circle around`: a ring drawn once and a bit around a number or a short
  label, the second pass sitting just outside the first.
- `Arrow note`: a curved arrow with a short Caveat caption ("this is what your
  customers see", "paste this on your site"). Caption max 6 words.
- `Spot illustrations`: thin-line drawings for empty states, onboarding, the
  404, the success step and the authentication panel. Subjects come from the
  domain: a speech bubble with stars, a camera on a tripod, an envelope with
  a proof stamp, a wall of framed Testimonials. They share one grammar,
  generated by `scripts/doodles/build.mjs` (`pnpm doodles:build`) and
  enforced by `src/components/doodles/doodles.test.tsx`: a 320 x 220
  artboard; subjects tilted 2 to 6 degrees; closed outlines whose sides bow
  by at most one unit while corners land exactly, so strokes never step;
  overlapping shapes filled with `--surface` so they occlude each other;
  amber only on stars, sparkles and one accent dot; one to three four-point
  sparkles of 4 to 7 units. Never edit `spots.tsx` by hand.
- `The blob`: the mascot from the official icon, upright, rendered (amber
  gradient, soft inner shadows, ink pill eyes), shipped as
  `public/brand/blob.svg`, with eleven expressions in `public/brand/blob/`
  (reviewed at `/kit/blob`, defined in `src/lib/blob-expressions.ts`). The
  one element of the signature that is not a line drawing. Same places as
  the spot illustrations, at most one per screen, 96 to 200px tall, the
  expression chosen from the moment (happy on success, sad on errors,
  curious on empty states) and always said with the eyes alone, the blob has
  no mouth; never in the embed and never next to the logo mark. One
  exception, decided by the founder: the closing panel of `/templates`
  shows it at 420px, cropped by the panel on three sides and tilted 8
  degrees to the left, as a poster would. In motion
  (`AnimatedBlob`, six behaviours at `/kit/blob`), it is a jelly: 2 to 5%
  amplitudes, volume kept in every squash, pivot on its base, frozen by
  reduced motion. Loaders use `look` or `bounce`, idle screens `breathe` or
  `blink`, success `pop`, once. A blob whose face can change is a `Blob`
  component: it blinks between expressions (380ms) rather than swapping
  images.

Rules:

- Stroke 2px (1.5px under 20px), round caps and joins, paths slightly
  irregular. Color is `--ink` by default; `--brand` is reserved for stars,
  sparkles, the circle-around ring and one accent dot, `--surface` for the
  fill of overlapping shapes. No other color, ever.
- Maximum one hand-drawn element per screen region (header, main, sidebar,
  dialog). Empty states and success steps may combine one illustration and
  one arrow note.
- Motion: `float` keeps each object of a drawing drifting 4 to 6px on its own
  slow loop, out of phase with its neighbours, for an illustration that
  carries a screen (the authentication panel). It stops under reduced motion.
  Doodles never draw themselves in: dashing a stroke that also carries a
  non-scaling stroke is unreliable across browsers, and the reveal never read
  as a hand drawing.
- Doodles are decorative: `aria-hidden="true"`, never the only carrier of
  meaning, never overlapping interactive elements, never inside form fields.
- No emoji anywhere in the interface, ever. The doodle vocabulary replaces
  them.
- On public surfaces the signature stays (section 6), but the star is drawn in
  the customer Brand's accent, not ours. The embed ships no doodles: it must
  stay small and neutral inside third-party sites.

## 5. Shape, depth and rhythm

Radius scale: `--radius-sm: 6px` (badges inside buttons, checkboxes),
`--radius-md: 8px` (buttons, inputs, menu items), `--radius-lg: 12px` (cards,
dialogs, dropdowns, testimonial cards), `--radius-xl: 16px` (hero panels, the
Collection Form card), `--radius-full` (pills, avatars, status dots). Nothing
else. `rounded-xl` on every surface is retired.

Depth comes from borders and tone, not shadows. Cards sit on `--paper` with a
1px `--line` border and no shadow. Only floating layers get a shadow, and it is
warm-tinted: `--shadow-float: 0 1px 2px oklch(0.25 0.02 60 / 6%), 0 12px 32px
oklch(0.25 0.02 60 / 12%)` for popovers, dialogs, toasts and the video play
button. No other shadow token exists.

Spacing is a 4px grid. Inside components: 8, 12, 16. Between elements: 16, 24.
Between sections: 32, 48. Page padding: 32px desktop, 20px mobile. Section gaps
on public pages scale with `clamp(3rem, 8vw, 6rem)`.

## 6. Layout

Containers: dashboard content max 1200px, public Wall max 1280px, Collection
Form max 1040px in its split layout. CSS Grid for page structure, flex for
rows. No `calc()` percentage hacks. Full-height sections use `min-h-svh`.

**Every block is centred in the column that holds it**, horizontally and
vertically. A column is wider than its content on a large screen, so a block
pinned to one edge reads as a mistake and leaves a void beside it: `mx-auto`
on the content, `my-auto` on the block inside a `flex-col` column, and never
an `lg:mx-0` that quietly cancels the centring at the width where it matters
most. Both collapse to nothing when the content outgrows the column, so long
pages still start at the top and scroll normally.

- Dashboard: sidebar 260px on `--paper`, content on `--paper` with white
  panels only where grouping helps. Page header is left-aligned: eyebrow
  (micro), `display` title, one primary action on the right. Data lives in
  lists and tables with `--surface-2` row hover, not in stacks of cards.
  Three-equal-cards rows are banned; use a 2:1 or 1:2 split.
- Inbox: the four categories as tabs with their counts, Pending first
  because it is the queue, and nothing else to set: no type or sort
  controls, newest first. Under the tabs, one list panel (`--surface`,
  `--line` hairline, `--radius-lg`) of rows with dividers and `--surface-2`
  hover, never a wall of cards: the Wall is where cards are judged, the
  Inbox is where decisions are made. A row starts with the face (the
  Customer's 48px photo, the display quote mark in the Brand accent, or the
  video still in the video's own shape, 48px wide when portrait and 64px
  when not, with its duration in a corner, which opens the real playable
  card in a dialog; while there is no still yet, the blob looking around or
  the failed mark stands alone, with no box drawn around it; the face is
  centred on its row like the actions and sits 16px from the edge, the same
  air the row keeps above and below it), then the name at `ui` 600 with
  role, company and
  14px stars on the same line, the words in full at `body` (a marked phrase
  keeps its swash), one private line at `small` in one style (received
  date, the email only the Owner sees, the Spam deletion date), and on the
  right the one decision the category allows: Publish and Archive,
  Unpublish, or Not Spam. A video that is not Ready shows its Video Asset
  state as a status Badge (Processing, Uploading, Failed) beside one
  sentence, and Publish is disabled without a note of its own.
  The tools that shape the card (Highlight a phrase, Change thumbnail, Show
  or hide details) and the two rare acts (Spam, Delete) live in the "…"
  menu, the rare ones behind a rule. Published is the Public Wall itself in
  its Curated Order: a grip, arrows, and no separate "wall order" screen.
  Buttons in a row are 36px on desktop and 40px on touch widths; below
  768px the actions wrap under the words.
- Authentication: split screen from 1024px, form first. Left column holds the
  product name, the form and the footer line in one 400px block centered in
  the column, so wide screens never leave the form stuck to the edge; right panel on
  `--surface-2` carries one spot illustration and one sentence of copy. The
  two columns follow the golden ratio (1 : 1.618, so 38.2% / 61.8%) as soon
  as the form column can keep 28rem; below that width the columns share the
  space. Below 1024px, single column with the illustration reduced to the
  scribble star above the title.
- Onboarding: two columns, the form on the left and a live preview card of
  the Collection Form on the right with an arrow note "this is what your
  customers see". Single column on mobile, preview after the form. The form
  asks one question, the Brand name, because `organizations.create` already
  derives the public address, seeds Proof Amber and writes the Collection
  Form copy. The address reads as a consequence under the name ("Your public
  address will be /c/northwind-bakery") with a "Change" that swaps the line
  for the field; the color is the accent swatches; the Collection Form
  wording and the privacy contact wait behind one disclosure, each with the
  real default as its placeholder. Never present a field the domain already
  fills as a required one, and never let the preview show a wording the
  mutation would not write.
  The whole first journey (the account form, its Check-your-email state,
  the verification email, the `/dashboard` wait, this form and the first
  Overview) plays at `/kit/onboarding` on sample data at the four device
  widths, with the failures beside it (address taken, logo upload failed,
  slow network): review the onboarding there, as a sequence, before touching
  any one of its screens.
- Collection Form (public): split from 1024px. Brand panel on the left
  (logo, title in `display-xl`, one sentence, the step list) tinted with the
  customer accent at 8%; form steps on the right at max 520px. Progress is a
  segmented bar of four pills, not a percentage line. Below 1024px it becomes
  one column with a compact brand header. Touch targets stay at 44px.
  Both columns sit vertically centred (`my-auto`, which collapses to nothing
  once the content outgrows the screen), and the Brand lockup, title and step
  list read as one composition with the privacy line alone at the bottom:
  three blocks spread by `justify-between` left the panel looking like
  fragments floating in a void. The compact header below 1024px is literal —
  from step 2 the phone shows the lockup only, because a Submitter who has
  started scrolls past the welcome to reach the fields. Recovering a lost
  management link belongs to step 1 alone; repeated under every step it
  competed with the primary action, and under the thank-you it invited doubt
  about the Submission just made. Errors stay in the form as `FieldError`
  where the Submitter is looking, never only in a toast that leaves after four
  seconds, and one navigation clears the message of the step just left.
  The format choice carries the hand-drawn signature rather than a filled
  accent icon tile: that stack of identical cards each wearing a coloured
  square is the house style of every assistant on the internet and it makes
  the product look generated. `SpeechBubbleStars` and `CameraTripod` do the
  explaining, drawn in `--ink` so they follow the theme. One markup, two
  arrangements: below 640px a band per format, the verb at `heading`
  ("Write it", "Film it") with the sentence and the count each on their own
  line and the drawing balancing on the right; from 640px two tiles side by
  side, the drawing on top at 80px, the verb, the count, and the sentence
  dropped because the drawing already said it. `aria-label` names the button
  with the full sentence at both widths, so the control the Submitter hears
  does not change with their screen. The accent arrives on hover and on focus,
  never as a fill. The onboarding preview is as narrow as a phone, so it shows
  the band — a preview that flatters is a preview that lies. Reviewed at
  `/kit/collection`.
- Public Wall: header left-aligned with the Brand logo, `display-xl` name,
  a scribble star in the Brand accent, and the count of proofs. Masonry of
  1, 2 or 3 columns (below 640px, 640 to 1024px, above), gap 20px. The
  "Load more" control sits centered under the grid. Keep the promo card rule
  from `docs/product-scope.md`; restyle it on `--ink` with `--brand` text and
  the scribble star.
- Empty states: one shared component: spot illustration (max 160px tall),
  `subheading` title, one sentence, one primary action. Never a dashed box
  with a lone sentence.
- Templates browser (our public page at `/templates`): design previews of
  possible proof layouts, Senja's idea (a gallery you can try) in our
  grammar, with nothing on the page that does not earn its place. Public
  header with the logo, sign in and the one primary action; the title with a
  marker highlight and one sentence, no eyebrow and no second button; then a
  browser, not a wall of cards: the templates listed by family in a left
  rail (sidebar items, `--brand-soft` active state with the 3px bar, no
  tags) and one template rendered live on the right. Above the stage: the
  name at `heading`, one sentence and a single action ("Open preview"),
  then a toolbar with the preview width (desktop, tablet, phone), four
  Brand accent swatches plus a custom picker, and the wall theme. Proof Amber
  leads the swatches and is what a preview opens on, the same preselected
  colour the product uses everywhere: chosen by the founder on 2026-09-08 over
  the earlier rule that kept our amber out of the preview frame. One arrow
  note ("this is what your visitors see") is the region's hand-drawn
  element and the only caption. The stage is a CSS container on the wall
  theme with the chosen accent, so a
  390px preview really shows the phone layout; the first preview is visible
  without scrolling on a 1280 x 800 laptop; the arrow keys move through the
  list and the choice lives in the URL (`?template=`). Below 1024px the rail
  becomes a strip of chips. The catalog is `src/lib/templates-catalog.ts`,
  one file per template under `src/components/templates/`, reviewed in
  `/kit/templates` where a template stays a draft until its `status` is
  `public` and where the full-page link and the file path live. This is a
  preview gallery only: multiple Wall templates remain outside product scope.
  Explain that layouts cannot yet be applied; signup must not promise or
  carry a template selection that the product does not support.

Responsive: every multi-column layout collapses to one column below 768px, no
horizontal page scroll ever, headlines scale with `clamp()`, body text never
below 14px on mobile, the desktop sidebar becomes a sheet with the same items.

## 7. Components

- Buttons: `--radius-md`, height 40px (44px on public surfaces), `ui` type at
  weight 600. Primary is `--brand` fill with `--brand-ink` text, hover
  `--brand-strong`, active translates down 1px, focus shows a 3px
  `--brand-ring`. Secondary is `--surface` with a `--line-2` border. Ghost has
  no border and a `--surface-2` hover. Destructive is `--danger` fill with
  `--danger-ink` text: white in the light theme, ink in the dark one, where
  the red is lighter and white would fall under AA (measured 2.67:1).
  Every async button has a `loading` state with a small inline spinner
  and a stable width; swapping the label to "Saving..." is retired.
- Images that change under the hand (a newly chosen video still, a swapped
  photo): the image on screen stays until the next one has finished loading,
  with a 2px `--brand` line pulsing along its bottom edge meanwhile. Never a
  dark or empty box between two pictures; the preview of a poster reuses the
  card's own URL so it opens already loaded (`StillPreview` in
  `src/components/testimonials/video-thumbnail-dialog.tsx`).
- Inputs and textareas: height 40px, `--radius-md`, `--surface` fill, 1px
  `--line-2` border, `--ink-3` placeholder, focus ring 3px `--brand-ring` with
  a `--brand` border. Label above at `ui` weight 500, helper text below at
  `small` in `--ink-2`, error text below in `--danger` with the field border
  in `--danger`. Selects, checkboxes, switches and the color picker become real
  primitives (add `select`, `checkbox`, `switch`, `tabs`, `badge`, `table`,
  `popover` to `src/components/ui`); native controls styled inline are
  retired.
- Cards: `--surface`, `--line` border, `--radius-lg`, padding 20px (24px for
  hero panels). Title at `subheading`. Cards are used only when grouping
  earns it; in lists, rows with dividers replace cards.
- Sidebar navigation: items 36px tall, `--radius-md`, `ui` weight 500. Hover
  `--surface-2`. Active is `--brand-soft` fill, `--ink` text at weight 600,
  and a 3px `--brand` bar on the left edge. The three states must be
  distinguishable at a glance.
- Testimonial card: keeps one markup for Wall, Inbox and embed
  (`testimonial-card-markup.ts`). `--radius-lg`, `--line` border, no shadow,
  24px padding. The stars open the card at 14px in the Brand accent with
  unfilled stars at 25%, 16px above the quote. The quote then reads at `quote`
  (17px on 26px) in `--ink` — one step above `body`, because the proof is what
  was said; tune it at `/kit` like any other style. The signature follows 20px
  below on one row: the
  display quote mark in the Brand accent (`--font-display`, 48px, weight 700,
  kept out of the row height so a name with no role still ends on the padding),
  or the Customer's avatar 32px round when there is one to show; then the name
  at `ui` weight 600 and the role and company at `small` in `--ink-2`. Initials
  are never drawn: they are filler, not proof. Video cards keep the source
  ratio and follow the same grammar on the bottom shade: the stars sit 12px
  above the signature row, which reads exactly as on the text card (display
  mark, name at `ui`, role at `small`, in white), with the 48px play button
  on `--surface` with `--shadow-float` on the right. Never spread the stars
  to the top corner: on a face they look lost. Reviewed at
  `/kit/testimonials`.
- Highlighted words: the `MarkerHighlight` swash painted behind the phrase,
  never a coloured box. `mark` carries it site-wide from `globals.css` in
  amber; a Testimonial card overrides it with the customer Brand accent
  through `src/lib/marker-highlight.ts`.
- Badges and status tags: 24px tall, `--radius-md`, `small` at weight 500,
  on `--surface` with a `--line` hairline. A status colors its 6px dot and
  its label (full-strength status color, AA on `--surface`); the fill stays
  paper, never a pastel tint (the generic "AI pill"). `brand`
  is the one tinted tag (`--brand-soft`), `neutral` sits on `--surface-2`.
- Dialogs: `--surface`, `--radius-lg`, `--shadow-float`, title at `heading`,
  max 480px (560px for content-heavy). One exception, at 672px: the video
  thumbnail picker, because its preview is the real published card beside
  eight moments of the video, and a narrower preview truncated the name. Destructive confirmations keep no close
  icon and require the typed name where they do today. A dialog gives focus
  back to the control that opened it when it closes (the still, the row's
  "…" button, the active tab once the row is gone): none of ours opens from
  a Radix trigger, so `DialogContent` and `AlertDialogContent` remember the
  opener themselves, and a screen never opens a dialog by focusing nothing.
  A confirmation's "Delete" is `--danger`, never the brand amber: the
  primitive leaves an `asChild` Button its own variant.
- Toasts: the mascot tells them. `blobToast.success|info|warning|error|
loading` (`src/components/brand/blob-toast.tsx`, same call shape as
  sonner, rendered through `toast.custom`) shows the blob at 48px on the
  left. Errors show the sad face immediately; other notifications appear
  neutral and blink into their mood (happy, neutral, worried; the loader for
  loading). The message sits in a
  speech bubble: `--surface`, `--line` border, `--radius-lg`,
  `--shadow-float`, a small tail towards the blob, title at `ui` 600 in the
  status color (`--success`, `--info`, `--warning`, `--danger`; `--ink` while
  loading), description at `small` in `--ink-2`, one optional text action in
  the same status color, a dismiss cross. The bubble itself stays `--surface`,
  never a tinted fill: like a badge, the status lives in the words. Toasts appear top right, 20px from the edges (16px on mobile). Sonner
  stays the engine (stacking, timing, swipe to dismiss); `richColors` and
  its icons are retired. The designer menu (⌘.) has a "Test toast" entry to
  check placement on any screen.
- Color picker: our own panel, never the operating system's. `ColorPicker`
  (`src/components/ui/color-picker.tsx`) is the one way to choose a colour
  anywhere in the product: the accent presets as 28px dots inside 44px touch
  targets, Proof Amber first because it is the product's own colour and what a
  new Brand is seeded with, then a custom well that opens a `Popover` on
  `--surface`. Inside, a square for saturation and brightness, a hue slider,
  and the hex itself, in our type and our radii. The native `input[type=color]`
  is retired everywhere: it arrived in the OS font and the OS blue and told the
  customer they had left the product. The square is a two-axis control the
  arrow keys drive (Shift takes the bigger step) and the hex field is the exact
  way in beside it; the hue is one axis, so it stays a real `input[type=range]`
  wearing our paint, 44px tall for the touch target with a 12px visible track.
  A `fieldset` cannot be the target of `label for`, so the visible label
  carries an id and the group points at it with `aria-labelledby`.
- Highlight pill: marking a phrase is a control that comes to the words, not
  a toolbar the words travel to. Selecting text raises a rounded `--surface`
  pill with `--shadow-float` at the bottom right of the selection, 8px below
  it, clamped inside the editor's width; it says "Highlight", or "Remove
  highlight" with `aria-pressed` when the selection already carries the mark.
  A bare caret inside a mark raises the same pill, which is how a highlight
  comes off without re-selecting its exact words. It follows the selection by
  writing to the node in a layout effect, never a render per pixel, and lives
  outside the clipped quote box so it can hang below the last line. The
  keyboard keeps its own way in through `mod+shift+h`, since no floating
  control is reachable by Tab. Reviewed at `/visual-evidence/rich-testimonial`.
- Skeletons: keep the shimmer, on `--surface-2`, shaped like the final layout.
- Loaders: the blob looking around (`BlobLoader`, `look` behaviour, 64px,
  72px full screen) for every indeterminate wait without a skeleton: route
  transitions through the root `loading.tsx`, a form submitting, a video
  processing. Use the mascot for every visible wait, including compact labels,
  upload progress, video buffering, and page skeletons. Loading buttons use
  a small 16px spinner instead.
- Icons: **Tabler** only, 20px in navigation and buttons, 16px inline, stroke
  1.75. Lucide is removed once the last usages are migrated.

## 8. Motion

Nothing in this interface moves in a straight line at a constant rate. The
mascot set the hand (`src/lib/blob-animations.ts`): things overshoot and
settle, they squash when they land and stretch when they travel, and they
never stop dead. The rest of the interface borrows that hand, in moderation.

### 8.1 The curves

Five tokens in `globals.css`, and nothing else. Never write a raw
`cubic-bezier` in a component.

| Token                | Value                               | Use                                                                                  |
| -------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| `--ease-out-soft`    | `cubic-bezier(0.2, 0, 0, 1)`        | Colour, opacity, hover, focus rings. No motion.                                      |
| `--ease-settle`      | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Small things arriving: menus, tooltips, toasts, the switch thumb, the checkbox mark. |
| `--ease-settle-soft` | `cubic-bezier(0.34, 1.35, 0.64, 1)` | Heavier surfaces: dialogs, sheets, preview frames.                                   |
| `--ease-exit`        | `cubic-bezier(0.4, 0, 0.9, 0.6)`    | Anything leaving. It never overshoots.                                               |
| `--ease-sine`        | `cubic-bezier(0.45, 0, 0.55, 1)`    | The only curve allowed to loop (the mascot).                                         |

**Overshoot is measured, not guessed.** `--ease-settle` peaks about 10 percent
past its mark, `--ease-settle-soft` about 4. Below 3 percent the eye reads the
move as linear, which is the whole reason this vocabulary exists.
`easeOvershoot` in `src/lib/motion-tokens.ts` computes it, the `/kit` Motion
section prints it beside each curve, and a guard test keeps the settle curves
above the floor.

**Mass decides the overshoot.** A switch thumb may bounce; a dialog may not.
The bigger the surface, the flatter the curve and the longer the settle. A
sheet slides in with weight and no overshoot at all. Getting this backwards
is what makes an interface feel like a toy.

**Enter and exit are never symmetric.** Something arriving takes its time and
settles (`--motion-settle`, 320ms); something leaving is gone in
`--motion-exit`, 140ms. Durations: `--motion-fast` 150ms for colour and
opacity, `--motion-base` 200ms for transforms, `--motion-settle` 320ms for
entrances that overshoot, `--motion-exit` 140ms for exits.

### 8.2 Squash and stretch

The one ingredient that reads as alive rather than merely eased. An element
travelling stretches along its axis of travel and squashes across it; landing
inverts that, then it settles. Volume is preserved: `scale(1.06, 0.94)`, never
`scale(1.06, 1.06)`. Amplitude stays between 4 and 8 percent outside the
mascot, which is allowed more. The pivot is where the element is anchored:
the base for the blob, the tail for a speech bubble, the trigger for a menu.

### 8.3 Where it applies

- Toasts: sonner places the toast and restacks the pile with `--ease-settle`;
  inside, the bubble arrives stretched and squashes as it lands
  (`.toast-bubble`) and the mascot hops in 70ms later, pivoting on its base
  (`.toast-mascot`), then blinks into the expression of the message. Two
  parts, two moments: that stagger is what makes it read as a character
  speaking, not a box appearing.
- Menus, popovers, selects and tooltips: fade and scale from 95 percent with
  `--ease-settle`, from the trigger's origin.
- Dialogs: fade and scale from 0.98 with `--ease-settle-soft`.
- Lists and grids mount with a 30ms stagger, 12px upward travel, opacity from 0. Maximum 12 items staggered; the rest appear instantly.
- Buttons press down 1px on active; cards and rows do not lift on hover, they
  tint.
- Hand-drawn elements may draw themselves in once (stroke-dashoffset, 600ms)
  on empty states and the success step. They never loop. The only looping
  motion in the product is the blob mascot as a loader or on an idle screen
  (`AnimatedBlob`), one per screen. The preview-only marquee is a narrow
  exception: it may scroll continuously, with a visible Pause animation /
  Resume animation control whose pause persists after focus and hover leave.
  Reduced motion makes it a static, horizontally scrollable row and hides
  the animation control. This does not add a marquee to live customer Walls.
- Animate `transform` and `opacity` only. The global
  `prefers-reduced-motion` rule in `globals.css` stays and every animation
  must look correct when it fires (final state, no draw-in).

Review the curves and replay every entrance in the development `/kit` page,
Motion section.

## 9. Voice

Plain, warm, confident. Sentence case everywhere, including buttons. Use the
domain nouns from `CONTEXT.md` (Brand, Testimonial, Collection Form, Wall,
Submitter) exactly as defined. Say what happens next, not what the system did.
No "Elevate", "Seamless", "Unleash", "Next-gen", "Supercharge". Handwritten
notes may be playful; the rest of the interface stays clear.

## 10. Banned

- Emoji in the interface. Inter. Pure black `#000`. Neutral gray without warmth.
- Bricolage Grotesque and DM Sans, in any role, even as fallbacks: they are
  the direct competitor's pair (Senja). Before adopting any signature element
  (font, accent, illustration style), check it is not already a competitor's.
- Violet `#6d5dfc` as a default anywhere. White text on the amber accent.
- A second accent color. Gradients on text or backgrounds. Neon or outer glows.
- Shadows on resting cards. `shadow-xs` sprinkled on every surface.
- Three equal cards in a row. Centered card on an empty background as a page.
- Page titles under 24px. Literal font weights like 510 and 590.
- Native `select`, `checkbox`, `details/summary` styled inline instead of a
  primitive. Buttons that show loading by changing their label.
- Two icon libraries. `richColors` toasts. Decorative chrome that exists in one
  theme only.
- "Scroll to explore" prompts, bouncing chevrons, custom cursors.
- Placeholder names like "Acme" or "John Doe" in fixtures; use believable
  small-business names and people.

## 11. Implementation map

Token names above map to `src/app/globals.css`. Fonts load in
`src/app/layout.tsx`. Doodles live in `src/components/doodles/`. The official
logo and icon live in `public/brand/` (`logo.svg`, `logo-mark.svg`,
`logo-type.svg`, `icon.svg`, `blob.svg`, see `docs/design/app-icons/DESIGN.md`
10.1 and 10.2); `BrandLogo` renders the lockup (`logo-on-dark.svg` on dark
surfaces) in the auth, onboarding and public headers, `BrandMark` the mark
alone where only a tile fits. Per-Brand
accent contrast is computed next to `normalizePrimaryColor` in
`convex/organizations.ts` and shipped in the public projections.

Order of work, each step verified in `/screens` (sample and live) and with
`pnpm check`:

1. Tokens and fonts: neutrals, brand derivation, semantic statuses, radius and
   shadow scales, type scale as utilities, Gelica and Figtree loaded, Inter
   removed. Retire the dark-only chrome and the `.dashboard-frame` literal
   sizes.
2. Primitives: button (with loading), input, textarea, select, checkbox,
   switch, badge, tabs, table, popover, empty state, doodles, toast theme.
3. Shell: sidebar, header, page header pattern, auth split layout.
4. Screens in gallery order: authentication, onboarding and account, Brand
   workspace, dialogs and feedback, Collection Form, Public Wall, private
   links. Mark each screen OK in `/screens` when it matches this document on
   desktop and mobile, light and dark.
5. Embed: align its neutral palette and radius with the tokens, add
   `accentInk`, keep it font-neutral and doodle-free.
6. Visual evidence: refresh `visual-evidence.config.json` captures and the
   fixtures' sample data (names, companies, quotes) to the new voice.

App icons (App Store, dock, favicon, social avatars) follow their own spec in
`docs/design/app-icons/DESIGN.md`, built on the same tokens. The official icon
is the founder's own drawing, the upright blob on a paper tile
(`public/brand/icon.svg`, section 10.2 there), installed as the favicon, the
Apple touch icon and the in-app brand mark. The twenty generated candidates
are regenerated on demand by `scripts/app-icons/build.mjs` rather than kept
in the repository; the product ships the founder's own Figma exports in
`public/brand/`.

Open decisions, tracked here until settled: the final accent hue (amber is
provisional), a possible logo refresh once the palette is live (see the app
icon family), and whether the Wall offers a "quiet" variant without the
signature for very conservative customer Brands.
