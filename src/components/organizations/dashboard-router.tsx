"use client";

import { useEffect } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { BlobLoaderScreen } from "@/components/brand/blob-loader";

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

  return <FindingProjectScreen />;
}

/**
 * What `/dashboard` shows while it looks for the person's Brand: the same
 * blob as every other wait (DESIGN.md section 7), so the route loader before
 * it and this screen read as one moment, not two.
 */
export function FindingProjectScreen() {
  return <BlobLoaderScreen label="Finding your project…" />;
}
