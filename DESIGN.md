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
  Bold, Black as OTF). Gelica is a licensed font from the founder's Monotype
  Fonts subscription, and this repository is public, so the folder is in
  `.gitignore`. `scripts/ensure-display-font.mjs` runs before dev, build and
  typecheck and generates the module that loads the font: with the five files
  in place the site gets Gelica, without them (CI, a fresh clone) every
  display style falls back to Figtree and the script prints a warning, so a
  build never breaks on the license. Confirm web use with the Monotype license before launch.
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
| body       | 15px | 24px | 400    | -0.011em | Figtree | Paragraphs, testimonial quotes         |
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

- Dashboard: sidebar 260px on `--paper`, content on `--paper` with white
  panels only where grouping helps. Page header is left-aligned: eyebrow
  (micro), `display` title, one primary action on the right. Data lives in
  lists and tables with `--surface-2` row hover, not in stacks of cards.
  Three-equal-cards rows are banned; use a 2:1 or 1:2 split.
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
  customers see". Single column on mobile, preview after the form.
- Collection Form (public): split from 1024px. Brand panel on the left
  (logo, title in `display-xl`, one sentence, the step list) tinted with the
  customer accent at 8%; form steps on the right at max 520px. Progress is a
  segmented bar of four pills, not a percentage line. Below 1024px it becomes
  one column with a compact brand header. Touch targets stay at 44px.
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
  Brand accent swatches plus a custom picker, and the wall theme. One arrow
  note ("this is what your visitors see") is the region's hand-drawn
  element and the only caption. The stage is a CSS container on the wall
  theme with the sample accent (never our amber inside the frame), so a
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
  white text. Every async button has a `loading` state with an inline spinner
  and a stable width; swapping the label to "Saving..." is retired.
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
  (`testimonial-card-markup.ts`). `--radius-lg`, `--line` border, no shadow.
  Avatar 44px round, name at `ui` weight 600, role and company at `small` in
  `--ink-2`, stars at 16px in the Brand accent with unfilled stars at 25%,
  quote at `body` in `--ink`. Video cards keep the source ratio, the play
  button is 48px round on `--surface` with `--shadow-float`.
- Badges and status tags: 24px tall, `--radius-md`, `small` at weight 500,
  on `--surface` with a `--line` hairline. A status colors its 6px dot and
  its label (full-strength status color, AA on `--surface`); the fill stays
  paper, never a pastel tint (the generic "AI pill"). `brand`
  is the one tinted tag (`--brand-soft`), `neutral` sits on `--surface-2`.
- Dialogs: `--surface`, `--radius-lg`, `--shadow-float`, title at `heading`,
  max 480px (560px for content-heavy). Destructive confirmations keep no close
  icon and require the typed name where they do today.
- Toasts: the mascot tells them. `blobToast.success|info|warning|error|
loading` (`src/components/brand/blob-toast.tsx`, same call shape as
  sonner, rendered through `toast.custom`) shows the blob at 48px on the
  left, appearing neutral and blinking into the message's mood (happy,
  neutral, worried, sad; the loader for loading), and the message in a
  speech bubble: `--surface`, `--line` border, `--radius-lg`,
  `--shadow-float`, a small tail towards the blob, title at `ui` 600,
  description at `small` in `--ink-2`, one optional text action in
  `--brand-text`, a dismiss cross. Toasts appear top right, 20px from the edges (16px on mobile). Sonner
  stays the engine (stacking, timing, swipe to dismiss); `richColors` and
  its icons are retired. The designer menu (⌘.) has a "Test toast" entry to
  check placement on any screen.
- Skeletons: keep the shimmer, on `--surface-2`, shaped like the final layout.
- Loaders: the blob looking around (`BlobLoader`, `look` behaviour, 64px,
  72px full screen) for every indeterminate wait without a skeleton: route
  transitions through the root `loading.tsx`, a form submitting, a video
  processing. Never a spinner, except the inline one inside a loading
  button.
- Icons: **Tabler** only, 20px in navigation and buttons, 16px inline, stroke
  1.75. Lucide is removed once the last usages are migrated.

## 8. Motion

- Durations: 150ms for color and opacity, 200ms for transforms, 250ms for
  layout reveals. Easing `cubic-bezier(0.2, 0, 0, 1)` for CSS. Entrances that
  use `motion/react` use a light spring, `stiffness 260, damping 28`, which
  settles fast and never overshoots visibly.
- Lists and grids mount with a 30ms stagger, 12px upward travel, opacity from 0. Maximum 12 items staggered; the rest appear instantly.
- Buttons press down 1px on active; cards and rows do not lift on hover, they
  tint. Toasts slide 8px from the top-right. Dialogs fade and scale from 0.98.
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
Apple touch icon and the in-app brand mark. The twenty generated candidates in
`public/brand/icons/` are the exploration that led to it and stay as a bank of
alternates for stickers, seasonal tiles and social posts.

Open decisions, tracked here until settled: the final accent hue (amber is
provisional), a possible logo refresh once the palette is live (see the app
icon family), and whether the Wall offers a "quiet" variant without the
signature for very conservative customer Brands.
