"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Icon,
  IconDashboard,
  IconFolder,
  IconPlus,
  IconSettings,
  IconShieldCheck,
  IconUsers,
} from "@tabler/icons-react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { NavUser } from "@/components/account/nav-user";
import { OrganizationSwitcher } from "@/components/organizations/organization-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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
  icon: Icon;
  href: Route;
  visible: boolean;
};

function Navigation({
  className,
  items,
  pathname,
}: {
  className?: string;
  items: NavigationItem[];
  pathname: string;
}) {
  const visibleItems = items.filter(({ visible }) => visible);

  if (visibleItems.length === 0) return null;

  return (
    <SidebarGroup className={className}>
      <SidebarGroupContent>
        <SidebarMenu>
          {visibleItems.map(({ href, icon: IconComponent, label }) => {
            const active =
              pathname === href ||
              (pathname.startsWith(`${href}/`) && href !== "/");
            return (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton asChild isActive={active} tooltip={label}>
                  <Link aria-current={active ? "page" : undefined} href={href}>
                    <IconComponent aria-hidden="true" />
                    <span>{label}</span>
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

function pageTitle(pathname: string, items: NavigationItem[]) {
  return (
    items.find(
      ({ href }) =>
        pathname === href || (pathname.startsWith(`${href}/`) && href !== "/"),
    )?.label ?? "Dashboard"
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

  const mainNavigation: NavigationItem[] = [
    {
      label: "Overview",
      icon: IconDashboard,
      href: `/org/${organizationSlug}/dashboard` as Route,
      visible: true,
    },
    {
      label: "Projects",
      icon: IconFolder,
      href: `/org/${organizationSlug}/projects` as Route,
      visible: true,
    },
    {
      label: "Members",
      icon: IconUsers,
      href: `/org/${organizationSlug}/members` as Route,
      visible: true,
    },
    {
      label: "Audit Log",
      icon: IconShieldCheck,
      href: `/org/${organizationSlug}/audit` as Route,
      visible: authorization?.can.readAudit ?? false,
    },
  ];

  const secondaryNavigation: NavigationItem[] = [
    {
      label: "Organization settings",
      icon: IconSettings,
      href: `/org/${organizationSlug}/settings` as Route,
      visible: authorization?.can.updateOrganization ?? false,
    },
  ];

  const allNavigation = [...mainNavigation, ...secondaryNavigation];
  const title = pageTitle(pathname, allNavigation);

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "18rem",
          "--header-height": "3rem",
        } as CSSProperties
      }
    >
      <Sidebar collapsible="offcanvas" variant="inset">
        <SidebarHeader>
          <OrganizationSwitcher
            currentName={organizationName}
            currentSlug={organizationSlug}
          />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="flex flex-col gap-2">
              <SidebarMenu>
                <SidebarMenuItem className="flex items-center gap-2">
                  <SidebarMenuButton
                    asChild
                    className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                    tooltip="Create a project"
                  >
                    <Link
                      href={`/org/${organizationSlug}/projects?new=1` as Route}
                    >
                      <IconPlus />
                      <span>New project</span>
                    </Link>
                  </SidebarMenuButton>
                  {authorization?.can.updateOrganization ? (
                    <Button
                      aria-label="Organization settings"
                      asChild
                      className="size-8 shrink-0"
                      size="icon"
                      variant="outline"
                    >
                      <Link href={`/org/${organizationSlug}/settings` as Route}>
                        <IconSettings />
                      </Link>
                    </Button>
                  ) : null}
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <Navigation items={mainNavigation} pathname={pathname} />
          <Navigation
            className="mt-auto"
            items={secondaryNavigation}
            pathname={pathname}
          />
        </SidebarContent>
        <SidebarFooter>
          <NavUser />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
          <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator
              className="mx-2 data-[orientation=vertical]:h-4"
              orientation="vertical"
            />
            <div className="min-w-0">
              <h1 className="truncate text-base font-medium">{title}</h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col">
          <div className="@container/main mx-auto flex w-full max-w-[1600px] flex-1 flex-col">
            <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
              {children}
            </div>
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
