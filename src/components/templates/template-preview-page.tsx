import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { sampleBrandName, sampleTestimonials } from "@/lib/template-samples";
import {
  type TemplateDefinition,
  templateCategoryLabel,
  type WallTheme,
} from "@/lib/templates-catalog";

import { PublicSiteFooter, PublicSiteHeader } from "./public-site-chrome";
import { TemplateRender } from "./template-registry";
import { TemplateStage } from "./template-stage";

/**
 * One template at full width, with the accent and wall theme the visitor
 * chose in the gallery carried over through the URL.
 */
export function TemplatePreviewPage({
  accentColor,
  template,
  theme,
}: {
  accentColor: string;
  template: TemplateDefinition;
  theme: WallTheme;
}) {
  return (
    <div className="bg-paper text-ink min-h-svh">
      <PublicSiteHeader
        action={
          <Button asChild size="sm">
            <Link
              href={{
                pathname: "/sign-up",
                query: { template: template.slug },
              }}
            >
              Use this template
            </Link>
          </Button>
        }
      />
      <main className="mx-auto max-w-[1280px] space-y-6 px-5 py-8 sm:px-8 lg:py-10">
        <Link
          className="type-ui text-ink-2 hover:text-ink focus-visible:ring-ring inline-flex min-h-11 items-center gap-1.5 rounded-md outline-none focus-visible:ring-[3px]"
          href="/templates"
        >
          <IconArrowLeft aria-hidden="true" className="size-4" />
          All templates
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="max-w-prose space-y-1.5">
            <p className="type-micro text-ink-2">
              {templateCategoryLabel(template.category)}
              {template.status === "draft" ? " · Draft" : ""}
            </p>
            <h1 className="type-display text-balance">{template.name}</h1>
            <p className="type-body text-ink-2">{template.description}</p>
          </div>
        </div>
        <TemplateStage
          accentColor={accentColor}
          centered={template.preview === "center"}
          className="rounded-lg border"
          theme={theme}
        >
          <TemplateRender
            accentColor={accentColor}
            brandName={sampleBrandName}
            slug={template.slug}
            testimonials={sampleTestimonials}
          />
        </TemplateStage>
        <p className="type-small text-ink-2">
          Shown with sample Testimonials from a fictional Brand. Yours will use
          your name, your customers and your color.
        </p>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
