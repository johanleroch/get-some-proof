import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card } from "@/components/ui/card";
import { productName } from "@/lib/brand";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="bg-muted/30 relative grid min-h-svh place-items-center px-5 py-16 sm:px-8">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>
      <section className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2 text-sm font-medium">
          <BrandMark />
          {productName}
        </div>
        <Card className="gap-5 shadow-xs">{children}</Card>
        <p className="text-muted-foreground mt-6 text-center text-xs leading-5">
          Secure authentication and Organization-scoped access.
        </p>
      </section>
    </main>
  );
}
