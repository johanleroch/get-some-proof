"use client";

import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import {
  Activity,
  FolderKanban,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { OrganizationSwitcher } from "@/components/organizations/organization-switcher";

export function AppShell({
  children,
  organizationName,
  organizationSlug,
}: {
  children: ReactNode;
  organizationName: string;
  organizationSlug: string;
}) {
  const health = useQuery(api.system.health);
  const navigation = [
    {
      label: "Overview",
      icon: LayoutDashboard,
      href: `/org/${organizationSlug}/dashboard` as Route,
    },
    {
      label: "Projects",
      icon: FolderKanban,
      href: `/org/${organizationSlug}/projects` as Route,
    },
    {
      label: "Members",
      icon: Users,
      href: `/org/${organizationSlug}/members` as Route,
    },
  ];

  return (
    <div className="bg-muted/35 min-h-screen">
      <aside className="border-sidebar-border bg-sidebar fixed inset-y-0 left-0 hidden w-64 border-r p-5 md:block">
        <div className="flex items-center gap-3 px-2">
          <div className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-xl">
            <Activity aria-hidden="true" className="size-4" />
          </div>
          <OrganizationSwitcher
            currentName={organizationName}
            currentSlug={organizationSlug}
          />
        </div>
        <nav aria-label="Primary" className="mt-8 space-y-1">
          {navigation.map(({ href, icon: Icon, label }) => (
            <Link
              className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              href={href}
              key={href}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </Link>
          ))}
          <span className="text-muted-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm opacity-60">
            <ShieldCheck aria-hidden="true" className="size-4" />
            Audit log
          </span>
        </nav>
      </aside>
      <main className="md:pl-64">
        <header className="border-border bg-background/90 flex h-16 items-center border-b px-5 backdrop-blur md:px-8">
          <p className="text-sm font-medium md:hidden">Convex Admin</p>
          <p className="text-muted-foreground ml-auto text-sm">Setup preview</p>
        </header>
        <div className="mx-auto max-w-7xl p-5 md:p-8">{children}</div>
        <span className="sr-only" aria-live="polite">
          {health?.status === "ok"
            ? "Convex connected"
            : "Connecting to Convex"}
        </span>
      </main>
    </div>
  );
}
