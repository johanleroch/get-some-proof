"use client";

import {
  BlobToast,
  blobToast,
  type BlobToastType,
} from "@/components/brand/blob-toast";
import { Button } from "@/components/ui/button";

const samples: {
  type: BlobToastType;
  title: string;
  description?: string;
  action?: string;
}[] = [
  {
    type: "success",
    title: "Testimonial published.",
    description: "It is live on your Wall and in the embed.",
    action: "View the Wall",
  },
  {
    type: "info",
    title: "Your Wall updates within a minute.",
  },
  {
    type: "warning",
    title: "Three video credits left this month.",
    description: "Upgrade to keep collecting videos after that.",
    action: "See plans",
  },
  {
    type: "error",
    title: "Upload failed.",
    description: "Try a smaller file, or a stable connection.",
    action: "Retry",
  },
  {
    type: "loading",
    title: "Processing your video…",
    description: "This takes about a minute. You can leave this page.",
  },
];

/** Static examples of every toast kind, plus buttons that fire the real ones. */
export function BlobToasts() {
  return (
    <div className="space-y-5">
      <ul className="grid gap-5 lg:grid-cols-2">
        {samples.map((sample) => (
          <li className="bg-muted rounded-lg p-5" key={sample.type}>
            <p className="type-micro text-muted-foreground mb-4 uppercase">
              {sample.type}
            </p>
            <BlobToast
              action={
                sample.action
                  ? { label: sample.action, onClick: () => undefined }
                  : undefined
              }
              description={sample.description}
              onDismiss={() => undefined}
              title={sample.title}
              type={sample.type}
            />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground type-small mr-2">
          Fire the real ones:
        </span>
        {samples.map((sample) => (
          <Button
            key={sample.type}
            onClick={() => {
              const id = blobToast[sample.type](sample.title, {
                action: sample.action
                  ? { label: sample.action, onClick: () => undefined }
                  : undefined,
                description: sample.description,
              });
              if (sample.type === "loading") {
                window.setTimeout(() => blobToast.dismiss(id), 6000);
              }
            }}
            size="sm"
            variant="outline"
          >
            {sample.type}
          </Button>
        ))}
      </div>
    </div>
  );
}
