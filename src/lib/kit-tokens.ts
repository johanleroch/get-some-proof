/**
 * Static description of the design tokens for the development-only `/kit`
 * page. Values mirror `src/app/globals.css`; the page reads the live computed
 * values next to them so drift is visible.
 */

export type ColorToken = {
  dark: string;
  light: string;
  name: string;
  role: string;
  variable: string;
};

export type ColorGroup = {
  title: string;
  tokens: ColorToken[];
};

export const colorGroups: ColorGroup[] = [
  {
    title: "Neutrals",
    tokens: [
      {
        name: "Paper",
        variable: "--paper",
        role: "Page background",
        light: "oklch(0.985 0.005 85)",
        dark: "oklch(0.19 0.01 60)",
      },
      {
        name: "Surface",
        variable: "--surface",
        role: "Cards, inputs, popovers",
        light: "oklch(1 0 0)",
        dark: "oklch(0.23 0.01 60)",
      },
      {
        name: "Surface 2",
        variable: "--surface-2",
        role: "Muted fills, hover rows",
        light: "oklch(0.965 0.008 85)",
        dark: "oklch(0.27 0.01 60)",
      },
      {
        name: "Ink",
        variable: "--ink",
        role: "Primary text, icons",
        light: "oklch(0.25 0.012 60)",
        dark: "oklch(0.94 0.01 85)",
      },
      {
        name: "Ink 2",
        variable: "--ink-2",
        role: "Secondary text",
        light: "oklch(0.48 0.015 60)",
        dark: "oklch(0.72 0.012 80)",
      },
      {
        name: "Ink 3",
        variable: "--ink-3",
        role: "Placeholders, disabled",
        light: "oklch(0.65 0.012 60)",
        dark: "oklch(0.55 0.012 80)",
      },
      {
        name: "Line",
        variable: "--line",
        role: "Borders, dividers",
        light: "oklch(0.9 0.012 80)",
        dark: "oklch(1 0 0 / 10%)",
      },
      {
        name: "Line 2",
        variable: "--line-2",
        role: "Input and focused borders",
        light: "oklch(0.82 0.014 80)",
        dark: "oklch(1 0 0 / 18%)",
      },
    ],
  },
  {
    title: "Brand (derived from --brand)",
    tokens: [
      {
        name: "Brand",
        variable: "--brand",
        role: "Primary fills, stars, active marker",
        light: "oklch(0.82 0.17 82)",
        dark: "same",
      },
      {
        name: "Brand strong",
        variable: "--brand-strong",
        role: "Hover and pressed fills",
        light: "l - 0.08",
        dark: "same",
      },
      {
        name: "Brand soft",
        variable: "--brand-soft",
        role: "Tints, selected rows, active nav",
        light: "l 0.96, c 0.05",
        dark: "l 0.30, c 0.05",
      },
      {
        name: "Brand soft 2",
        variable: "--brand-soft-2",
        role: "Hover on tints, selection",
        light: "l 0.91, c 0.09",
        dark: "l 0.36, c 0.07",
      },
      {
        name: "Brand text",
        variable: "--brand-text",
        role: "Links and amber text on paper",
        light: "l 0.48, c 0.13",
        dark: "l 0.85, c 0.15",
      },
      {
        name: "Brand ink",
        variable: "--brand-ink",
        role: "Text on a brand fill, dark in both themes",
        light: "oklch(0.25 0.012 60)",
        dark: "same",
      },
      {
        name: "Brand ring",
        variable: "--brand-ring",
        role: "Focus rings",
        light: "l 0.7, c 0.15, 50%",
        dark: "same",
      },
    ],
  },
  {
    title: "Statuses",
    tokens: [
      {
        name: "Success",
        variable: "--success",
        role: "Published, verified, saved",
        light: "oklch(0.5 0.14 150)",
        dark: "oklch(0.75 0.14 150)",
      },
      {
        name: "Success soft",
        variable: "--success-soft",
        role: "Badge and toast tint",
        light: "l 0.95, c 0.04",
        dark: "l 0.30, c 0.05",
      },
      {
        name: "Warning",
        variable: "--warning",
        role: "Pending, processing, quota",
        light: "oklch(0.52 0.16 45)",
        dark: "oklch(0.78 0.15 50)",
      },
      {
        name: "Warning soft",
        variable: "--warning-soft",
        role: "Badge and toast tint",
        light: "l 0.95, c 0.05",
        dark: "l 0.30, c 0.06",
      },
      {
        name: "Danger",
        variable: "--danger",
        role: "Destructive actions, errors",
        light: "oklch(0.52 0.19 27)",
        dark: "oklch(0.72 0.17 25)",
      },
      {
        name: "Danger soft",
        variable: "--danger-soft",
        role: "Badge and toast tint",
        light: "l 0.95, c 0.04",
        dark: "l 0.30, c 0.06",
      },
      {
        name: "Info",
        variable: "--info",
        role: "Neutral notices",
        light: "oklch(0.52 0.09 250)",
        dark: "oklch(0.75 0.09 250)",
      },
      {
        name: "Info soft",
        variable: "--info-soft",
        role: "Badge and toast tint",
        light: "l 0.95, c 0.03",
        dark: "l 0.30, c 0.04",
      },
    ],
  },
];

export type ContrastPair = {
  background: string;
  foreground: string;
  label: string;
  large?: boolean;
};

export const contrastPairs: ContrastPair[] = [
  { label: "Ink on paper", foreground: "--ink", background: "--paper" },
  { label: "Ink 2 on paper", foreground: "--ink-2", background: "--paper" },
  { label: "Ink 2 on surface", foreground: "--ink-2", background: "--surface" },
  {
    label: "Brand text on paper",
    foreground: "--brand-text",
    background: "--paper",
  },
  {
    label: "Brand ink on brand",
    foreground: "--brand-ink",
    background: "--brand",
  },
  {
    label: "Ink on brand soft",
    foreground: "--ink",
    background: "--brand-soft",
  },
  {
    label: "Success on soft",
    foreground: "--success",
    background: "--success-soft",
  },
  {
    label: "Warning on soft",
    foreground: "--warning",
    background: "--warning-soft",
  },
  {
    label: "Danger on soft",
    foreground: "--danger",
    background: "--danger-soft",
  },
  { label: "Danger on paper", foreground: "--danger", background: "--paper" },
];

export type TypeFamily = "display" | "hand" | "sans";

export type TypeStyle = {
  family: TypeFamily;
  label: string;
  leading: number;
  name: string;
  sample: string;
  size: number;
  tracking: number;
  use: string;
  weight: number;
};

/** Sizes and leadings in rem, tracking in em. Must match globals.css. */
export const typeStyles: TypeStyle[] = [
  {
    name: "display-xl",
    label: "Display XL",
    family: "display",
    size: 2.5,
    leading: 2.75,
    weight: 700,
    tracking: -0.02,
    use: "Public Wall and Collection Form titles",
    sample: "Share your Fernhill Studio story",
  },
  {
    name: "display",
    label: "Display",
    family: "display",
    size: 2,
    leading: 2.25,
    weight: 700,
    tracking: -0.015,
    use: "Dashboard page titles",
    sample: "Testimonial inbox",
  },
  {
    name: "heading",
    label: "Heading",
    family: "display",
    size: 1.5,
    leading: 1.875,
    weight: 600,
    tracking: -0.01,
    use: "Section and dialog titles",
    sample: "Welcome back",
  },
  {
    name: "subheading",
    label: "Subheading",
    family: "display",
    size: 1.125,
    leading: 1.625,
    weight: 600,
    tracking: -0.005,
    use: "Card and empty-state titles",
    sample: "Pending Testimonials",
  },
  {
    name: "body",
    label: "Body",
    family: "sans",
    size: 0.9375,
    leading: 1.5,
    weight: 400,
    tracking: -0.011,
    use: "Paragraphs, testimonial quotes",
    sample: "Sign in to continue to your proof dashboard.",
  },
  {
    name: "quote",
    label: "Quote",
    family: "sans",
    size: 1.0625,
    leading: 1.625,
    weight: 400,
    tracking: -0.011,
    use: "The words on a Testimonial card",
    sample:
      "Fernhill turned a folder of kind emails into proof we can actually show.",
  },
  {
    name: "ui",
    label: "UI",
    family: "sans",
    size: 0.875,
    leading: 1.25,
    weight: 500,
    tracking: -0.008,
    use: "Buttons, inputs, navigation, tables",
    sample: "Copy collection link",
  },
  {
    name: "small",
    label: "Small",
    family: "sans",
    size: 0.8125,
    leading: 1.125,
    weight: 400,
    tracking: -0.004,
    use: "Metadata, helper text",
    sample: "Edited 5 minutes ago · Founder, Northwind Bakery",
  },
  {
    name: "micro",
    label: "Micro",
    family: "sans",
    size: 0.75,
    leading: 1,
    weight: 600,
    tracking: 0.06,
    use: "Eyebrows and group labels, uppercase",
    sample: "Workspace",
  },
  {
    name: "kpi",
    label: "KPI",
    family: "display",
    size: 2.5,
    leading: 2.75,
    weight: 700,
    tracking: -0.02,
    use: "Counts on the dashboard, tabular numbers",
    sample: "1,284",
  },
  {
    name: "hand",
    label: "Hand",
    family: "hand",
    size: 1.25,
    leading: 1.5,
    weight: 500,
    tracking: 0,
    use: "Hand-drawn annotations only",
    sample: "this is what your customers see",
  },
];

export const fontFamilies = [
  {
    name: "Figtree",
    variable: "--font-figtree",
    role: "Body and UI",
    axes: "wght 300 to 900, italics",
    weights: [400, 500, 600, 700],
  },
  {
    name: "Gelica",
    variable: "--font-gelica",
    role: "Display: titles, KPI numbers (licensed, self-hosted)",
    axes: "static 200 to 700 and 900, italics",
    weights: [500, 600, 700, 900],
  },
  {
    name: "Caveat",
    variable: "--font-caveat",
    role: "Hand-drawn annotations only",
    axes: "wght 400 to 700",
    weights: [500, 600],
  },
  {
    name: "Geist Mono",
    variable: "--font-geist-mono",
    role: "Slugs, snippets, timestamps",
    axes: "wght 100 to 900",
    weights: [400, 500],
  },
] as const;

export const radiusScale = [
  { name: "sm", value: "6px", use: "Badges inside buttons, checkboxes" },
  { name: "md", value: "8px", use: "Buttons, inputs, menu items" },
  { name: "lg", value: "12px", use: "Cards, dialogs, testimonial cards" },
  { name: "xl", value: "16px", use: "Hero panels, Collection Form card" },
  { name: "2xl", value: "20px", use: "Logo tiles" },
  { name: "full", value: "9999px", use: "Pills, avatars, status dots" },
] as const;

export const spacingScale = [4, 8, 12, 16, 24, 32, 48] as const;

export const brandDefaults = { chroma: 0.17, hue: 82, lightness: 0.82 };

export function formatBrand({ chroma, hue, lightness }: typeof brandDefaults) {
  return `oklch(${lightness} ${chroma} ${hue})`;
}
