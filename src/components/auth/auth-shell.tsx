import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { WallFrames } from "@/components/doodles";
import { ThemeToggle } from "@/components/theme-toggle";
import { productDescription } from "@/lib/brand";

/**
 * Authentication layout (DESIGN.md section 6): from 1024px the form sits on
 * the left and a spot illustration on the right, the two columns following
 * the golden ratio (1 : 1.618) once the form column can keep 28rem. Below,
 * a single column with the scribble star above the title.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="bg-paper relative grid min-h-svh lg:grid-cols-[minmax(28rem,1fr)_minmax(0,1.618fr)]">
      <div className="absolute top-5 right-5 z-10">
        <ThemeToggle />
      </div>
      <section className="flex flex-col px-5 py-10 sm:px-8 lg:px-14 lg:py-12">
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col">
          <div className="mb-10">
            <BrandLogo />
          </div>
          <div className="my-auto w-full">{children}</div>
          <p className="type-small text-ink-2 mt-10 hidden lg:block">
            Secure Owner access to your Brand.
          </p>
        </div>
      </section>
      <aside className="bg-surface-2 hidden flex-col justify-center border-l p-12 lg:flex xl:p-20">
        <div className="mx-auto w-full max-w-xl space-y-10">
          <WallFrames className="text-ink w-full" float />
          <div className="max-w-md space-y-3">
            <p className="type-heading text-balance">
              Proof your customers are proud to give.
            </p>
            <p className="type-body text-ink-2">{productDescription}</p>
          </div>
        </div>
      </aside>
    </main>
  );
}
