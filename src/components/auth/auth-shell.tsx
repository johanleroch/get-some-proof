import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";
import { ScribbleStar, WallFrames } from "@/components/doodles";
import { ThemeToggle } from "@/components/theme-toggle";
import { productDescription, productName } from "@/lib/brand";

/**
 * Authentication layout (DESIGN.md section 6): a split screen from 1024px
 * with one spot illustration on the left and a left-aligned form on the
 * right; a single column with the scribble star above the title below.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="bg-paper relative grid min-h-svh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="absolute top-5 right-5 z-10">
        <ThemeToggle />
      </div>
      <aside className="bg-surface-2 hidden flex-col justify-between border-r p-10 lg:flex xl:p-14">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-ink text-sm font-semibold tracking-[-0.008em]">
            {productName}
          </span>
        </div>
        <div className="max-w-md space-y-8">
          <WallFrames className="text-ink w-full max-w-xs" draw />
          <div className="space-y-3">
            <p className="type-heading text-balance">
              Proof your customers are proud to give.
            </p>
            <p className="type-body text-ink-2 max-w-prose">
              {productDescription}
            </p>
          </div>
        </div>
        <p className="type-small text-ink-2">
          Secure Owner access to your Brand.
        </p>
      </aside>
      <section className="flex flex-col px-5 py-10 sm:px-8 lg:px-16 lg:py-14 xl:px-24">
        <div className="mb-10 flex items-center gap-2.5 lg:hidden">
          <ScribbleStar className="text-brand size-8" />
          <span className="text-ink text-sm font-semibold tracking-[-0.008em]">
            {productName}
          </span>
        </div>
        <div className="my-auto w-full max-w-[400px]">{children}</div>
      </section>
    </main>
  );
}
