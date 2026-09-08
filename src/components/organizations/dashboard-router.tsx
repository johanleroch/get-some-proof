"use client";

import { useEffect } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";

export function DashboardRouter() {
  const router = useRouter();
  const account = useQuery(api.accounts.getMine, {});
  const organizations = useQuery(api.organizations.listMine, {});

  useEffect(() => {
    if (!organizations || account === undefined) {
      return;
    }

    if (organizations.length === 0) {
      router.replace(account ? "/account/billing" : "/onboarding");
      return;
    }

    router.replace(`/org/${organizations[0].slug}/dashboard` as Route);
  }, [account, organizations, router]);

  return (
    <main className="bg-muted/30 grid min-h-svh place-items-center px-6">
      <div aria-live="polite" className="text-center">
        <div className="bg-brand-soft-2 mx-auto size-8 animate-pulse rounded-full" />
        <p className="text-muted-foreground mt-4 text-sm">
          Finding your project…
        </p>
      </div>
    </main>
  );
}
