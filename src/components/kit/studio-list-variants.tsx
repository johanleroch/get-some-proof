"use client";

import { type ReactNode, useState } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconCode,
  IconDots,
  IconExternalLink,
  IconPlus,
} from "@tabler/icons-react";

import type { WidgetConfig } from "@convex/domain/widgets";
import { ArrowNote } from "@/components/doodles";
import { PageHeader } from "@/components/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

/**
 * Development review of the Studio widget list (DESIGN.md sections 6 and 7):
 * four ways to replace the row that today says a name, a template and a count
 * and shows nothing of the widget itself. Every variant carries the same four
 * widgets in the same four states. Pick one here, then port it into
 * `src/components/studio/studio-view.tsx`.
 */

type Layout = WidgetConfig["layout"];

type SampleWidget = {
  id: string;
  name: string;
  layout: Layout;
  templateName: string;
  testimonials: number;
  /** Published, published with newer edits, or never published. */
  state: "live" | "ahead" | "draft";
  /** What the second line says about time, already worded. */
  when: string;
};

/** Four widgets in the four states a real Studio holds. */
const widgets: SampleWidget[] = [
  {
    id: "homepage",
    name: "Homepage proof",
    layout: "masonry",
    templateName: "Masonry grid",
    testimonials: 6,
    state: "ahead",
    when: "Edited 2 hours ago",
  },
  {
    id: "pricing",
    name: "Pricing page faces",
    layout: "avatars",
    templateName: "Avatar stack",
    testimonials: 5,
    state: "live",
    when: "Published 3 weeks ago",
  },
  {
    id: "hero",
    name: "Landing hero quote",
    layout: "individual",
    templateName: "Individual testimonial",
    testimonials: 1,
    state: "draft",
    when: "Edited 4 hours ago",
  },
  {
    id: "cases",
    name: "Case studies band",
    layout: "carousel",
    templateName: "Horizontal carousel",
    testimonials: 9,
    state: "live",
    when: "Published today",
  },
];

const stateLabel: Record<SampleWidget["state"], string> = {
  ahead: "Unpublished changes",
  draft: "Draft",
  live: "Published",
};

const stateVariant: Record<
  SampleWidget["state"],
  "neutral" | "success" | "warning"
> = {
  ahead: "warning",
  draft: "neutral",
  live: "success",
};

/**
 * The widget's layout as a miniature, so the list shows the shape rather than
 * naming it. Same grammar as the template chooser's sketch, three sizes.
 */
function LayoutSketch({
  layout,
  size = "row",
}: {
  layout: Layout;
  size?: "row" | "card" | "panel";
}) {
  const bar = size === "row" ? "h-1" : "h-1.5";
  const gap = size === "row" ? "gap-1" : "gap-2";
  const pad = size === "row" ? "p-1.5" : "p-2.5";
  if (layout === "avatars") {
    return (
      <div
        aria-hidden="true"
        className="flex h-full items-center justify-center -space-x-1.5"
      >
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              "border-surface-2 bg-paper block rounded-full border-2",
              size === "row" ? "size-4" : "size-8",
            )}
          />
        ))}
      </div>
    );
  }
  const cells = layout === "individual" ? 1 : layout === "carousel" ? 3 : 4;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid h-full w-full items-center",
        gap,
        layout === "individual"
          ? "grid-cols-1"
          : layout === "carousel"
            ? "grid-cols-3"
            : "grid-cols-2",
      )}
    >
      {Array.from({ length: cells }, (_, index) => (
        <div
          key={index}
          className={cn(
            "bg-paper border-line rounded-sm border",
            pad,
            layout === "masonry" && index % 2 === 0 && "-translate-y-1",
          )}
        >
          <div className={cn("bg-brand-soft-2 mb-1 w-2/3 rounded-full", bar)} />
          <div className={cn("bg-line w-full rounded-full", bar)} />
          {size !== "row" ? (
            <div className={cn("bg-line mt-1 w-1/2 rounded-full", bar)} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** The row actions, revealed on hover and always reachable by keyboard. */
function RowActions({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1",
        compact &&
          "opacity-0 transition-opacity duration-(--motion-fast) ease-(--ease-out-soft) group-focus-within/row:opacity-100 group-hover/row:opacity-100",
      )}
    >
      <Button size="icon" variant="ghost" aria-label="Copy embed code">
        <IconCode className="size-4" />
      </Button>
      <Button size="icon" variant="ghost" aria-label="Open widget page">
        <IconExternalLink className="size-4" />
      </Button>
      <Button size="icon" variant="ghost" aria-label="Widget actions">
        <IconDots className="size-4" />
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * A — Rows with a thumbnail
 * ------------------------------------------------------------------ */

function VariantRows() {
  return (
    <div className="border-line bg-surface divide-line divide-y overflow-hidden rounded-lg border">
      {widgets.map((widget) => (
        <div
          className="group/row hover:bg-surface-2 relative flex items-center gap-4 px-4 py-3 transition-colors duration-(--motion-fast) ease-(--ease-out-soft) sm:px-5"
          key={widget.id}
        >
          <div className="bg-surface-2 border-line grid h-11 w-16 shrink-0 place-items-center overflow-hidden rounded-md border p-1.5">
            <LayoutSketch layout={widget.layout} />
          </div>
          <button
            className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:content-['']"
            type="button"
          >
            <span className="type-ui block truncate font-semibold">
              {widget.name}
            </span>
            <span className="type-small text-ink-2 block truncate">
              {widget.templateName} · {widget.testimonials} testimonials ·{" "}
              {widget.when}
            </span>
          </button>
          <Badge variant={stateVariant[widget.state]}>
            {stateLabel[widget.state]}
          </Badge>
          <div className="relative z-10">
            <RowActions compact />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * B — Table
 * ------------------------------------------------------------------ */

function VariantTable() {
  return (
    <div className="border-line bg-surface overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[44rem] border-collapse text-left">
        <thead>
          <tr className="border-line type-micro text-ink-2 border-b">
            <th className="px-5 py-2.5 font-medium">Widget</th>
            <th className="px-5 py-2.5 font-medium">Template</th>
            <th className="px-5 py-2.5 text-right font-medium">Testimonials</th>
            <th className="px-5 py-2.5 font-medium">State</th>
            <th className="px-5 py-2.5 font-medium">Last change</th>
            <th className="w-px px-5 py-2.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-line divide-y">
          {widgets.map((widget) => (
            <tr
              className="group/row hover:bg-surface-2 relative transition-colors duration-(--motion-fast) ease-(--ease-out-soft)"
              key={widget.id}
            >
              <td className="px-5 py-3">
                <button
                  className="type-ui truncate font-semibold after:absolute after:inset-0 after:content-['']"
                  type="button"
                >
                  {widget.name}
                </button>
              </td>
              <td className="type-small text-ink-2 px-5 py-3">
                <span className="flex items-center gap-2">
                  <span className="bg-surface-2 border-line grid h-6 w-9 shrink-0 place-items-center overflow-hidden rounded-sm border p-1">
                    <LayoutSketch layout={widget.layout} />
                  </span>
                  {widget.templateName}
                </span>
              </td>
              <td className="type-small text-ink-2 px-5 py-3 text-right tabular-nums">
                {widget.testimonials}
              </td>
              <td className="px-5 py-3">
                <Badge variant={stateVariant[widget.state]}>
                  {stateLabel[widget.state]}
                </Badge>
              </td>
              <td className="type-small text-ink-2 px-5 py-3">{widget.when}</td>
              <td className="relative z-10 px-5 py-3">
                <RowActions compact />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * C — List beside a preview
 * ------------------------------------------------------------------ */

function VariantSplit() {
  const [selected, setSelected] = useState(widgets[0]!.id);
  const active =
    widgets.find((widget) => widget.id === selected) ?? widgets[0]!;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="border-line bg-surface divide-line divide-y overflow-hidden rounded-lg border">
        {widgets.map((widget) => (
          <button
            aria-current={widget.id === active.id}
            className={cn(
              "hover:bg-surface-2 block w-full px-4 py-3 text-left transition-colors duration-(--motion-fast) ease-(--ease-out-soft)",
              widget.id === active.id && "bg-surface-2",
            )}
            key={widget.id}
            onClick={() => setSelected(widget.id)}
            type="button"
          >
            <span className="flex items-center gap-2">
              <span className="type-ui min-w-0 flex-1 truncate font-semibold">
                {widget.name}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  widget.state === "live"
                    ? "bg-success"
                    : widget.state === "ahead"
                      ? "bg-warning"
                      : "bg-ink-3",
                )}
              />
            </span>
            <span className="type-small text-ink-2 block truncate">
              {widget.templateName} · {widget.testimonials}
            </span>
          </button>
        ))}
      </div>
      <div className="border-line bg-surface flex flex-col overflow-hidden rounded-lg border">
        <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
          <div className="min-w-0">
            <p className="type-ui truncate font-semibold">{active.name}</p>
            <p className="type-small text-ink-2 truncate">{active.when}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={stateVariant[active.state]}>
              {stateLabel[active.state]}
            </Badge>
            <Button size="sm">Edit widget</Button>
          </div>
        </div>
        <div className="studio-preview-canvas bg-surface-2 grid min-h-56 flex-1 place-items-center p-8">
          <div className="w-full max-w-sm">
            <LayoutSketch layout={active.layout} size="panel" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * D — Preview cards
 * ------------------------------------------------------------------ */

function VariantCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {widgets.map((widget) => (
        <div
          className="group/row border-line bg-surface hover:border-line-2 relative flex flex-col overflow-hidden rounded-lg border transition-colors duration-(--motion-fast) ease-(--ease-out-soft)"
          key={widget.id}
        >
          <div className="studio-preview-canvas bg-surface-2 grid h-36 place-items-center px-6">
            <div className="w-full max-w-56">
              <LayoutSketch layout={widget.layout} size="card" />
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:content-['']"
              type="button"
            >
              <span className="type-ui block truncate font-semibold">
                {widget.name}
              </span>
              <span className="type-small text-ink-2 block truncate">
                {widget.testimonials} testimonials · {widget.when}
              </span>
            </button>
            <Badge variant={stateVariant[widget.state]}>
              {stateLabel[widget.state]}
            </Badge>
            <div className="relative z-10">
              <Button size="icon" variant="ghost" aria-label="Widget actions">
                <IconDots className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const variants = [
  {
    key: "rows",
    title: "A — Rangées avec vignette",
    note: "La ligne d'aujourd'hui, mais elle montre la forme du widget au lieu de la nommer, et elle dit son état et sa dernière modification. Les actions (copier le code, ouvrir, menu) apparaissent au survol, comme dans l'Inbox. Toute la ligne est cliquable. C'est la réponse conforme à DESIGN.md : des listes, pas des piles de cartes.",
    body: <VariantRows />,
  },
  {
    key: "table",
    title: "B — Table",
    note: "Les mêmes informations en colonnes nommées, triables. Tient sans effort à quinze widgets, et le nombre de témoignages s'aligne en chiffres tabulaires. Plus froid : ça ressemble à un back-office, pas à un studio.",
    body: <VariantTable />,
  },
  {
    key: "split",
    title: "C — Liste + aperçu",
    note: "Un tiers pour la liste, deux tiers pour l'aperçu du widget sélectionné sur le canevas quadrillé de l'éditeur. Tu vois ce que tu choisis sans entrer dedans, et « Edit widget » devient le geste explicite. Le prix : deux widgets de plus à l'écran que dans A, et une colonne vide quand il n'y en a qu'un.",
    body: <VariantSplit />,
  },
  {
    key: "cards",
    title: "D — Cartes d'aperçu",
    note: "La galerie : chaque widget est sa propre vignette sur le canevas. C'est le plus visuel, et c'est celui qui casse une règle — DESIGN.md dit « les données vivent dans des listes et des tables, pas des piles de cartes ». Je te le montre quand même parce que la règle a été écrite pour des chiffres, et qu'ici la donnée est une image.",
    body: <VariantCards />,
  },
] satisfies Array<{
  key: string;
  title: string;
  note: string;
  body: ReactNode;
}>;

type Width = "desktop" | "tablet" | "phone";

const widths: Record<Width, string> = {
  desktop: "max-w-[1200px]",
  phone: "max-w-[390px]",
  tablet: "max-w-[820px]",
};

export function StudioListVariants() {
  const [width, setWidth] = useState<Width>("desktop");
  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="type-subheading">Studio — la liste des widgets</h1>
            <p className="type-small text-ink-2">
              Quatre façons de remplacer la rangée actuelle. Développement
              uniquement.
            </p>
          </div>
          <Segmented
            label="Preview width"
            onChange={setWidth}
            options={[
              { key: "desktop", label: "Desktop" },
              { key: "tablet", label: "Tablet" },
              { key: "phone", label: "Phone" },
            ]}
            value={width}
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
          <h2 className="type-heading">Ce qui ne va pas aujourd&rsquo;hui</h2>
          <p className="type-body text-ink-2">
            La liste dit un nom, un nom de gabarit et un compte. Elle ne montre
            rien : le produit sert à fabriquer quelque chose de visuel, et
            l&rsquo;écran qui rassemble ces objets n&rsquo;en donne aucune
            image. « Masonry grid » ne veut rien dire tant qu&rsquo;on ne
            l&rsquo;a pas vu.
          </p>
          <p className="type-body text-ink-2">
            Elle jette aussi ce qu&rsquo;elle sait : la base garde{" "}
            <code className="font-mono">publishedAt</code> et{" "}
            <code className="font-mono">updatedAt</code>, donc on peut dire «
            publié il y a trois semaines » et surtout « publié, mais tu as des
            changements non publiés » — l&rsquo;état qui compte vraiment et que
            le badge binaire Draft / Published ne sait pas dire. Enfin la
            corbeille est au même poids que l&rsquo;état : supprimer est aussi
            visible que lire.
          </p>
          <p className="type-body text-ink-2">
            Les quatre variantes corrigent les mêmes quatre choses : une image
            du gabarit, trois états au lieu de deux, la date de dernière
            modification, et les actions rangées au survol avec la suppression
            dans le menu.
          </p>
        </section>

        {variants.map((variant) => (
          <section className="space-y-3" key={variant.key}>
            <div className="max-w-prose space-y-1">
              <h2 className="type-heading">{variant.title}</h2>
              <p className="type-body text-ink-2">{variant.note}</p>
            </div>
            <div className={cn("w-full", widths[width])}>
              <div className="bg-paper border-line space-y-8 rounded-xl border p-5 sm:p-8">
                <PageHeader
                  actions={
                    <Button>
                      <IconPlus className="size-4" />
                      Create widget
                    </Button>
                  }
                  description="Your best proof, ready for every page."
                  title="Studio"
                />
                {variant.body}
              </div>
            </div>
          </section>
        ))}

        <section className="max-w-prose space-y-2">
          <h2 className="type-heading">Ce que je recommande</h2>
          <p className="type-body text-ink-2">
            <strong>A</strong>, avec une réserve. C&rsquo;est la seule qui
            tienne à un widget comme à vingt, elle respecte la grammaire de
            l&rsquo;Inbox (des lignes, le survol qui révèle les outils) et elle
            règle le vrai manque — voir la forme — sans transformer la page en
            galerie. <strong>D</strong> est plus belle sur quatre widgets et
            devient une mosaïque fatigante sur vingt. <strong>C</strong> est la
            plus juste si le Studio doit rester un atelier plutôt qu&rsquo;une
            liste, mais elle coûte une colonne vide au premier widget.{" "}
            <strong>B</strong> est la bonne réponse à une question que personne
            ne se pose encore.
          </p>
          <ArrowNote arrow="curve" direction="left">
            Dis-moi laquelle et je la pose dans studio-view.tsx.
          </ArrowNote>
        </section>
      </main>
    </div>
  );
}
