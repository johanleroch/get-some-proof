import type { ReactNode } from "react";
import { Activity } from "lucide-react";

import { Card } from "@/components/ui/card";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="bg-muted/35 grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="border-border bg-primary text-primary-foreground hidden border-r p-12 lg:flex lg:flex-col">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="grid size-9 place-items-center rounded-xl bg-white/15">
            <Activity aria-hidden="true" className="size-4" />
          </span>
          Convex Admin Starter
        </div>
        <div className="my-auto max-w-xl">
          <p className="text-primary-foreground/70 text-sm font-medium">
            Secure by construction
          </p>
          <p className="mt-4 text-4xl leading-tight font-semibold tracking-tight">
            Identity, tenancy, and permissions with one clean admin foundation.
          </p>
          <p className="text-primary-foreground/75 mt-5 max-w-lg text-base leading-7">
            Clone the starter, adapt the domain, and keep every Organization
            boundary enforced on the server.
          </p>
        </div>
      </section>
      <section className="grid place-items-center px-5 py-12 sm:px-8">
        <Card className="border-border/80 w-full max-w-md">{children}</Card>
      </section>
    </main>
  );
}
