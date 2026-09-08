"use client";

import { useState } from "react";
import { IconRefresh } from "@tabler/icons-react";

import { BlobToast } from "@/components/brand/blob-toast";
import { Button } from "@/components/ui/button";
import {
  durationTokens,
  easeCss,
  easeOvershoot,
  easePath,
  easeTokens,
} from "@/lib/motion-tokens";

/**
 * The motion vocabulary of DESIGN.md section 8, side by side: every curve
 * plotted, every curve replayed on the same travel so they can be compared by
 * eye, and the toast entrance replayed in place. Development only.
 */
export function MotionShowcase() {
  const [run, setRun] = useState(0);

  return (
    <div className="space-y-8" key={run}>
      <style>{`
        @keyframes kit-travel {
          from { transform: translateX(0); }
          to { transform: translateX(var(--kit-travel, 160px)); }
        }
      `}</style>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setRun((value) => value + 1)} variant="outline">
          <IconRefresh aria-hidden="true" />
          Replay
        </Button>
        <p className="text-muted-foreground type-small">
          Every curve runs the same 160px travel over 600ms, so the difference
          is the hand, not the distance. The percentage is how far past the mark
          the curve travels before settling: below 3 the eye reads it as linear.
        </p>
      </div>

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {easeTokens.map((token) => {
          const overshoot = easeOvershoot(token);
          return (
            <li
              className="bg-card space-y-4 rounded-lg border p-4"
              key={token.variable}
            >
              <div className="flex items-start gap-4">
                <svg
                  aria-hidden="true"
                  className="text-brand size-24 shrink-0"
                  fill="none"
                  viewBox="-13 -13 126 126"
                >
                  <rect
                    height="100"
                    rx="2"
                    stroke="var(--line)"
                    strokeDasharray="4 4"
                    width="100"
                    x="0"
                    y="0"
                  />
                  <path
                    d={easePath(token)}
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="4"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="type-ui">{token.label}</p>
                    {overshoot > 0 ? (
                      <p className="text-ink-2 font-mono text-[11px] tabular-nums">
                        +{overshoot}%
                      </p>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground type-small">
                    {token.use}
                  </p>
                  <p className="text-muted-foreground truncate font-mono text-[11px]">
                    {token.variable}
                  </p>
                </div>
              </div>
              <div className="bg-surface-2 relative h-11 overflow-hidden rounded-md">
                <span
                  aria-hidden="true"
                  className="bg-brand absolute top-1/2 left-2 size-7 -translate-y-1/2 rounded-full"
                  style={{
                    animation: `kit-travel 600ms ${easeCss(token)} both`,
                  }}
                />
              </div>
              <p className="text-muted-foreground font-mono text-[11px]">
                {easeCss(token)}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="max-w-prose">
            <h3 className="type-subheading">Squash and stretch</h3>
            <p className="text-muted-foreground type-small mt-1">
              The toast entrance, replayed in place: the bubble arrives
              stretched along its travel and squashes as it lands, the mascot
              hops in 70ms later on its base, then blinks into the expression of
              the message. Volume is preserved in both squashes.
            </p>
          </div>
          <div className="bg-surface-2 rounded-lg border p-4">
            <BlobToast
              description="Two people already saw it on your Wall."
              title="Testimonial published."
              type="success"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="max-w-prose">
            <h3 className="type-subheading">Durations</h3>
            <p className="text-muted-foreground type-small mt-1">
              Enter and exit are never symmetric: arriving takes its time and
              settles, leaving is gone before it is noticed.
            </p>
          </div>
          <div className="bg-card overflow-hidden rounded-lg border">
            <table className="w-full text-left">
              <thead className="text-muted-foreground type-small border-b">
                <tr>
                  <th className="px-3 py-2 font-medium">Token</th>
                  <th className="px-3 py-2 font-medium">Value</th>
                  <th className="px-3 py-2 font-medium">Use</th>
                </tr>
              </thead>
              <tbody className="type-ui">
                {durationTokens.map((token) => (
                  <tr className="border-b last:border-0" key={token.variable}>
                    <td className="px-3 py-2 font-mono text-xs">
                      {token.variable}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums">
                      {token.value}
                    </td>
                    <td className="text-muted-foreground px-3 py-2">
                      {token.use}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
