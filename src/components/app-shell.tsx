"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { BrandMark } from "@/components/brand-mark";
import { OrganizationSwitcher } from "@/components/organizations/organization-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type NavigationItem = {
  label: string;
  icon: typeof LayoutDashboard;
  href: Route;
  visible: boolean;
};

function NavigationGroup({
  items,
  label,
  pathname,
}: {
  items: NavigationItem[];
  label: string;
  pathname: string;
}) {
  const visibleItems = items.filter(({ visible }) => visible);

  if (visibleItems.length === 0) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {visibleItems.map(({ href, icon: Icon, label: itemLabel }) => {
            const active = pathname === href;
            return (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={itemLabel}
                >
                  <Link aria-current={active ? "page" : undefined} href={href}>
                    <Icon aria-hidden="true" />
                    <span>{itemLabel}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

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

  const workspaceNavigation: NavigationItem[] = [
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
  ];

  const manageNavigation: NavigationItem[] = [
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

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "18rem",
          "--sidebar-width-icon": "3rem",
        } as CSSProperties
      }
    >
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <div className="flex min-h-12 items-start gap-2 p-1 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center">
            <BrandMark />
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <OrganizationSwitcher
                currentName={organizationName}
                currentSlug={organizationSlug}
              />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <NavigationGroup
            items={workspaceNavigation}
            label="Workspace"
            pathname={pathname}
          />
          <NavigationGroup
            items={manageNavigation}
            label="Manage"
            pathname={pathname}
          />
        </SidebarContent>
        <SidebarFooter>
          <div className="text-sidebar-foreground/65 flex items-center gap-2 px-2 py-1 text-xs group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-emerald-500"
            />
            <span className="group-data-[collapsible=icon]:sr-only">
              {health?.status === "ok" ? "Convex connected" : "Connecting"}
            </span>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear">
          <SidebarTrigger className="-ml-1" />
          <Separator className="mr-2 h-4" orientation="vertical" />
          <p className="min-w-0 truncate text-sm font-medium">
            {organizationName}
          </p>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col">
          <div className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-6">
            {children}
          </div>
        </div>
        <span className="sr-only" aria-live="polite">
          {health?.status === "ok"
            ? "Convex connected"
            : "Connecting to Convex"}
        </span>
      </SidebarInset>
    </SidebarProvider>
  );
}
