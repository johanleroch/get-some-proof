"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type Icon,
  IconArrowLeft,
  IconDashboard,
  IconFolder,
  IconLock,
  IconPlus,
  IconSettings,
  IconShieldCheck,
  IconUserCircle,
  IconUsers,
} from "@tabler/icons-react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { NavUser } from "@/components/account/nav-user";
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
  SidebarTrigger,
} from "@/components/ui/sidebar";

type NavigationItem = {
  label: string;
  icon: Icon;
  href: Route;
  visible: boolean;
};

type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

function Navigation({
  className,
  sections,
  pathname,
}: {
  className?: string;
  sections: NavigationSection[];
  pathname: string;
}) {
  return (
    <div className={className}>
      {sections.map((section) => {
        const visibleItems = section.items.filter(({ visible }) => visible);
        if (visibleItems.length === 0) return null;

        return (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map(({ href, icon: IconComponent, label }) => {
                  const active =
                    pathname === href ||
                    (pathname.startsWith(`${href}/`) && href !== "/");
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={label}
                      >
                        <Link
                          aria-current={active ? "page" : undefined}
                          href={href}
                        >
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
      })}
    </div>
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
  organizationLogoUrl,
  organizationName,
  organizationSlug,
}: {
  children: ReactNode;
  organizationId: Id<"organizations">;
  organizationLogoUrl?: string | null;
  organizationName: string;
  organizationSlug: string;
}) {
  const pathname = usePathname();
  const authorization = useQuery(api.organizationAuthorization.getMine, {
    organizationId,
  });
  const health = useQuery(api.system.health);
  const accountContext = pathname.startsWith("/account");
  const organizationContext =
    pathname === `/org/${organizationSlug}/settings` ||
    pathname === `/org/${organizationSlug}/audit`;

  const productNavigation: NavigationItem[] = [
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
  ];

  const organizationNavigation: NavigationItem[] = [
    {
      label: "Organization settings",
      icon: IconSettings,
      href: `/org/${organizationSlug}/settings` as Route,
      visible: authorization?.can.updateOrganization ?? false,
    },
    {
      label: "Audit Log",
      icon: IconShieldCheck,
      href: `/org/${organizationSlug}/audit` as Route,
      visible: authorization?.can.readAudit ?? false,
    },
  ];

  const accountNavigation: NavigationItem[] = [
    {
      label: "Profile",
      icon: IconUserCircle,
      href: "/account/profile" as Route,
      visible: true,
    },
    {
      label: "Security",
      icon: IconLock,
      href: "/account/security" as Route,
      visible: true,
    },
  ];

  const navigationSections: NavigationSection[] = accountContext
    ? [{ label: "Account", items: accountNavigation }]
    : organizationContext
      ? [{ label: "Organization", items: organizationNavigation }]
      : [
          { label: "Workspace", items: productNavigation.slice(0, 2) },
          { label: "Collaboration", items: productNavigation.slice(2) },
        ];
  const navigation = navigationSections.flatMap(({ items }) => items);
  const title = pageTitle(pathname, navigation);

  return (
    <SidebarProvider
      className="dashboard-frame h-svh overflow-hidden"
      style={
        {
          "--sidebar-width": "18rem",
          "--header-height": "3rem",
        } as CSSProperties
      }
    >
      <div aria-hidden="true" className="dashboard-frame-background" />
      <Sidebar collapsible="offcanvas" variant="inset">
        <div aria-hidden="true" className="dashboard-sidebar-effects">
          <div className="dashboard-surface-grain" />
        </div>
        <SidebarHeader>
          <OrganizationSwitcher
            canReadAudit={authorization?.can.readAudit ?? false}
            canUpdateOrganization={
              authorization?.can.updateOrganization ?? false
            }
            currentName={organizationName}
            currentLogoUrl={organizationLogoUrl}
            currentSlug={organizationSlug}
          />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="flex flex-col gap-2">
              <SidebarMenu>
                <SidebarMenuItem>
                  {accountContext || organizationContext ? (
                    <SidebarMenuButton asChild tooltip="Back to Overview">
                      <Link
                        href={`/org/${organizationSlug}/dashboard` as Route}
                      >
                        <IconArrowLeft />
                        <span>Back to Overview</span>
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      asChild
                      className="dashboard-primary-sidebar-action bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                      tooltip="Create a project"
                    >
                      <Link
                        href={
                          `/org/${organizationSlug}/projects?new=1` as Route
                        }
                      >
                        <IconPlus />
                        <span>New project</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <Navigation pathname={pathname} sections={navigationSections} />
        </SidebarContent>
        <SidebarFooter>
          <NavUser />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="dashboard-view border-border/70 min-h-0 overflow-hidden border shadow-2xl shadow-black/5 dark:shadow-black/30">
        <div aria-hidden="true" className="dashboard-view-effects">
          <div className="dashboard-surface-grain" />
        </div>
        <div className="dashboard-view-content flex min-h-0 flex-1 flex-col">
          <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
              <SidebarTrigger className="-ml-1" />
              <Separator
                className="mx-2 data-[orientation=vertical]:h-4"
                orientation="vertical"
              />
              <div className="min-w-0">
                <h1 className="text-foreground truncate text-[13px] leading-normal font-[510]">
                  {title}
                </h1>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <ThemeToggle />
              </div>
            </div>
          </header>
          <div className="flex flex-1 flex-col">
            <div className="@container/main mx-auto flex w-full max-w-[1600px] flex-1 flex-col">
              <div className="flex flex-1 flex-col gap-5 p-4 md:p-6 lg:p-8">
                {children}
              </div>
            </div>
          </div>
          <span className="sr-only" aria-live="polite">
            {health?.status === "ok"
              ? "Convex connected"
              : "Connecting to Convex"}
          </span>
        </div>
      </SidebarInset>
      <div
        aria-hidden="true"
        className="dashboard-shine dashboard-shine-frame dashboard-shine-sidebar"
      />
      <div
        aria-hidden="true"
        className="dashboard-shine dashboard-shine-view dashboard-shine-sidebar"
      />
      <div
        aria-hidden="true"
        className="dashboard-shine dashboard-shine-frame dashboard-shine-body"
      />
      <div
        aria-hidden="true"
        className="dashboard-shine dashboard-shine-view dashboard-shine-body"
      />
    </SidebarProvider>
  );
}
