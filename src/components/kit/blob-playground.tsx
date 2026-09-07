"use client";

import { useState } from "react";

import { Blob, type BlobExpressionName } from "@/components/brand/blob";
import { blobExpressions, blobSvg } from "@/lib/blob-expressions";
import { cn } from "@/lib/utils";

/**
 * Click any expression in the strip: the big blob blinks into it. Whatever
 * it was showing before, the transition is the same, so the character never
 * snaps between two faces.
 */
export function BlobPlayground() {
  const [current, setCurrent] = useState<BlobExpressionName>("neutral");
  const expression =
    blobExpressions.find((candidate) => candidate.name === current) ??
    blobExpressions[0];

  return (
    <div className="bg-card rounded-lg border p-5">
      <div className="flex flex-col items-center gap-2 py-6">
        <Blob expression={current} label={expression.label} size={280} />
        <p className="type-subheading" aria-live="polite">
          {expression.label}
        </p>
        <p className="text-muted-foreground type-small">{expression.how}</p>
      </div>
      <ul
        aria-label="Pick an expression"
        className="flex flex-wrap items-center justify-center gap-2 rounded-md bg-[#1F1B18] p-4"
      >
        {blobExpressions.map((candidate) => {
          const active = candidate.name === current;
          return (
            <li key={candidate.name}>
              <button
                aria-label={candidate.label}
                aria-pressed={active}
                className={cn(
                  "focus-visible:ring-ring grid size-16 cursor-pointer place-items-center rounded-md transition-[background-color,translate] duration-150 outline-none hover:bg-white/10 focus-visible:ring-[3px] active:translate-y-px",
                  active && "bg-white/15",
                )}
                onClick={() => setCurrent(candidate.name)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="block"
                  dangerouslySetInnerHTML={{
                    __html: blobSvg(candidate, {
                      id: `strip-${candidate.name}`,
                      size: 52,
                    }),
                  }}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
