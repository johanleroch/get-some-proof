"use client";

import { AccountInvoices } from "./account-invoices";
import { AccountClosure } from "./account-closure";
import { OrganizationBilling } from "@/components/billing/organization-billing";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { BlobLoader } from "@/components/brand/blob-loader";

export function AccountBilling() {
  const account = useQuery(api.accounts.getMine, {});
  const projects = useQuery(api.organizations.listMine, {});
  if (account === undefined || projects === undefined)
    return <BlobLoader label="Loading account…" showLabel />;
  const pro = account?.effectivePlan === "premium";
  if (account?.deletionStartedAt !== undefined)
    return (
      <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <AccountClosure />
      </main>
    );
  const accountControls = account ? (
    <>
      <AccountInvoices
        key={account.id}
        canManageBilling={account.canManageSubscription}
      />
      <AccountClosure />
    </>
  ) : null;
  const billingProject = projects.find(
    ({ id }) => id === account?.freeProjectId,
  );
  if (billingProject) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <OrganizationBilling slug={billingProject.slug} />
        {accountControls}
      </div>
    );
  }
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <PageHeader
        title="Account billing"
        description="One plan. Quotas shared across all your projects."
      />
      <section className="bg-card space-y-4 rounded-lg border p-5">
        <h2 className="type-subheading">{pro ? "Pro" : "Free"} plan</h2>
        <p className="text-brand-text text-sm font-semibold">
          {pro
            ? "Unlimited projects · No extra cost per project"
            : `${projects.some(({ id }) => id === account?.freeProjectId) ? 1 : 0} / 1 active project · Unlimited projects with Pro`}
        </p>
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
          {projects.length === 0 ? (
            <Button asChild>
              <Link href="/onboarding">Create project</Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost">
            <Link href="/account/profile">Account profile</Link>
          </Button>
        </div>
      </section>
      {accountControls}
    </main>
  );
}
