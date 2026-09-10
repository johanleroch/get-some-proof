"use client";

import { AccountInvoicesView } from "@/components/account/account-invoices";
import { AppShellView } from "@/components/app-shell";
import { NavUserView } from "@/components/account/nav-user";
import { OrganizationSwitcherView } from "@/components/organizations/organization-switcher";
import type { Id } from "@convex/_generated/dataModel";

import { BillingCockpit } from "./organization-billing";

export function BillingVisualFixture({
  availability,
  checkoutReturn = null,
  role,
  state = "missing",
}: {
  availability: "available" | "unavailable";
  checkoutReturn?: "success" | null;
  role: "admin" | "owner";
  state?: "missing" | "active" | "past_due" | "cancellation_scheduled";
}) {
  const premium =
    state === "active" ||
    state === "past_due" ||
    state === "cancellation_scheduled";
  return (
    <AppShellView
      organizationId={"fixture-billing" as Id<"organizations">}
      organizationName="Bumpr"
      organizationPublicSlug="bumpr"
      organizationSlug="bumpr"
      pathname="/org/bumpr/billing"
      account={{
        effectivePlan: premium ? "premium" : "free",
        freeProjectId: "fixture-billing" as Id<"organizations">,
      }}
      authorization={{
        can: {
          manageOwnership: role === "owner",
          updateOrganization: role === "owner",
        },
      }}
      connected
      userMenu={
        <NavUserView
          user={{ name: "Alex Morgan", email: "alex@example.test" }}
          signOut={async () => undefined}
        />
      }
      projectSwitcher={
        <OrganizationSwitcherView
          currentLogoUrl="/fixtures/bumpr-logo.svg"
          currentName="Bumpr"
          currentSlug="bumpr"
          canCreateProject={premium}
          canReadAudit={false}
          canReadBilling={false}
          canUpdateOrganization={role === "owner"}
          organizations={[
            {
              id: "fixture-billing",
              logoUrl: "/fixtures/bumpr-logo.svg",
              name: "Bumpr",
              slug: "bumpr",
            },
          ]}
          status="Exhausted"
          loadMore={() => undefined}
          switchProject={() => undefined}
        />
      }
    >
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <BillingCockpit
          checkoutReturn={checkoutReturn}
          navigateToCheckout={() => undefined}
          navigateToPortal={() => undefined}
          offers={
            availability === "available"
              ? [
                  {
                    amount: 2_900,
                    currency: "eur",
                    description:
                      "Unlimited text and video proof for growing brands.",
                    features: [
                      "Unlimited text collection",
                      "25 stored Ready videos",
                      "No Get Some Proof promo card",
                    ],
                    interval: "month",
                    lookupKey: "pro_monthly",
                    name: "Get Some Proof Pro",
                  },
                  {
                    amount: 29000,
                    currency: "eur",
                    interval: "year",
                    lookupKey: "pro_annual",
                    name: "Get Some Proof Pro",
                    description:
                      "Unlimited text collection and 25 stored Ready videos.",
                    features: [
                      "Unlimited text collection",
                      "25 stored Ready videos",
                      "No Get Some Proof promo card",
                    ],
                  },
                ]
              : undefined
          }
          onStartCheckout={async () => ({
            url: "https://checkout.stripe.example/session",
          })}
          onOpenPortal={async () => ({
            url: "https://billing.stripe.example/session",
          })}
          onUpdateContact={async () => undefined}
          onUpdateDowngradeSelection={async () => undefined}
          downgradePlan={
            state === "cancellation_scheduled"
              ? {
                  canManage: role === "owner",
                  scheduledFor: 1_799_999_999_000,
                  selectedTextIds: [],
                  selectedVideoIds: [],
                  textLimit: 13,
                  trigger: "scheduled_cancellation",
                  videoLimit: 2,
                }
              : null
          }
          downgradeCandidates={[
            ["video-1", "Alex Morgan", "video"],
            ["video-2", "Sam Rivera", "video"],
            ["video-3", "Taylor Chen", "video"],
            ["text-1", "Morgan Lee", "text"],
            ["text-2", "Jamie Smith", "text"],
          ].map(([id, name, type], index) => ({
            id: id as never,
            name,
            publishedAt: 1_799_000_000_000 - index * 86_400_000,
            type: type as "text" | "video",
          }))}
          subscriptionDetails={
            availability === "available" && state !== "missing"
              ? {
                  amount: 2_900,
                  currency: "eur",
                  interval: "month",
                }
              : undefined
          }
          overview={{
            availability,
            billingContact: "accounts@demo.example.invalid",
            canManage: role === "owner",
            effectivePlan: premium ? "premium" : "free",
            state: availability === "unavailable" ? "unavailable" : state,
            subscription:
              availability === "available" && state !== "missing"
                ? {
                    cancelAtPeriodEnd: state === "cancellation_scheduled",
                    currentPeriodEnd: 1_799_999_999,
                    priceRevision: "price-revision-fixture",
                    status:
                      state === "cancellation_scheduled" ? "active" : state,
                  }
                : null,
          }}
        />
        {role === "owner" && availability === "available" ? (
          <AccountInvoicesView
            canManageBilling
            onOpenPortal={async () => undefined}
            onLoadMore={() => undefined}
            onRetry={() => undefined}
            page={{
              invoices: [
                {
                  id: "in_fixture",
                  number: "GSP-2026-0042",
                  created: 1788825600,
                  amount: 29000,
                  currency: "eur",
                  status: "paid",
                  pdfUrl: "https://invoice.stripe.com/i/fixture/pdf",
                  hostedUrl: null,
                },
              ],
              nextCursor: null,
            }}
          />
        ) : null}
      </div>
    </AppShellView>
  );
}
