import type { ComponentType } from "react";
import Link from "next/link";
import {
  IconArrowLeft,
  IconExternalLink,
  IconLayoutGrid,
} from "@tabler/icons-react";

import { Blob } from "@/components/brand/blob";
import { ArrowNote, EnvelopeSent, WallFrames } from "@/components/doodles";
import { LandingCapabilities } from "@/components/landing/landing-capabilities";
import { LandingCollection } from "@/components/landing/landing-collection";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFaq } from "@/components/landing/landing-faq";
import { LandingHero } from "@/components/landing/landing-hero";
import {
  DemoLine,
  Eyebrow,
  PageTitle,
  SectionLead,
  SectionTitle,
} from "@/components/landing/landing-primitives";
import { LandingProblem } from "@/components/landing/landing-problem";
import { LandingSelection } from "@/components/landing/landing-selection";
import { LandingSteps } from "@/components/landing/landing-steps";
import { LandingStudio } from "@/components/landing/landing-studio";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { landingBlocks } from "@/lib/landing-blocks";

const blockComponents: Record<string, ComponentType> = {
  capabilities: LandingCapabilities,
  collection: LandingCollection,
  cta: LandingCta,
  faq: LandingFaq,
  hero: LandingHero,
  problem: LandingProblem,
  selection: LandingSelection,
  steps: LandingSteps,
  studio: LandingStudio,
};

function Specimen({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="border-line flex flex-col gap-3 border-t pt-4">
      <p className="text-muted-foreground font-mono text-[11px] uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

/**
 * Development review of the landing page, block by block: the pieces it is
 * written with at the top, then every block live and full width with what it
 * has to do and the file that draws it. Judge a block here, judge the page
 * at `/`, and judge the widths in `/screens`, which frames the real page at
 * the four artboard sizes — a block squeezed into a narrow column here would
 * flatter, and a preview that flatters lies.
 */
export function LandingKit() {
  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="bg-background/85 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="type-subheading">Landing page</h1>
            <p className="text-muted-foreground type-small">
              {landingBlocks.length} blocks, live. Development only.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/kit">
              <IconArrowLeft aria-hidden="true" />
              Kit
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/screens">
              <IconLayoutGrid aria-hidden="true" />
              Screens
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/">
              <IconExternalLink aria-hidden="true" />
              Public page
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="pb-16">
        <section className="mx-auto max-w-[1400px] px-6 py-8">
          <p className="text-muted-foreground type-small max-w-prose">
            One file per block in{" "}
            <code className="font-mono text-[12px]">
              src/components/landing/
            </code>
            , listed in{" "}
            <code className="font-mono text-[12px]">
              src/lib/landing-blocks.ts
            </code>
            , composed by{" "}
            <code className="font-mono text-[12px]">landing-page.tsx</code>. The
            demonstration content lives in{" "}
            <code className="font-mono text-[12px]">
              src/lib/landing-demo.ts
            </code>
            ; the design notes and the asset gaps are in{" "}
            <code className="font-mono text-[12px]">
              docs/design/landing-page/DESIGN.md
            </code>
            .
          </p>

          <h2 className="type-heading mt-10">Pieces</h2>
          <div className="mt-5 grid gap-8 lg:grid-cols-2">
            <div className="space-y-6">
              <Specimen label="Page title · hero only">
                <PageTitle>Your happy customers</PageTitle>
              </Specimen>
              <Specimen label="Section title · statement">
                <SectionTitle size="statement">
                  A happy customer. Now what?
                </SectionTitle>
              </Specimen>
              <Specimen label="Section title · default">
                <SectionTitle>
                  Stay in control of your testimonials.
                </SectionTitle>
              </Specimen>
              <Specimen label="Lead">
                <SectionLead>
                  Give visitors a reason to trust your business. Collect text
                  and video testimonials, then add them to your sales pages.
                </SectionLead>
              </Specimen>
              <Specimen label="Eyebrow">
                <Eyebrow>On the homepage</Eyebrow>
              </Specimen>
              <Specimen label="Demonstration caption">
                <DemoLine>
                  Fernhill Studio and every testimonial on this page are
                  invented.
                </DemoLine>
              </Specimen>
            </div>
            <div className="space-y-6">
              <Specimen label="Handwritten notes">
                <div className="flex flex-wrap items-end gap-8">
                  <ArrowNote arrow="rise">demo wall, nobody real yet</ArrowNote>
                  <ArrowNote arrow="rise" size="sm">
                    paste this on your site
                  </ArrowNote>
                </div>
              </Specimen>
              <Specimen label="Drawings in use">
                <div className="flex flex-wrap items-end gap-10">
                  <EnvelopeSent className="text-ink h-28 w-auto" />
                  <WallFrames className="text-ink h-28 w-auto" />
                  <Blob expression="starstruck" size={96} />
                </div>
              </Specimen>
              <Specimen label="Bands">
                <div className="flex flex-wrap gap-3">
                  {[
                    { className: "bg-paper", label: "paper" },
                    { className: "bg-surface-2", label: "quiet" },
                    { className: "bg-brand-soft", label: "poster" },
                    { className: "bg-ink text-paper", label: "ink" },
                  ].map((band) => (
                    <span
                      className={`border-line type-small rounded-lg border px-4 py-3 ${band.className}`}
                      key={band.label}
                    >
                      {band.label}
                    </span>
                  ))}
                </div>
              </Specimen>
            </div>
          </div>
        </section>

        <div className="space-y-10">
          {landingBlocks.map((block, index) => {
            const Block = blockComponents[block.id];
            return (
              <article id={block.id} key={block.id}>
                <div className="mx-auto max-w-[1400px] px-6">
                  <div className="border-line flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t pt-4">
                    <h2 className="type-subheading">
                      <span className="text-muted-foreground font-mono text-[13px]">
                        {String(index + 1).padStart(2, "0")}
                      </span>{" "}
                      {block.name}
                    </h2>
                    <Link
                      className="type-small text-brand-text focus-visible:ring-ring rounded-sm outline-none hover:underline focus-visible:ring-[3px]"
                      href={block.anchor}
                    >
                      Open on the page
                    </Link>
                    <p className="text-muted-foreground w-full font-mono text-[12px]">
                      {block.file}
                    </p>
                    <p className="text-muted-foreground type-small max-w-prose">
                      {block.note}
                    </p>
                  </div>
                </div>
                <div className="bg-paper text-ink mt-4 overflow-hidden">
                  {Block ? <Block /> : null}
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
