"use client";

import { AccountClosure } from "./account-closure";
import { useState } from "react";
import Link from "next/link";
import { useAction, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ErrorToast } from "@/components/ui/error-toast";
import { BlobLoader } from "@/components/brand/blob-loader";

export function AccountBilling() {
  const account = useQuery(api.accounts.getMine, {});
  const projects = useQuery(api.organizations.listMine, {});
  const openPortal = useAction(api.billingActions.openAccountPortal);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (account === undefined || projects === undefined)
    return <BlobLoader label="Loading account…" showLabel />;
  const pro = account?.effectivePlan === "premium";
  async function manage() {
    setPending(true);
    setError(null);
    try {
      const { url } = await openPortal({});
      window.location.assign(url);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to open billing.",
      );
      setPending(false);
    }
  }
  if (account?.deletionStartedAt !== undefined)
    return (
      <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <AccountClosure />
      </main>
    );
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <PageHeader
        title="Account billing"
        description="One plan. Quotas shared across all your projects."
      />
      <section className="bg-card space-y-4 rounded-lg border p-5">
        <h2 className="type-subheading">{pro ? "Pro" : "Free"} plan</h2>
        {account ? (
          <p className="text-ink-2 text-sm">
            {pro
              ? `${account.usage.readyVideos} / 25 videos stored · Unlimited text collection`
              : `${account.usage.freeTextUsed} / 13 text credits used · ${account.usage.freeVideoUsed} / 2 video credits used`}
          </p>
        ) : null}
        {projects.length === 0 ? (
          <p className="text-ink-2 text-sm">
            You have no projects. Your account and subscription remain
            available.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          {account?.canManageSubscription ? (
            <Button
              loading={pending}
              onClick={() => void manage()}
              variant="outline"
            >
              Manage subscription
            </Button>
          ) : null}
          <Button asChild>
            <Link
              href={
                projects[0] ? `/org/${projects[0].slug}/billing` : "/onboarding"
              }
            >
              {projects[0]
                ? pro
                  ? "View plan details"
                  : "Upgrade to Pro"
                : "Create project"}
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/account/profile">Account profile</Link>
          </Button>
        </div>
        {error ? <ErrorToast message={error} /> : null}
      </section>
      {account ? <AccountClosure /> : null}
    </main>
  );
}
