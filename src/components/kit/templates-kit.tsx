import Link from "next/link";
import { IconArrowLeft, IconExternalLink } from "@tabler/icons-react";

import { TemplatesGallery } from "@/components/templates/templates-gallery";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { templates } from "@/lib/templates-catalog";

/**
 * Development review of every template, drafts included, with the file and
 * status of each so the designer can open one, edit it, and decide when it
 * goes public. The same gallery component renders `/templates`.
 */
export function TemplatesKit() {
  const publicCount = templates.filter(
    (template) => template.status === "public",
  ).length;
  const draftCount = templates.length - publicCount;
  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="type-subheading">Templates</h1>
            <p className="text-muted-foreground type-small">
              {templates.length} templates, {publicCount} public, {draftCount}{" "}
              {draftCount === 1 ? "draft" : "drafts"}. Development only.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <a href="/kit">
              <IconArrowLeft aria-hidden="true" />
              Kit
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/templates">
              <IconExternalLink aria-hidden="true" />
              Public page
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-6">
        <p className="text-muted-foreground type-small max-w-prose">
          One file per template in{" "}
          <code className="font-mono text-[12px]">
            src/components/templates/
          </code>
          , listed in{" "}
          <code className="font-mono text-[12px]">
            src/lib/templates-catalog.ts
          </code>
          . Edit the file: it re-renders here, on the public page and in its
          full page. Set its status to{" "}
          <code className="font-mono text-[12px]">public</code> in the catalog
          to publish a draft.
        </p>
        <TemplatesGallery mode="kit" templates={templates} />
      </main>
    </div>
  );
}
