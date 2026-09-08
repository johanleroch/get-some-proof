import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ThumbnailDialogVariants } from "@/components/kit/thumbnail-dialog-variants";

export const metadata: Metadata = {
  title: "Thumbnail dialog kit",
};

export default function ThumbnailDialogKitRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <ThumbnailDialogVariants />;
}
