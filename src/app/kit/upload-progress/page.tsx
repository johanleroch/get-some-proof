import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { UploadProgressLab } from "@/components/kit/upload-progress-lab";

export const metadata: Metadata = {
  title: "Upload wait",
};

export default function UploadProgressLabRoute() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <UploadProgressLab />;
}
