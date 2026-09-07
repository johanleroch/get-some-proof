import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TemplatePreviewPage } from "@/components/templates/template-preview-page";
import {
  defaultAccent,
  isHexColor,
  isWallTheme,
  templateBySlug,
} from "@/lib/templates-catalog";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Drafts are reachable in development only, so the kit can open them. */
function visibleTemplate(slug: string) {
  const template = templateBySlug(slug);
  if (!template) return null;
  if (template.status === "draft" && process.env.NODE_ENV === "production") {
    return null;
  }
  return template;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const template = visibleTemplate((await params).slug);
  if (!template) {
    return { robots: { follow: false, index: false }, title: "Template" };
  }
  return {
    description: template.description,
    robots: { follow: true, index: false },
    title: `${template.name} template`,
  };
}

export default async function TemplatePreviewRoute({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const template = visibleTemplate(slug);
  if (!template) notFound();

  const query = await searchParams;
  const accent = isHexColor(query.accent) ? query.accent : defaultAccent;
  const theme = isWallTheme(query.theme) ? query.theme : "light";

  return (
    <TemplatePreviewPage
      accentColor={accent}
      template={template}
      theme={theme}
    />
  );
}
