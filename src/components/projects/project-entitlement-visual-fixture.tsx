"use client";

import { CreditCard, FolderKanban, LayoutDashboard } from "lucide-react";

import { PremiumProjectNotice } from "./project-manager";

export function ProjectEntitlementVisualFixture() {
  return (
    <div className="bg-muted/30 min-h-svh p-3 md:p-6">
      <div className="bg-background mx-auto grid min-h-[calc(100svh-1.5rem)] max-w-[1440px] overflow-hidden rounded-2xl border shadow-xl md:min-h-[calc(100svh-3rem)] md:grid-cols-[15rem_1fr]">
        <aside className="bg-card hidden border-r p-5 md:block">
          <div className="mb-8">
            <p className="text-sm font-semibold">Demo Company</p>
            <p className="text-muted-foreground mt-1 text-xs">Owner preview</p>
          </div>
          <nav aria-label="Organization preview" className="space-y-1 text-sm">
            <div className="text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-2">
              <LayoutDashboard aria-hidden="true" className="size-4" />
              Overview
            </div>
            <div className="bg-accent flex items-center gap-2 rounded-lg px-3 py-2 font-medium">
              <FolderKanban aria-hidden="true" className="size-4" />
              Projects
            </div>
            <div className="text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-2">
              <CreditCard aria-hidden="true" className="size-4" />
              Billing
            </div>
          </nav>
        </aside>
        <main className="p-4 md:p-8">
          <div>
            <h1 className="dashboard-page-title">Projects</h1>
            <p className="dashboard-page-description mt-1 max-w-2xl">
              Tenant-scoped Projects for the active Organization.
            </p>
          </div>
          <PremiumProjectNotice
            canManageBilling
            canReadBilling
            organizationSlug="demo-company"
          />
          <section className="bg-card mt-6 overflow-hidden rounded-xl border shadow-xs">
            <div className="grid gap-2 border-b px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <h2 className="font-medium">Website launch</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Existing Project remains readable on Free.
                </p>
              </div>
              <span className="bg-muted w-fit rounded-full px-2.5 py-1 text-xs">
                Active
              </span>
            </div>
            <div className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <h2 className="font-medium">Customer portal</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Read access is preserved for every authorized Member.
                </p>
              </div>
              <span className="bg-muted w-fit rounded-full px-2.5 py-1 text-xs">
                Archived
              </span>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
