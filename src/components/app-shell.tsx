"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { BrandMark } from "@/components/brand-mark";
import { OrganizationSwitcher } from "@/components/organizations/organization-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type NavigationItem = {
  label: string;
  icon: typeof LayoutDashboard;
  href: Route;
  visible: boolean;
};

export function AppShell({
  children,
  organizationId,
  organizationName,
  organizationSlug,
}: {
  children: ReactNode;
  organizationId: Id<"organizations">;
  organizationName: string;
  organizationSlug: string;
}) {
  const pathname = usePathname();
  const authorization = useQuery(api.organizationAuthorization.getMine, {
    organizationId,
  });
  const health = useQuery(api.system.health);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    mobileCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        mobileTriggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const navigation: NavigationItem[] = [
    {
      label: "Overview",
      icon: LayoutDashboard,
      href: `/org/${organizationSlug}/dashboard` as Route,
      visible: true,
    },
    {
      label: "Projects",
      icon: FolderKanban,
      href: `/org/${organizationSlug}/projects` as Route,
      visible: true,
    },
    {
      label: "Members",
      icon: Users,
      href: `/org/${organizationSlug}/members` as Route,
      visible: true,
    },
    {
      label: "Audit Log",
      icon: ShieldCheck,
      href: `/org/${organizationSlug}/audit` as Route,
      visible: authorization?.can.readAudit ?? false,
    },
    {
      label: "Organization settings",
      icon: Settings,
      href: `/org/${organizationSlug}/settings` as Route,
      visible: authorization?.can.updateOrganization ?? false,
    },
    {
      label: "Account security",
      icon: UserRound,
      href: "/account/security" as Route,
      visible: true,
    },
  ];

  function navigationLinks(isCollapsed: boolean) {
    return navigation
      .filter(({ visible }) => visible)
      .map(({ href, icon: Icon, label }) => {
        const active = pathname === href;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
              active
                ? "bg-sidebar-accent text-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
              isCollapsed && "justify-center px-2",
            )}
            href={href}
            key={href}
            onClick={() => setMobileOpen(false)}
            title={isCollapsed ? label : undefined}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className={isCollapsed ? "sr-only" : undefined}>{label}</span>
          </Link>
        );
      });
  }

  return (
    <div className="bg-muted/35 min-h-screen">
      <aside
        className={cn(
          "border-sidebar-border bg-sidebar fixed inset-y-0 left-0 z-30 hidden border-r p-4 transition-[width] md:block",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <div className="flex min-h-14 items-start gap-3 px-1">
          <BrandMark />
          {!collapsed ? (
            <OrganizationSwitcher
              currentName={organizationName}
              currentSlug={organizationSlug}
            />
          ) : null}
        </div>
        <nav aria-label="Primary" className="mt-6 space-y-1">
          {navigationLinks(collapsed)}
        </nav>
        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="text-muted-foreground hover:bg-sidebar-accent focus-visible:ring-ring absolute right-4 bottom-4 grid size-10 place-items-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
          onClick={() => setCollapsed((value) => !value)}
          type="button"
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="size-4" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="size-4" />
          )}
        </button>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/45"
            onClick={() => setMobileOpen(false)}
            tabIndex={-1}
            type="button"
          />
          <aside
            aria-label="Mobile navigation"
            aria-modal="true"
            className="bg-sidebar relative h-full w-[min(88vw,20rem)] border-r p-5 shadow-2xl"
            id="mobile-navigation"
            role="dialog"
          >
            <div className="flex items-start gap-3">
              <BrandMark />
              <OrganizationSwitcher
                currentName={organizationName}
                currentSlug={organizationSlug}
              />
              <button
                aria-label="Close navigation"
                className="text-muted-foreground focus-visible:ring-ring grid size-10 shrink-0 place-items-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
                onClick={() => setMobileOpen(false)}
                ref={mobileCloseRef}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <nav aria-label="Primary" className="mt-8 space-y-1">
              {navigationLinks(false)}
            </nav>
          </aside>
        </div>
      ) : null}

      <div
        className={cn(
          "transition-[padding]",
          collapsed ? "md:pl-20" : "md:pl-64",
        )}
      >
        <header className="border-border bg-background/90 sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 backdrop-blur md:px-8">
          <button
            aria-controls="mobile-navigation"
            aria-expanded={mobileOpen}
            aria-label="Open navigation"
            className="text-muted-foreground focus-visible:ring-ring grid size-10 place-items-center rounded-lg focus-visible:ring-2 focus-visible:outline-none md:hidden"
            onClick={() => setMobileOpen(true)}
            ref={mobileTriggerRef}
            type="button"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
          <p className="truncate text-sm font-medium md:hidden">
            {organizationName}
          </p>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <Link
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring hidden rounded-md text-sm font-medium focus-visible:ring-2 focus-visible:outline-none sm:inline"
              href={"/account/security" as Route}
            >
              Account security
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-5 md:p-8">{children}</main>
        <span className="sr-only" aria-live="polite">
          {health?.status === "ok"
            ? "Convex connected"
            : "Connecting to Convex"}
        </span>
      </div>
    </div>
  );
}
