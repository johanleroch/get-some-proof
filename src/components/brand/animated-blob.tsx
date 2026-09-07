import { useId } from "react";

import { cn } from "@/lib/utils";
import {
  animatedBlobSvg,
  blobAnimations,
  type BlobAnimation,
} from "@/lib/blob-animations";

export type AnimatedBlobVariant = BlobAnimation["name"];

/**
 * The mascot in motion, for loaders and moments (see DESIGN.md section 4 and
 * docs/design/app-icons/DESIGN.md 10.2). Decorative by default: pass a
 * `label` when the animation is the only thing telling the user something is
 * happening ("Uploading your video").
 */
export function AnimatedBlob({
  className,
  label,
  size = 96,
  variant = "breathe",
}: {
  className?: string;
  label?: string;
  size?: number;
  variant?: AnimatedBlobVariant;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const animation =
    blobAnimations.find((candidate) => candidate.name === variant) ??
    blobAnimations[0];
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("inline-block shrink-0 leading-none", className)}
      dangerouslySetInnerHTML={{
        __html: animatedBlobSvg(animation, { id: `${variant}-${id}`, size }),
      }}
      role={label ? "img" : undefined}
      style={{ width: size, height: size }}
    />
  );
}
