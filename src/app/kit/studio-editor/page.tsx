import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StudioEditorVariants } from "@/components/kit/studio-editor-variants";

export const metadata: Metadata = {
  title: "Studio editor variants",
};

export default function StudioEditorVariantsRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <StudioEditorVariants />;
}
