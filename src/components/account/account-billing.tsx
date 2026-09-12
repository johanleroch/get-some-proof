"use client";

import { AccountInvoices } from "./account-invoices";
import { AccountClosure } from "./account-closure";
import { OrganizationBilling } from "@/components/billing/organization-billing";
import Link from "next/link";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { BillingPageLoading } from "@/components/billing/billing-page-loading";

export function AccountBillingReconciliationView() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <PageHeader
        title="Account billing"
        description="One plan. Quotas shared across all your projects."
      />
      <section
        aria-labelledby="billing-setup-heading"
        className="bg-card space-y-4 rounded-lg border p-5"
        role="alert"
      >
        <h2 className="type-subheading" id="billing-setup-heading">
          Billing setup needs attention
        </h2>
        <p className="text-ink-2 text-sm">
          This Project is not connected to its Account billing record. Your
          Stripe subscription has not been changed.
        </p>
        <p className="text-ink-2 text-sm">
          Billing controls, invoices, and plan status will return after the
          Account record is restored.
        </p>
        <Button asChild variant="ghost">
          <Link href="/account/profile">Account profile</Link>
        </Button>
      </section>
    </main>
  );
}

function AccountBillingPlanSummary({
  account,
  accountControls,
  projects,
}: {
  account: NonNullable<FunctionReturnType<typeof api.accounts.getMine>> | null;
  accountControls: ReactNode;
  projects: FunctionReturnType<typeof api.organizations.listMine>;
}) {
  const pro = account?.effectivePlan === "premium";
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

export function AccountBilling() {
  const account = useQuery(api.accounts.getMine, {});
  const projects = useQuery(api.organizations.listMine, {});
  if (account === undefined || projects === undefined)
    return <BillingPageLoading />;
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
  if (!account && projects.length > 0) {
    return <AccountBillingReconciliationView />;
  }
  return (
    <AccountBillingPlanSummary
      account={account}
      accountControls={accountControls}
      projects={projects}
    />
  );
}
