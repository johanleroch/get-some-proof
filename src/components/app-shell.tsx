"use client";

import {
  Activity,
  FolderKanban,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Projects", icon: FolderKanban },
  { label: "Audit log", icon: ShieldCheck },
];

export function AppShell({
  organizationName = "Starter workspace",
}: {
  organizationName?: string;
}) {
  const health = useQuery(api.system.health);

  return (
    <div className="bg-muted/35 min-h-screen">
      <aside className="border-sidebar-border bg-sidebar fixed inset-y-0 left-0 hidden w-64 border-r p-5 md:block">
        <div className="flex items-center gap-3 px-2">
          <div className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-xl">
            <Activity aria-hidden="true" className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Convex Admin</p>
            <p className="text-muted-foreground truncate text-xs">
              {organizationName}
            </p>
          </div>
        </div>
        <nav aria-label="Primary" className="mt-8 space-y-1">
          {navigation.map(({ icon: Icon, label }, index) => (
            <span
              className={
                index === 0
                  ? "bg-sidebar-accent flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
                  : "text-muted-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
              }
              key={label}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </span>
          ))}
        </nav>
      </aside>
      <main className="md:pl-64">
        <header className="border-border bg-background/90 flex h-16 items-center border-b px-5 backdrop-blur md:px-8">
          <p className="text-sm font-medium md:hidden">Convex Admin</p>
          <p className="text-muted-foreground ml-auto text-sm">Setup preview</p>
        </header>
        <div className="mx-auto max-w-7xl p-5 md:p-8">
          <div className="mb-8">
            <p className="text-primary text-sm font-medium">Overview</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Your admin foundation is ready
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Authentication, Organizations, permissions, Projects, and audit
              activity will land here as the implementation tickets progress.
            </p>
          </div>
          <section
            aria-label="Setup status"
            className="grid gap-4 lg:grid-cols-3"
          >
            {[
              ["Next.js", "App Router shell"],
              [
                "Convex",
                health?.status === "ok" ? "Client connected" : "Connecting…",
              ],
              ["Security", "Pinned dependency baseline"],
            ].map(([title, description]) => (
              <div
                className="border-border bg-card rounded-2xl border p-5 shadow-sm"
                key={title}
              >
                <p className="text-sm font-medium">{title}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {description}
                </p>
              </div>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
