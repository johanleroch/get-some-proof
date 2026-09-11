"use client";

import { useState } from "react";
import { IconArrowLeft, IconPlus } from "@tabler/icons-react";
import { useSearchParams } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { StudioTemplateChooser } from "@/components/studio/studio-template-chooser";
import { Button } from "@/components/ui/button";
import { StudioWidgetListSkeleton } from "@/components/ui/page-skeletons";
import {
  setStudioChoosingFilter,
  studioChoosingFromUrl,
} from "@/lib/studio-route-state";

export function StudioRouteLoading() {
  const searchParams = useSearchParams();
  const [choosing, setChoosing] = useState(() =>
    studioChoosingFromUrl(searchParams),
  );

  function choose(next: boolean) {
    setStudioChoosingFilter(next);
    setChoosing(next);
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-5 sm:p-8">
      <PageHeader
        actions={
          choosing ? (
            <Button onClick={() => choose(false)} variant="ghost">
              <IconArrowLeft className="size-4" />
              Your widgets
            </Button>
          ) : (
            <Button onClick={() => choose(true)}>
              <IconPlus className="size-4" />
              Create widget
            </Button>
          )
        }
        description={
          choosing
            ? "Start with a layout. Make it yours next."
            : "Your best proof, ready for every page."
        }
        title={choosing ? "Choose a template" : "Studio"}
      />
      {choosing ? (
        <>
          <p className="sr-only" role="status">
            Loading Studio. Templates will be available shortly.
          </p>
          <StudioTemplateChooser disabled onSelect={() => undefined} />
        </>
      ) : (
        <StudioWidgetListSkeleton />
      )}
    </div>
  );
}
