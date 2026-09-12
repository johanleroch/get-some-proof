"use client";

import { type ReactNode, useState } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconChevronDown,
  IconDeviceDesktop,
  IconDeviceIpad,
  IconDeviceLaptop,
  IconDeviceMobile,
  IconLink,
  IconPencil,
  IconTypography,
} from "@tabler/icons-react";

import type { WidgetConfig } from "@convex/domain/widgets";
import {
  initialWidgetConfig,
  widgetTemplates,
} from "@/components/studio/catalog";
import { CanvasGrid } from "@/components/studio/canvas-grid";
import { WidgetPreview } from "@/components/studio/widget-preview";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { primaryStudioCandidates } from "@/components/visual-evidence/studio-fixture";
import { cn } from "@/lib/utils";

/**
 * Development review of the Studio editor (DESIGN.md section 6, Studio): three
 * ways to treat the preview canvas and three ways to treat the 320px settings
 * column. Every canvas variant renders the real widget through the real embed
 * runtime, so what is compared is the frame around it, not a drawing of it.
 * Pick one of each, then port them into `widget-editor.tsx`.
 */

const config: WidgetConfig = { ...initialWidgetConfig, layout: "masonry" };
const testimonials = primaryStudioCandidates
  .slice(0, 3)
  .map((candidate) => candidate.card);

function Widget({ width }: { width?: number }) {
  return (
    <div style={width ? { width } : undefined}>
      <WidgetPreview
        value={{
          attributionRequired: false,
          brandName: "Cedar Workshop",
          config,
          customFont: null,
          googleFont: null,
          testimonials,
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Canvas
 * ------------------------------------------------------------------ */

type Device = {
  key: string;
  label: string;
  width: number;
  icon: typeof IconDeviceDesktop;
};

const devices: Device[] = [
  { key: "desktop", label: "Desktop", width: 1280, icon: IconDeviceDesktop },
  { key: "laptop", label: "Laptop", width: 1024, icon: IconDeviceLaptop },
  { key: "tablet", label: "Tablet", width: 768, icon: IconDeviceIpad },
  { key: "phone", label: "Phone", width: 390, icon: IconDeviceMobile },
];

/** A — the widget on a white page sheet, the way a visitor meets it. */
function CanvasSheet() {
  const [device, setDevice] = useState(devices[1]!);
  return (
    <CanvasFrame
      device={device}
      onDevice={setDevice}
      toolbar={<span className="type-small text-ink-2">Your page</span>}
    >
      <div
        className="bg-paper border-line my-auto w-full overflow-hidden rounded-lg border"
        style={{ maxWidth: device.width }}
      >
        <div className="px-6 py-8">
          <Widget />
        </div>
      </div>
    </CanvasFrame>
  );
}

/** B — the widget alone as an artboard, measured, nothing around it. */
function CanvasArtboard() {
  const [device, setDevice] = useState(devices[1]!);
  return (
    <CanvasFrame
      device={device}
      onDevice={setDevice}
      toolbar={
        <span className="type-small text-ink-2 font-mono tabular-nums">
          {device.width} × auto
        </span>
      }
    >
      <div className="my-auto w-full" style={{ maxWidth: device.width }}>
        <div className="border-line-2 mb-2 flex items-center gap-2 border-b border-dashed pb-1.5">
          <span className="type-small text-ink-2 font-mono tabular-nums">
            {device.width}px
          </span>
        </div>
        <Widget />
      </div>
    </CanvasFrame>
  );
}

/** C — today's canvas, centred and capped, with the measurement said out loud. */
function CanvasCentred() {
  const [device, setDevice] = useState(devices[1]!);
  return (
    <CanvasFrame
      device={device}
      onDevice={setDevice}
      toolbar={<span className="type-small text-ink-2">Live preview</span>}
    >
      <div className="my-auto w-full" style={{ maxWidth: device.width }}>
        <Widget />
      </div>
    </CanvasFrame>
  );
}

function CanvasFrame({
  children,
  device,
  onDevice,
  toolbar,
}: {
  children: ReactNode;
  device: Device;
  onDevice: (device: Device) => void;
  toolbar: ReactNode;
}) {
  return (
    <div className="border-line bg-surface-2 flex h-[34rem] flex-col overflow-hidden rounded-lg border">
      <div className="border-line bg-paper flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2">
        {toolbar}
        <div className="flex gap-1">
          {devices.map((item) => (
            <Button
              aria-label={`${item.label} preview`}
              aria-pressed={item.key === device.key}
              key={item.key}
              onClick={() => onDevice(item)}
              size="icon"
              variant={item.key === device.key ? "secondary" : "ghost"}
            >
              <item.icon className="size-4" />
            </Button>
          ))}
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 overflow-y-auto p-6">
        <CanvasGrid />
        <div className="relative mx-auto flex w-full flex-col">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Settings column
 * ------------------------------------------------------------------ */

function SelectedProof() {
  return (
    <div className="space-y-2">
      {testimonials.map((card) => (
        <div
          className="border-line bg-surface flex items-center gap-2.5 rounded-md border px-2.5 py-2"
          key={card.id}
        >
          <span className="bg-brand-soft text-brand-text grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold">
            {card.name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </span>
          <span className="type-small min-w-0 flex-1 truncate">
            {card.name}
          </span>
        </div>
      ))}
      <Button className="w-full" size="sm" variant="outline">
        <IconPencil className="size-4" />
        Edit selection
      </Button>
    </div>
  );
}

function TemplateThumb() {
  return (
    <button
      className="border-line hover:bg-surface-2 flex w-full items-center gap-3 rounded-md border p-2 text-left transition-colors duration-(--motion-fast) ease-(--ease-out-soft)"
      type="button"
    >
      <span className="bg-surface-2 border-line grid h-10 w-14 shrink-0 place-items-center overflow-hidden rounded-sm border p-1.5">
        <span className="grid w-full grid-cols-2 gap-1">
          {[0, 1, 2, 3].map((index) => (
            <span
              className={cn(
                "bg-paper border-line block h-3 rounded-[2px] border",
                index % 2 === 0 && "-translate-y-0.5",
              )}
              key={index}
            />
          ))}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="type-small block truncate font-semibold">
          {widgetTemplates[0]!.title}
        </span>
        <span className="type-small text-ink-2 block truncate">
          Change template
        </span>
      </span>
      <IconChevronDown className="text-ink-3 size-4 shrink-0" />
    </button>
  );
}

function ColorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="type-small">{label}</Label>
      <button
        className="border-line hover:bg-surface-2 flex items-center gap-2 rounded-md border py-1 pr-2.5 pl-1 transition-colors duration-(--motion-fast) ease-(--ease-out-soft)"
        type="button"
      >
        <span
          className="border-line block size-6 rounded-[5px] border"
          style={{ background: value }}
        />
        <span className="type-small text-ink-2 font-mono tabular-nums">
          {value}
        </span>
      </button>
    </div>
  );
}

function Appearance() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="type-small flex items-center gap-2">
          <IconTypography className="text-ink-3 size-4" />
          Font
        </Label>
        <button
          className="border-line hover:bg-surface-2 type-small flex h-9 w-full items-center justify-between rounded-md border px-3 transition-colors duration-(--motion-fast) ease-(--ease-out-soft)"
          type="button"
        >
          Match your website
          <IconChevronDown className="text-ink-3 size-4" />
        </button>
      </div>
      <ColorRow label="Accent" value="#ffbb16" />
      <ColorRow label="Background" value="#ffffff" />
      <ColorRow label="Text" value="#2e2a25" />
    </div>
  );
}

function Behaviour() {
  return (
    <label className="flex min-h-11 items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="type-small flex items-center gap-2 font-medium">
          <IconLink className="text-ink-3 size-4" />
          Clickable links
        </span>
        <span className="type-small text-ink-2 mt-0.5 block">
          Mentions stay visible either way.
        </span>
      </span>
      <Switch defaultChecked />
    </label>
  );
}

function Group({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="space-y-3">
      <h3 className="type-micro text-ink-2">{title}</h3>
      {children}
    </section>
  );
}

/** A — four named groups, in the order the work happens. */
function ColumnSections() {
  return (
    <ColumnFrame>
      <div className="space-y-6 p-5">
        <Group title="Content">
          <SelectedProof />
          <div className="space-y-2 pt-1">
            <Label className="type-small" htmlFor="v-name">
              Widget name
            </Label>
            <Input defaultValue="Homepage proof" id="v-name" />
          </div>
        </Group>
        <div className="border-line border-t" />
        <Group title="Layout">
          <TemplateThumb />
        </Group>
        <div className="border-line border-t" />
        <Group title="Appearance">
          <Appearance />
        </Group>
        <div className="border-line border-t" />
        <Group title="Behaviour">
          <Behaviour />
        </Group>
      </div>
    </ColumnFrame>
  );
}

/** B — two tabs: what is in it, and what it looks like. */
function ColumnTabs() {
  return (
    <ColumnFrame>
      <Tabs className="gap-0" defaultValue="content">
        <TabsList className="m-4 mb-0 grid grid-cols-2">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="style">Style</TabsTrigger>
        </TabsList>
        <TabsContent className="space-y-6 p-5" value="content">
          <SelectedProof />
          <div className="space-y-2">
            <Label className="type-small" htmlFor="v-name-2">
              Widget name
            </Label>
            <Input defaultValue="Homepage proof" id="v-name-2" />
          </div>
          <TemplateThumb />
        </TabsContent>
        <TabsContent className="space-y-6 p-5" value="style">
          <Appearance />
          <div className="border-line border-t pt-4">
            <Behaviour />
          </div>
        </TabsContent>
      </Tabs>
    </ColumnFrame>
  );
}

/** C — one section open at a time, so the column never scrolls. */
function ColumnAccordion() {
  const [open, setOpen] = useState("content");
  const sections = [
    {
      key: "content",
      label: "Content",
      hint: "3 testimonials",
      body: <SelectedProof />,
    },
    {
      key: "layout",
      label: "Layout",
      hint: "Masonry grid",
      body: <TemplateThumb />,
    },
    {
      key: "appearance",
      label: "Appearance",
      hint: "Amber",
      body: <Appearance />,
    },
    {
      key: "behaviour",
      label: "Behaviour",
      hint: "Links on",
      body: <Behaviour />,
    },
  ];
  return (
    <ColumnFrame>
      <div className="divide-line divide-y">
        {sections.map((section) => (
          <div key={section.key}>
            <button
              aria-expanded={open === section.key}
              className="hover:bg-surface-2 flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors duration-(--motion-fast) ease-(--ease-out-soft)"
              onClick={() => setOpen(open === section.key ? "" : section.key)}
              type="button"
            >
              <span className="type-small min-w-0 flex-1 font-semibold">
                {section.label}
              </span>
              <span className="type-small text-ink-2 truncate">
                {section.hint}
              </span>
              <IconChevronDown
                className={cn(
                  "text-ink-3 size-4 shrink-0 transition-transform duration-(--motion-base) ease-(--ease-out-soft)",
                  open === section.key && "rotate-180",
                )}
              />
            </button>
            {open === section.key ? (
              <div className="px-5 pb-5">{section.body}</div>
            ) : null}
          </div>
        ))}
      </div>
    </ColumnFrame>
  );
}

function ColumnFrame({ children }: { children: ReactNode }) {
  return (
    <div className="border-line bg-surface h-[34rem] w-80 shrink-0 overflow-y-auto rounded-lg border">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const canvases = [
  {
    key: "sheet",
    title: "A — La feuille",
    note: "Le widget est posé sur une page blanche à la largeur choisie, centrée sur le quadrillage. Tu vois ce que ton visiteur verra : un bloc dans une page, pas un bloc dans le vide. C'est aussi la variante qui prépare le chantier « placer sur mon vrai site » — il suffira de remplacer la feuille blanche par la capture de la page du client.",
    body: <CanvasSheet />,
  },
  {
    key: "artboard",
    title: "B — L'artboard",
    note: "Pas de feuille : le widget est l'objet, mesuré, avec sa largeur écrite au-dessus d'un filet pointillé. Vocabulaire d'outil de design plutôt que de site. Le plus honnête sur ce qu'on règle, le moins parlant sur le résultat final.",
    body: <CanvasArtboard />,
  },
  {
    key: "centred",
    title: "C — Centré, simplement",
    note: "Le canevas d'aujourd'hui, mais le widget est bridé à une largeur réelle et centré verticalement au lieu d'être collé en haut. Changement minimal, corrige les deux défauts mesurés (1415px de large, 385px de vide dessous) sans rien ajouter.",
    body: <CanvasCentred />,
  },
] satisfies Array<{
  key: string;
  title: string;
  note: string;
  body: ReactNode;
}>;

const columns = [
  {
    key: "sections",
    title: "A — Quatre sections nommées",
    note: "Contenu → Mise en page → Apparence → Comportement, dans l'ordre où on travaille. Les témoignages choisis sont montrés (initiales + nom) au lieu de « 3 selected », le template redevient une vignette, et le réglage des liens quitte « Apparence » pour « Comportement », là où il appartient.",
    body: <ColumnSections />,
  },
  {
    key: "tabs",
    title: "B — Deux onglets",
    note: "« Ce qu'il y a dedans » et « À quoi ça ressemble ». Divise le défilement par deux et sépare deux moments de travail. Le prix : un réglage sur deux est toujours caché, et on ne voit jamais l'ensemble.",
    body: <ColumnTabs />,
  },
  {
    key: "accordion",
    title: "C — Accordéon",
    note: "Une section ouverte à la fois, chaque en-tête résumant son état (« 3 testimonials », « Masonry grid », « Amber »). La colonne ne défile jamais et se lit comme un sommaire. Le prix : un clic de plus pour chaque réglage.",
    body: <ColumnAccordion />,
  },
] satisfies Array<{
  key: string;
  title: string;
  note: string;
  body: ReactNode;
}>;

export function StudioEditorVariants() {
  const [tab, setTab] = useState<"canvas" | "column">("canvas");
  const list = tab === "canvas" ? canvases : columns;
  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="type-subheading">Studio — l&rsquo;éditeur</h1>
            <p className="type-small text-ink-2">
              Le canevas et la colonne de réglages. Développement uniquement.
            </p>
          </div>
          <Segmented
            label="Which half"
            onChange={setTab}
            options={[
              { key: "canvas", label: "Le canevas" },
              { key: "column", label: "La colonne" },
            ]}
            value={tab}
          />
          <ThemeToggle />
          <Button asChild size="sm" variant="outline">
            <Link href="/kit">
              <IconArrowLeft aria-hidden="true" />
              Kit
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-12 px-6 py-8">
        <section className="max-w-prose space-y-2">
          <h2 className="type-heading">Ce qui est mesuré</h2>
          <p className="type-body text-ink-2">
            Dans l&rsquo;éditeur actuel, le widget s&rsquo;affiche sur{" "}
            <strong>1415px de large</strong> dans un canevas de 1202px de haut
            dont <strong>385px sont vides</strong> sous lui, collé en haut à
            gauche. Aucun site réel n&rsquo;affiche un bloc de témoignages sur
            1415px, et DESIGN.md demande que tout bloc soit centré dans la
            colonne qui le porte. Les trois canevas ci-dessous corrigent ces
            deux points et se distinguent sur une seule question :
            qu&rsquo;est-ce qu&rsquo;on montre autour du widget ?
          </p>
          <p className="type-body text-ink-2">
            Côté colonne, trois groupes se suivent et un seul porte un titre ;
            le cœur du widget — quels témoignages — se résume à « 3 selected »
            en gris ; le template redevient une liste de mots après avoir été
            choisi sur une grille d&rsquo;images ; et un réglage de comportement
            ouvre la section Apparence. Les trois colonnes règlent tout cela de
            la même façon et se distinguent sur la quantité qu&rsquo;on montre à
            la fois.
          </p>
        </section>

        {list.map((variant) => (
          <section className="space-y-3" key={variant.key}>
            <div className="max-w-prose space-y-1">
              <h2 className="type-heading">{variant.title}</h2>
              <p className="type-body text-ink-2">{variant.note}</p>
            </div>
            {tab === "canvas" ? (
              variant.body
            ) : (
              <div className="flex gap-4">
                {variant.body}
                <div className="border-line bg-surface-2 hidden flex-1 items-center justify-center rounded-lg border lg:flex">
                  <span className="type-small text-ink-2">
                    Le canevas prend le reste
                  </span>
                </div>
              </div>
            )}
          </section>
        ))}

        <section className="max-w-prose space-y-2">
          <h2 className="type-heading">Ce que je recommande</h2>
          <p className="type-body text-ink-2">
            Canevas <strong>A</strong>, colonne <strong>A</strong>. La feuille
            est la seule qui réponde à la question que le fondateur se pose
            vraiment — « à quoi ça ressemblera chez moi » — et elle est
            littéralement l&rsquo;étape d&rsquo;avant du placement sur le vrai
            site : même cadre, on remplace le blanc par la capture. Les quatre
            sections nommées coûtent un peu de défilement mais gardent tout
            visible, ce qui compte quand on règle une couleur en regardant
            l&rsquo;aperçu. Les onglets et l&rsquo;accordéon rangent mieux et
            font perdre le lien entre le réglage et son effet.
          </p>
        </section>
      </main>
    </div>
  );
}
