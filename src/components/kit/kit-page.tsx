"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconCheck,
  IconCopy,
  IconLayoutGrid,
  IconRefresh,
  IconStar,
  IconTemplate,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand-logo";
import { BrandMark } from "@/components/brand-mark";
import { PageHeader } from "@/components/page-header";
import {
  ArrowNote,
  CameraTripod,
  CircleAround,
  EnvelopeStamp,
  Sparkle,
  SpeechBubbleStars,
  WallFrames,
  MarkerHighlight,
} from "@/components/doodles";
import { TestimonialCard } from "@/components/testimonials/testimonial-card";
import type { TestimonialCardValue } from "@/components/testimonials/testimonial-card-markup";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  brandDefaults,
  colorGroups,
  contrastPairs,
  fontFamilies,
  formatBrand,
  radiusScale,
  spacingScale,
  typeStyles,
  type TypeStyle,
} from "@/lib/kit-tokens";
import { themeChangeEvent } from "@/lib/theme";
import { cn } from "@/lib/utils";

const sections = [
  { id: "colors", title: "Colors" },
  { id: "brand", title: "Brand tuner" },
  { id: "typography", title: "Typography" },
  { id: "fonts", title: "Fonts" },
  { id: "shape", title: "Shape and depth" },
  { id: "spacing", title: "Spacing" },
  { id: "doodles", title: "Doodles" },
  { id: "buttons", title: "Buttons" },
  { id: "forms", title: "Forms" },
  { id: "shell", title: "Page header" },
  { id: "cards", title: "Cards and lists" },
  { id: "status", title: "Status and badges" },
  { id: "empty", title: "Empty states" },
  { id: "overlays", title: "Overlays" },
  { id: "feedback", title: "Feedback" },
  { id: "product", title: "Product pieces" },
];

type TypeValues = Record<
  string,
  { leading: number; tracking: number; weight: number }
>;

type Rgb = [number, number, number];

const fontStacks = {
  display: "var(--font-gelica), var(--font-figtree), system-ui, sans-serif",
  hand: "var(--font-caveat), cursive",
  sans: "var(--font-figtree), system-ui, sans-serif",
} as const;

const sampleTestimonial: TestimonialCardValue = {
  avatarUrl: null,
  company: "Northwind Bakery",
  id: "kit-testimonial",
  name: "Alice Martin",
  publishedAt: Date.UTC(2026, 8, 3),
  rating: 5,
  role: "Founder",
  text: "We collected twelve testimonials in a week. The form is so calm that customers actually finish it, and the wall looks like ours.",
  type: "text",
};

function initialTypeValues(): TypeValues {
  return Object.fromEntries(
    typeStyles.map((style) => [
      style.name,
      {
        leading: style.leading,
        tracking: style.tracking,
        weight: style.weight,
      },
    ]),
  );
}

function toRgb(color: string): Rgb | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#000000";
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return [r ?? 0, g ?? 0, b ?? 0];
  } catch {
    return null;
  }
}

function luminance([r, g, b]: Rgb) {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(foreground: Rgb, background: Rgb) {
  const a = luminance(foreground);
  const b = luminance(background);
  const [high, low] = a > b ? [a, b] : [b, a];
  return (high + 0.05) / (low + 0.05);
}

function measureContrast(): Record<string, number> {
  const swatches = document.querySelectorAll<HTMLElement>("[data-kit-color]");
  const colors = new Map<string, Rgb>();
  swatches.forEach((swatch) => {
    const variable = swatch.dataset.kitColor;
    if (!variable) return;
    const rgb = toRgb(getComputedStyle(swatch).backgroundColor);
    if (rgb) colors.set(variable, rgb);
  });
  const result: Record<string, number> = {};
  for (const pair of contrastPairs) {
    const foreground = colors.get(pair.foreground);
    const background = colors.get(pair.background);
    if (foreground && background) {
      result[pair.label] = contrastRatio(foreground, background);
    }
  }
  return result;
}

export function KitPage() {
  const [typeValues, setTypeValues] = useState<TypeValues>(initialTypeValues);
  const [brand, setBrand] = useState(brandDefaults);
  const [contrast, setContrast] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);

  const scheduleMeasure = useCallback(() => {
    // A timer, not requestAnimationFrame: hidden tabs never paint a frame.
    const timer = window.setTimeout(() => setContrast(measureContrast()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const cancel = scheduleMeasure();
    const onTheme = () => scheduleMeasure();
    window.addEventListener(themeChangeEvent, onTheme);
    window.addEventListener("storage", onTheme);
    return () => {
      cancel();
      window.removeEventListener(themeChangeEvent, onTheme);
      window.removeEventListener("storage", onTheme);
    };
  }, [scheduleMeasure]);

  const updateType = useCallback(
    (name: string, key: "leading" | "tracking" | "weight", value: number) => {
      setTypeValues((current) => ({
        ...current,
        [name]: { ...current[name]!, [key]: value },
      }));
      const unit = key === "leading" ? "rem" : key === "tracking" ? "em" : "";
      document.documentElement.style.setProperty(
        `--type-${name}-${key}`,
        `${value}${unit}`,
      );
    },
    [],
  );

  const updateBrand = useCallback(
    (next: typeof brandDefaults) => {
      setBrand(next);
      document.documentElement.style.setProperty("--brand", formatBrand(next));
      scheduleMeasure();
    },
    [scheduleMeasure],
  );

  const resetAll = useCallback(() => {
    for (const style of typeStyles) {
      for (const key of ["leading", "tracking", "weight"]) {
        document.documentElement.style.removeProperty(
          `--type-${style.name}-${key}`,
        );
      }
    }
    document.documentElement.style.removeProperty("--brand");
    setTypeValues(initialTypeValues());
    setBrand(brandDefaults);
    scheduleMeasure();
  }, [scheduleMeasure]);

  const cssSnippet = useMemo(() => {
    const lines = [`  --brand: ${formatBrand(brand)};`];
    for (const style of typeStyles) {
      const values = typeValues[style.name]!;
      lines.push(
        `  --type-${style.name}-size: ${style.size}rem;`,
        `  --type-${style.name}-leading: ${values.leading}rem;`,
        `  --type-${style.name}-weight: ${values.weight};`,
        `  --type-${style.name}-tracking: ${values.tracking}em;`,
      );
    }
    return `:root {\n${lines.join("\n")}\n}`;
  }, [brand, typeValues]);

  async function copyCss() {
    try {
      await navigator.clipboard.writeText(cssSnippet);
      setCopied(true);
      toast.success("Token values copied as CSS.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy. Select the snippet at the bottom instead.");
    }
  }

  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="type-subheading">Kit</h1>
            <p className="text-muted-foreground type-small">
              Tokens, type and components as they render today. Development
              only.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <a href="/kit/templates">
              <IconTemplate aria-hidden="true" />
              Templates
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href="/screens">
              <IconLayoutGrid aria-hidden="true" />
              Screens
            </a>
          </Button>
          <Button onClick={resetAll} size="sm" variant="outline">
            <IconRefresh aria-hidden="true" />
            Reset tuning
          </Button>
          <Button onClick={copyCss} size="sm">
            {copied ? (
              <IconCheck aria-hidden="true" />
            ) : (
              <IconCopy aria-hidden="true" />
            )}
            Copy CSS
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-10 px-6 py-8">
        <nav
          aria-label="Kit sections"
          className="sticky top-[81px] hidden w-44 shrink-0 self-start lg:block"
        >
          <ul className="space-y-0.5">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  className="text-muted-foreground hover:text-foreground hover:bg-accent type-ui block rounded-md px-2 py-1 transition-colors"
                  href={`#${section.id}`}
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1 space-y-16">
          <KitSection
            description="Every color in the interface comes from these tokens. Swatches show the live value in the current theme."
            id="colors"
            title="Colors"
          >
            {colorGroups.map((group) => (
              <div className="space-y-3" key={group.title}>
                <h3 className="type-micro text-muted-foreground">
                  {group.title}
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {group.tokens.map((token) => (
                    <div
                      className="bg-card overflow-hidden rounded-lg border"
                      key={token.variable}
                    >
                      <div
                        className="h-16 border-b"
                        data-kit-color={token.variable}
                        style={{ background: `var(${token.variable})` }}
                      />
                      <div className="space-y-1 p-3">
                        <p className="type-ui">{token.name}</p>
                        <p className="text-muted-foreground type-small">
                          {token.role}
                        </p>
                        <p className="text-muted-foreground truncate font-mono text-[11px]">
                          {token.variable}
                        </p>
                        <p className="text-muted-foreground truncate font-mono text-[11px]">
                          {token.light} · {token.dark}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="space-y-3">
              <h3 className="type-micro text-muted-foreground">
                Contrast (WCAG 2.2)
              </h3>
              <div className="bg-card overflow-x-auto rounded-lg border">
                <table className="w-full text-left">
                  <thead className="text-muted-foreground type-small border-b">
                    <tr>
                      <th className="px-3 py-2 font-medium">Pair</th>
                      <th className="px-3 py-2 font-medium">Sample</th>
                      <th className="px-3 py-2 font-medium">Ratio</th>
                      <th className="px-3 py-2 font-medium">Level</th>
                    </tr>
                  </thead>
                  <tbody className="type-ui">
                    {contrastPairs.map((pair) => {
                      const ratio = contrast[pair.label];
                      const level =
                        ratio === undefined
                          ? "…"
                          : ratio >= 7
                            ? "AAA"
                            : ratio >= 4.5
                              ? "AA"
                              : ratio >= 3
                                ? "AA large only"
                                : "Fail";
                      return (
                        <tr className="border-b last:border-0" key={pair.label}>
                          <td className="px-3 py-2">{pair.label}</td>
                          <td className="px-3 py-2">
                            <span
                              className="inline-block rounded-md px-2 py-0.5"
                              style={{
                                background: `var(${pair.background})`,
                                color: `var(${pair.foreground})`,
                              }}
                            >
                              Proof
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {ratio === undefined
                              ? "…"
                              : `${ratio.toFixed(2)}:1`}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 font-semibold",
                              level === "Fail" && "text-danger",
                              level === "AA large only" && "text-warning",
                            )}
                          >
                            {level}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </KitSection>

          <KitSection
            description="The accent is provisional. Move the sliders to preview another hue: every derived token, button and link follows. Copy CSS to freeze a value."
            id="brand"
            title="Brand tuner"
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="bg-card space-y-4 rounded-lg border p-4">
                <RangeControl
                  label="Hue"
                  max={360}
                  min={0}
                  onChange={(hue) => updateBrand({ ...brand, hue })}
                  step={1}
                  unit="°"
                  value={brand.hue}
                />
                <RangeControl
                  label="Chroma"
                  max={0.25}
                  min={0}
                  onChange={(chroma) => updateBrand({ ...brand, chroma })}
                  step={0.005}
                  value={brand.chroma}
                />
                <RangeControl
                  label="Lightness"
                  max={0.95}
                  min={0.5}
                  onChange={(lightness) => updateBrand({ ...brand, lightness })}
                  step={0.01}
                  value={brand.lightness}
                />
                <p className="font-mono text-xs">
                  --brand: {formatBrand(brand)}
                </p>
              </div>
              <div className="bg-card space-y-4 rounded-lg border p-4">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    "--brand",
                    "--brand-strong",
                    "--brand-soft",
                    "--brand-soft-2",
                    "--brand-text",
                    "--brand-ring",
                  ].map((variable) => (
                    <div className="space-y-1" key={variable}>
                      <div
                        className="h-10 rounded-md border"
                        style={{ background: `var(${variable})` }}
                      />
                      <p className="text-muted-foreground truncate font-mono text-[10px]">
                        {variable}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button>Primary action</Button>
                  <Button variant="outline">Secondary</Button>
                  <a
                    className="text-brand-text type-ui underline-offset-4 hover:underline"
                    href="#brand"
                  >
                    A text link
                  </a>
                  <span className="text-brand inline-flex gap-0.5">
                    {Array.from({ length: 5 }, (_, index) => (
                      <IconStar
                        aria-hidden="true"
                        className="size-4 fill-current"
                        key={index}
                      />
                    ))}
                  </span>
                </div>
              </div>
            </div>
          </KitSection>

          <KitSection
            description="Each style has four parameters: size, line height, weight, and letter spacing. Slide to tune, read the values, copy CSS."
            id="typography"
            title="Typography"
          >
            <div className="space-y-4">
              {typeStyles.map((style) => (
                <TypeRow
                  key={style.name}
                  onChange={(key, value) => updateType(style.name, key, value)}
                  style={style}
                  values={typeValues[style.name]!}
                />
              ))}
            </div>
          </KitSection>

          <KitSection
            description="Four families, all self-hosted through next/font. Gelica is licensed and lives outside git (DESIGN.md section 3). Inter is gone."
            id="fonts"
            title="Fonts"
          >
            <div className="grid gap-4 md:grid-cols-2">
              {fontFamilies.map((font) => (
                <div
                  className="bg-card space-y-3 rounded-lg border p-4"
                  key={font.name}
                >
                  <div>
                    <p className="type-subheading">{font.name}</p>
                    <p className="text-muted-foreground type-small">
                      {font.role} · {font.axes}
                    </p>
                    <p className="text-muted-foreground font-mono text-[11px]">
                      {font.variable}
                    </p>
                  </div>
                  <div className="space-y-1">
                    {font.weights.map((weight) => (
                      <p
                        className="truncate text-xl leading-7"
                        key={weight}
                        style={{
                          fontFamily: `var(${font.variable})`,
                          fontWeight: weight,
                        }}
                      >
                        <span className="text-muted-foreground mr-3 font-mono text-xs">
                          {weight}
                        </span>
                        Sphinx of black quartz, judge my vow 0123456789
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </KitSection>

          <KitSection
            description="Depth comes from borders and tone. Only floating layers cast the one warm shadow."
            id="shape"
            title="Shape and depth"
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {radiusScale.map((radius) => (
                <div className="space-y-2" key={radius.name}>
                  <div
                    className="bg-brand-soft border-brand h-16 border-2"
                    style={{ borderRadius: radius.value }}
                  />
                  <p className="type-ui">
                    {radius.name} · {radius.value}
                  </p>
                  <p className="text-muted-foreground type-small">
                    {radius.use}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="bg-card rounded-lg border p-4">
                <p className="type-ui">Resting card</p>
                <p className="text-muted-foreground type-small">
                  1px line, no shadow
                </p>
              </div>
              <div className="bg-card border-line-2 rounded-lg border p-4">
                <p className="type-ui">Strong border</p>
                <p className="text-muted-foreground type-small">
                  --line-2, inputs and focused cards
                </p>
              </div>
              <div className="bg-popover shadow-float rounded-lg border p-4">
                <p className="type-ui">Floating layer</p>
                <p className="text-muted-foreground type-small">
                  --shadow-float, popovers and dialogs
                </p>
              </div>
            </div>
          </KitSection>

          <KitSection
            description="A 4px grid. Inside components 8, 12, 16. Between elements 16, 24. Between sections 32, 48."
            id="spacing"
            title="Spacing"
          >
            <div className="space-y-2">
              {spacingScale.map((step) => (
                <div className="flex items-center gap-3" key={step}>
                  <span className="text-muted-foreground w-8 font-mono text-xs">
                    {step}
                  </span>
                  <div
                    className="bg-brand h-3 rounded-sm"
                    style={{ width: step * 4 }}
                  />
                </div>
              ))}
            </div>
          </KitSection>

          <KitSection
            description="The hand-drawn signature: one element per screen region, ink by default, the star may be amber. Decorative only, never an emoji."
            id="doodles"
            title="Doodles"
          >
            <DoodleShowcase />
          </KitSection>

          <KitSection
            description="40px tall, weight 600, --radius-md, a 1px press, and a loading state that keeps the label width."
            id="buttons"
            title="Buttons"
          >
            <div className="flex flex-wrap items-center gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button variant="destructive">Destructive</Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="xs">Extra small</Button>
              <Button size="sm">Small</Button>
              <Button>Default</Button>
              <Button size="lg">Large</Button>
              <Button aria-label="Icon button" size="icon" variant="outline">
                <IconStar aria-hidden="true" />
              </Button>
              <Button>
                <IconStar aria-hidden="true" />
                With icon
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button loading>Save settings</Button>
              <Button loading variant="outline">
                Publishing
              </Button>
              <Button loading size="lg">
                Submit your proof
              </Button>
            </div>
          </KitSection>

          <KitSection
            description="Label above, helper below, error below in danger. Fields are 40px tall; native selects and checkboxes are retired."
            id="forms"
            title="Forms"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <Field>
                <Label htmlFor="kit-input">Brand name</Label>
                <Input id="kit-input" placeholder="Northwind Bakery" />
                <FieldDescription>
                  Shown on your Collection Form and Wall.
                </FieldDescription>
              </Field>
              <Field>
                <Label htmlFor="kit-input-filled">Public slug</Label>
                <Input defaultValue="northwind-bakery" id="kit-input-filled" />
              </Field>
              <Field>
                <Label htmlFor="kit-input-error">Email</Label>
                <Input
                  aria-invalid
                  defaultValue="alice@"
                  id="kit-input-error"
                />
                <FieldError>Enter a full email address.</FieldError>
              </Field>
              <Field>
                <Label htmlFor="kit-input-disabled">Plan</Label>
                <Input disabled id="kit-input-disabled" readOnly value="Free" />
              </Field>
              <Field>
                <Label htmlFor="kit-select">Wall theme</Label>
                <Select defaultValue="system">
                  <SelectTrigger className="w-full" id="kit-select">
                    <SelectValue placeholder="Choose a theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">Match the visitor</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Applies to the hosted Wall only.
                </FieldDescription>
              </Field>
              <div className="space-y-4">
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <Checkbox defaultChecked id="kit-checkbox" />
                  <span className="type-ui">Show the star rating</span>
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <Switch defaultChecked id="kit-switch" />
                  <span className="type-ui">Collection open</span>
                </label>
              </div>
              <Field className="md:col-span-2">
                <Label htmlFor="kit-textarea">
                  Collection Form description
                </Label>
                <Textarea
                  id="kit-textarea"
                  placeholder="Tell us what changed for you."
                />
              </Field>
            </div>
          </KitSection>

          <KitSection
            description="Every dashboard page opens with this: an eyebrow, a display title, one sentence, and at most one primary action."
            id="shell"
            title="Page header"
          >
            <div className="bg-card rounded-lg border p-6">
              <PageHeader
                actions={<Button>Copy collection link</Button>}
                description="Collect customer proof, review it privately, and publish only what you choose."
                eyebrow="Workspace"
                title="Northwind Bakery"
              />
            </div>
          </KitSection>

          <KitSection
            description="Cards only where grouping earns it; rows with dividers otherwise."
            id="cards"
            title="Cards and lists"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Testimonials</CardTitle>
                  <CardDescription>
                    Ready for your first Submission.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="type-kpi">12</p>
                </CardContent>
                <CardFooter>
                  <Button size="sm" variant="outline">
                    Open inbox
                  </Button>
                </CardFooter>
              </Card>
              <div className="bg-card rounded-lg border">
                {["Alice Martin", "Jordan Lee", "Morgan Reed"].map(
                  (name, index) => (
                    <div
                      className="hover:bg-accent flex items-center gap-3 border-b px-4 py-3 transition-colors last:border-0"
                      key={name}
                    >
                      <Avatar>
                        <AvatarFallback>
                          {name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="type-ui truncate">{name}</p>
                        <p className="text-muted-foreground type-small truncate">
                          {index === 0
                            ? "Founder · Northwind Bakery"
                            : "Customer"}
                        </p>
                      </div>
                      <Badge
                        dot
                        variant={
                          index === 0
                            ? "success"
                            : index === 1
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {index === 0
                          ? "Published"
                          : index === 1
                            ? "Pending"
                            : "Draft"}
                      </Badge>
                    </div>
                  ),
                )}
              </div>
            </div>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="published">Published</TabsTrigger>
              </TabsList>
              <TabsContent value="all">
                <div className="bg-card rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Author</TableHead>
                        <TableHead>Format</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        ["Alice Martin", "Text", "Published", "3 Sep"],
                        ["Jordan Lee", "Video", "Pending", "2 Sep"],
                        ["Morgan Reed", "Text", "Draft", "1 Sep"],
                      ].map(([author, format, status, received]) => (
                        <TableRow key={author}>
                          <TableCell className="font-medium">
                            {author}
                          </TableCell>
                          <TableCell>{format}</TableCell>
                          <TableCell>
                            <Badge
                              dot
                              variant={
                                status === "Published"
                                  ? "success"
                                  : status === "Pending"
                                    ? "warning"
                                    : "neutral"
                              }
                            >
                              {status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-ink-2 text-right font-mono text-xs">
                            {received}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              <TabsContent value="pending">
                <p className="text-ink-2 type-body">One pending testimonial.</p>
              </TabsContent>
              <TabsContent value="published">
                <p className="text-ink-2 type-body">
                  One published testimonial.
                </p>
              </TabsContent>
            </Tabs>
          </KitSection>

          <KitSection
            description="Tags on paper with a hairline. The status colors the dot and the label; the fill stays paper."
            id="status"
            title="Status and badges"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge dot variant="success">
                Published
              </Badge>
              <Badge dot variant="warning">
                Pending
              </Badge>
              <Badge dot variant="danger">
                Failed
              </Badge>
              <Badge dot variant="info">
                Processing
              </Badge>
              <Badge variant="brand">Pro</Badge>
              <Badge variant="neutral">Draft</Badge>
              <Badge variant="outline">12 proofs</Badge>
            </div>
          </KitSection>

          <KitSection
            description="One illustration, a title, one sentence, one action. The dashed box with a lone sentence is retired."
            id="empty"
            title="Empty states"
          >
            <div className="bg-card rounded-lg border">
              <EmptyState
                action={<Button>Copy collection link</Button>}
                description="Share your Collection Form and the first proof lands here, ready to review."
                illustration={<SpeechBubbleStars className="h-32" draw />}
                title="No Testimonials yet"
              />
            </div>
          </KitSection>

          <KitSection
            description="Dialogs, confirmations, menus, sheets and tooltips sit on --surface with --shadow-float."
            id="overlays"
            title="Overlays"
          >
            <div className="flex flex-wrap items-center gap-3">
              <DialogDemo />
              <AlertDialogDemo />
              <SheetDemo />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Dropdown menu</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Testimonial</DropdownMenuLabel>
                  <DropdownMenuItem>Publish</DropdownMenuItem>
                  <DropdownMenuItem>Unpublish</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive">
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost">Hover for a tooltip</Button>
                </TooltipTrigger>
                <TooltipContent>Copied to clipboard</TooltipContent>
              </Tooltip>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">Popover</Button>
                </PopoverTrigger>
                <PopoverContent align="start">
                  <p className="type-subheading">Embed on your site</p>
                  <p className="text-ink-2 type-small mt-1">
                    Paste one script tag. The Wall inherits your font.
                  </p>
                </PopoverContent>
              </Popover>
            </div>
          </KitSection>

          <KitSection
            description="Toasts, skeletons and separators."
            id="feedback"
            title="Feedback"
          >
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => toast.success("Testimonial published.")}
                variant="outline"
              >
                Success toast
              </Button>
              <Button
                onClick={() =>
                  toast.error("Upload failed. Try a smaller file.")
                }
                variant="outline"
              >
                Error toast
              </Button>
              <Button
                onClick={() => toast.info("Your wall updates within a minute.")}
                variant="outline"
              >
                Info toast
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-24 w-full" />
              </div>
              <div className="space-y-3">
                <p className="type-ui">Above the separator</p>
                <Separator />
                <p className="type-ui">Below the separator</p>
              </div>
            </div>
          </KitSection>

          <KitSection
            description="The product pieces every screen reuses: the official logo, its mark, and the testimonial card shared by the Wall, the Inbox and the embed."
            id="product"
            title="Product pieces"
          >
            <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
              <div className="space-y-3 self-start">
                <div className="bg-card flex items-center gap-4 rounded-lg border p-4">
                  <BrandLogo />
                  <div>
                    <p className="type-ui">Logo</p>
                    <p className="text-muted-foreground type-small">
                      public/brand/logo.svg, paper wordmark on dark
                    </p>
                  </div>
                </div>
                <div className="bg-card flex items-center gap-4 rounded-lg border p-4">
                  <BrandMark />
                  <div>
                    <p className="type-ui">Brand mark</p>
                    <p className="text-muted-foreground type-small">
                      public/brand/logo-mark.svg, for tight spots
                    </p>
                  </div>
                </div>
              </div>
              <div className="max-w-sm">
                <TestimonialCard
                  accentColor="var(--brand)"
                  testimonial={sampleTestimonial}
                />
              </div>
            </div>
          </KitSection>

          <KitSection
            description="Current tuning as CSS. Paste into :root in globals.css to freeze it."
            id="css"
            title="CSS snippet"
          >
            <pre className="bg-card overflow-x-auto rounded-lg border p-4 font-mono text-xs leading-5">
              {cssSnippet}
            </pre>
          </KitSection>
        </div>
      </div>
    </div>
  );
}

function KitSection({
  children,
  description,
  id,
  title,
}: {
  children: React.ReactNode;
  description: string;
  id: string;
  title: string;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 space-y-5"
      id={id}
    >
      <div className="max-w-prose">
        <h2 className="type-heading" id={`${id}-title`}>
          {title}
        </h2>
        <p className="text-muted-foreground type-body mt-1">{description}</p>
      </div>
      {children}
    </section>
  );
}

function RangeControl({
  label,
  max,
  min,
  onChange,
  step,
  unit = "",
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  unit?: string;
  value: number;
}) {
  const id = `range-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)_5rem] items-center gap-3">
      <label className="type-ui" htmlFor={id}>
        {label}
      </label>
      <input
        className="accent-brand h-11 w-full"
        id={id}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
      <span className="text-right font-mono text-xs tabular-nums">
        {value}
        {unit}
      </span>
    </div>
  );
}

function TypeRow({
  onChange,
  style,
  values,
}: {
  onChange: (key: "leading" | "tracking" | "weight", value: number) => void;
  style: TypeStyle;
  values: { leading: number; tracking: number; weight: number };
}) {
  const family =
    style.family === "display"
      ? "Gelica"
      : style.family === "hand"
        ? "Caveat"
        : "Figtree";
  return (
    <div className="bg-card grid gap-4 rounded-lg border p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-2">
        <p
          className={cn(
            "truncate",
            style.name === "micro" && "uppercase",
            style.name === "kpi" && "tabular-nums",
          )}
          style={{
            fontFamily: fontStacks[style.family],
            fontSize: `${style.size}rem`,
            fontWeight: values.weight,
            letterSpacing: `${values.tracking}em`,
            lineHeight: `${values.leading}rem`,
          }}
        >
          {style.sample}
        </p>
        <p className="text-muted-foreground type-small">
          <span className="text-foreground font-medium">{style.label}</span> ·{" "}
          {style.use}
        </p>
        <p className="text-muted-foreground font-mono text-[11px]">
          type-{style.name} · {family} · {style.size * 16}px /{" "}
          {values.leading * 16}px · {values.weight} · {values.tracking}em
        </p>
      </div>
      <div className="space-y-3">
        <RangeControl
          label="Weight"
          max={900}
          min={300}
          onChange={(value) => onChange("weight", value)}
          step={10}
          value={values.weight}
        />
        <RangeControl
          label="Tracking"
          max={0.08}
          min={-0.06}
          onChange={(value) => onChange("tracking", Number(value.toFixed(3)))}
          step={0.001}
          unit="em"
          value={values.tracking}
        />
        <RangeControl
          label="Leading"
          max={3.5}
          min={0.875}
          onChange={(value) => onChange("leading", Number(value.toFixed(4)))}
          step={0.0625}
          unit="rem"
          value={values.leading}
        />
      </div>
    </div>
  );
}

function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        Dialog
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename your Brand</DialogTitle>
            <DialogDescription>
              The public slug stays the same; only the display name changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="kit-dialog-input">Brand name</Label>
            <Input defaultValue="Northwind Bakery" id="kit-dialog-input" />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={() => setOpen(false)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AlertDialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="destructive">
        Destructive confirmation
      </Button>
      <AlertDialog onOpenChange={setOpen} open={open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete Alice Martin&apos;s testimonial?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from your Wall and your inbox. It cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction className="bg-danger hover:bg-danger/90 text-white">
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        Sheet
      </Button>
      <Sheet onOpenChange={setOpen} open={open}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>
              The desktop sidebar becomes this sheet on mobile.
            </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    </>
  );
}

function DoodleShowcase() {
  const [drawKey, setDrawKey] = useState(0);
  return (
    <div className="space-y-6" key={drawKey}>
      <div className="flex flex-wrap items-end gap-8">
        <div className="space-y-2">
          <Sparkle className="text-brand size-12" draw />
          <p className="text-ink-2 type-small">Sparkle</p>
        </div>
        <div className="space-y-2">
          <p className="type-display">
            Get some{" "}
            <span className="relative inline-block whitespace-nowrap">
              <MarkerHighlight
                className="absolute inset-x-[-0.12em] bottom-[0.02em] h-[0.78em] w-[calc(100%+0.24em)]"
                draw
              />
              <span className="relative">proof</span>
            </span>
          </p>
          <p className="text-ink-2 type-small">MarkerHighlight</p>
        </div>
        <div className="space-y-2">
          <span className="relative inline-block px-4 py-1">
            <span className="type-kpi">12</span>
            <CircleAround
              className="absolute -inset-x-2 -inset-y-1 h-[calc(100%+0.5rem)] w-[calc(100%+1rem)]"
              draw
            />
          </span>
          <p className="text-ink-2 type-small">CircleAround</p>
        </div>
        <div className="space-y-2">
          <ArrowNote draw>this is what your customers see</ArrowNote>
          <p className="text-ink-2 type-small">ArrowNote · curve</p>
        </div>
        <div className="space-y-2">
          <ArrowNote arrow="flat" direction="left" draw>
            share this to start collecting
          </ArrowNote>
          <p className="text-ink-2 type-small">ArrowNote · flat</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          ["SpeechBubbleStars", <SpeechBubbleStars draw key="bubble" />],
          ["CameraTripod", <CameraTripod draw key="camera" />],
          ["EnvelopeStamp", <EnvelopeStamp draw key="envelope" />],
          ["WallFrames", <WallFrames draw key="wall" />],
        ].map(([name, element]) => (
          <div
            className="bg-card space-y-2 rounded-lg border p-4"
            key={String(name)}
          >
            <div className="text-ink [&>svg]:h-auto [&>svg]:w-full">
              {element}
            </div>
            <p className="text-ink-2 type-small">{String(name)}</p>
          </div>
        ))}
      </div>
      <Button
        onClick={() => setDrawKey((key) => key + 1)}
        size="sm"
        variant="outline"
      >
        <IconRefresh aria-hidden="true" />
        Replay draw-in
      </Button>
    </div>
  );
}
