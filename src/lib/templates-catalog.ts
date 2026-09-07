/**
 * Catalog of the layouts a Brand can pick for its proof. It feeds the public
 * gallery at `/templates`, the full-page preview at `/templates/<slug>` and
 * the development review page at `/kit/templates`.
 *
 * One entry per template. The React renderer lives in
 * `src/components/templates/<slug>.tsx` and is wired by slug in
 * `src/components/templates/template-registry.tsx`. A template starts as a
 * `draft` (visible in the kit only) and goes live on the public page once its
 * `status` is flipped to `public`.
 */

export const templateCategories = [
  {
    key: "walls",
    label: "Walls",
    description: "Every published Testimonial on one page.",
  },
  {
    key: "sliders",
    label: "Sliders",
    description: "Proof that moves, for one section of your site.",
  },
  {
    key: "spotlight",
    label: "Spotlight",
    description: "One or two Testimonials with room to breathe.",
  },
  {
    key: "compact",
    label: "Compact",
    description: "Small pieces of proof for headers, pricing and footers.",
  },
] as const;

export type TemplateCategory = (typeof templateCategories)[number]["key"];

export const templateCategoryKeys = templateCategories.map(
  (category) => category.key,
) as TemplateCategory[];

export function templateCategoryLabel(key: TemplateCategory): string {
  return (
    templateCategories.find((category) => category.key === key)?.label ?? key
  );
}

export type TemplateStatus = "draft" | "public";

export type TemplateDefinition = {
  /** URL and registry key: `/templates/<slug>`, `src/components/templates/<slug>.tsx`. */
  slug: string;
  name: string;
  category: TemplateCategory;
  /** One sentence under the name, plain voice. */
  description: string;
  /** `flow` fills the frame from the top left; `center` floats a small piece. */
  preview: "center" | "flow";
  /** Only `public` templates appear on `/templates`; drafts stay in the kit. */
  status: TemplateStatus;
  /** Component file, shown in the kit so the designer can open it. */
  file: string;
};

const file = (slug: string) => `src/components/templates/${slug}.tsx`;

export const templates: TemplateDefinition[] = [
  {
    slug: "masonry-wall",
    name: "Masonry wall",
    category: "walls",
    description:
      "The hosted Wall: text and video cards in one, two or three columns, in the order you curate.",
    preview: "flow",
    status: "public",
    file: file("masonry-wall"),
  },
  {
    slug: "grid-wall",
    name: "Grid wall",
    category: "walls",
    description:
      "Text Testimonials in equal columns, every card the same height.",
    preview: "flow",
    status: "public",
    file: file("grid-wall"),
  },
  {
    slug: "list-wall",
    name: "List wall",
    category: "walls",
    description:
      "One column of rows with hairline dividers: the person on the left, their words on the right.",
    preview: "flow",
    status: "public",
    file: file("list-wall"),
  },
  {
    slug: "quote-grid",
    name: "Quote grid",
    category: "walls",
    description:
      "No cards: quotes set straight on the page with a large quotation mark and a hairline between them.",
    preview: "flow",
    status: "public",
    file: file("quote-grid"),
  },
  {
    slug: "carousel",
    name: "Carousel",
    category: "sliders",
    description:
      "Three cards per view that visitors swipe or step through with the arrows.",
    preview: "flow",
    status: "public",
    file: file("carousel"),
  },
  {
    slug: "marquee",
    name: "Marquee",
    category: "sliders",
    description:
      "A row of short quotes that drifts sideways on its own and pauses under the pointer.",
    preview: "flow",
    status: "public",
    file: file("marquee"),
  },
  {
    slug: "hero-quote",
    name: "Hero quote",
    category: "spotlight",
    description:
      "One Testimonial set large in the display face, with the stars above and the person below.",
    preview: "flow",
    status: "public",
    file: file("hero-quote"),
  },
  {
    slug: "split-highlights",
    name: "Split highlights",
    category: "spotlight",
    description:
      "One featured Testimonial beside two shorter ones, in a golden split.",
    preview: "flow",
    status: "public",
    file: file("split-highlights"),
  },
  {
    slug: "single-video",
    name: "Single video",
    category: "spotlight",
    description:
      "One video Testimonial with its poster, play button and identity, nothing else.",
    preview: "flow",
    status: "public",
    file: file("single-video"),
  },
  {
    slug: "bubble-list",
    name: "Bubble list",
    category: "compact",
    description:
      "Short quotes in speech bubbles, like messages your customers sent you.",
    preview: "flow",
    status: "public",
    file: file("bubble-list"),
  },
  {
    slug: "rating-badge",
    name: "Rating badge",
    category: "compact",
    description:
      "Five stars, the average and the number of customers behind it.",
    preview: "center",
    status: "public",
    file: file("rating-badge"),
  },
  {
    slug: "avatar-stack",
    name: "Avatar stack",
    category: "compact",
    description:
      "Overlapping avatars, stars and one line of proof, for a hero or a footer.",
    preview: "center",
    status: "public",
    file: file("avatar-stack"),
  },
  {
    slug: "proof-strip",
    name: "Proof strip",
    category: "compact",
    description:
      "One line: stars, a short quote and a name, for the space under a button.",
    preview: "center",
    status: "draft",
    file: file("proof-strip"),
  },
];

export const publicTemplates: TemplateDefinition[] = templates.filter(
  (template) => template.status === "public",
);

export function templateBySlug(slug: string): TemplateDefinition | undefined {
  return templates.find((template) => template.slug === slug);
}

/** The wall themes a preview can render; "system" is left to the real Wall. */
export const wallThemes = ["light", "dark"] as const;

export type WallTheme = (typeof wallThemes)[number];

export function isWallTheme(value: unknown): value is WallTheme {
  return wallThemes.includes(value as WallTheme);
}

/**
 * Sample Brand accents for the previews. Each is a believable customer color;
 * the first is the fixtures' Fernhill Studio teal, the second the default a
 * new Brand gets at onboarding.
 */
export const accentPresets = [
  { label: "Fernhill teal", value: "#0f766e" },
  { label: "Proof amber", value: "#ffbb16" },
  { label: "Coral", value: "#d9483b" },
  { label: "Navy", value: "#274690" },
] as const;

export const defaultAccent: string = accentPresets[0].value;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}
