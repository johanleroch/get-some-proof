"use client";

import { CreditCard, LayoutDashboard, Settings } from "lucide-react";

import { BillingCockpit } from "./organization-billing";

export function BillingVisualFixture({
  availability,
  role,
  state = "missing",
}: {
  availability: "available" | "unavailable";
  role: "admin" | "owner";
  state?: "missing" | "active" | "past_due" | "cancellation_scheduled";
}) {
  const premium =
    state === "active" ||
    state === "past_due" ||
    state === "cancellation_scheduled";
  return (
    <div className="bg-muted/30 min-h-svh p-3 md:p-6">
      <div className="bg-background mx-auto grid min-h-[calc(100svh-1.5rem)] max-w-[1440px] overflow-hidden rounded-2xl border shadow-xl md:min-h-[calc(100svh-3rem)] md:grid-cols-[15rem_1fr]">
        <aside className="bg-card hidden border-r p-5 md:block">
          <div className="mb-8">
            <p className="text-sm font-semibold">Demo Company</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {role === "owner" ? "Owner" : "Admin"} preview
            </p>
          </div>
          <nav aria-label="Organization preview" className="space-y-1 text-sm">
            <div className="text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-2">
              <LayoutDashboard aria-hidden="true" className="size-4" />
              Overview
            </div>
            <div className="text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-2">
              <Settings aria-hidden="true" className="size-4" />
              Organization settings
            </div>
            <div className="bg-accent flex items-center gap-2 rounded-lg px-3 py-2 font-medium">
              <CreditCard aria-hidden="true" className="size-4" />
              Billing
            </div>
          </nav>
        </aside>
        <main className="p-4 md:p-8">
          <BillingCockpit
            navigateToCheckout={() => undefined}
            navigateToPortal={() => undefined}
            offers={
              availability === "available"
                ? [
                    {
                      amount: 4_900,
                      currency: "eur",
                      interval: "month",
                      lookupKey: "premium_monthly",
                    },
                    {
                      amount: 49_000,
                      currency: "eur",
                      interval: "year",
                      lookupKey: "premium_annual",
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
            subscriptionDetails={
              availability === "available" && state !== "missing"
                ? { amount: 4_900, currency: "eur", interval: "month" }
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
        </main>
      </div>
    </div>
  );
}
