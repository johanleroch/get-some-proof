"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type Icon,
  IconDashboard,
  IconInbox,
  IconLock,
  IconSettings,
  IconUserCircle,
  IconWorld,
} from "@tabler/icons-react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { NavUser } from "@/components/account/nav-user";
import { BrandMark } from "@/components/brand-mark";
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
  organizationPublicSlug,
  organizationSlug,
}: {
  children: ReactNode;
  organizationId: Id<"organizations">;
  organizationLogoUrl?: string | null;
  organizationName: string;
  organizationPublicSlug: string;
  organizationSlug: string;
}) {
  const pathname = usePathname();
  const authorization = useQuery(api.organizationAuthorization.getMine, {
    organizationId,
  });
  const health = useQuery(api.system.health);
  const accountContext = pathname.startsWith("/account");
  const productNavigation: NavigationItem[] = [
    {
      label: "Overview",
      icon: IconDashboard,
      href: `/org/${organizationSlug}/dashboard` as Route,
      visible: true,
    },
    {
      label: "Inbox",
      icon: IconInbox,
      href: `/org/${organizationSlug}/inbox` as Route,
      visible: authorization?.can.manageOwnership ?? false,
    },
    {
      label: "Public Wall",
      icon: IconWorld,
      href: `/w/${organizationPublicSlug}` as Route,
      visible: true,
    },
    {
      label: "Brand settings",
      icon: IconSettings,
      href: `/org/${organizationSlug}/settings` as Route,
      visible: authorization?.can.updateOrganization ?? false,
    },
  ];

  const navigationSections: NavigationSection[] = accountContext
    ? [{ label: "Account", items: accountNavigation }]
    : [{ label: "Workspace", items: productNavigation }];
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
        <div aria-hidden="true" className="dashboard-sidebar-effects" />
        <SidebarHeader>
          <Link
            aria-label={organizationName}
            className="hover:bg-sidebar-accent flex min-w-0 items-center gap-3 rounded-lg p-2 transition-colors"
            href={`/org/${organizationSlug}/dashboard` as Route}
          >
            {organizationLogoUrl ? (
              <Image
                alt=""
                className="size-8 rounded-lg object-cover"
                height={32}
                src={organizationLogoUrl}
                unoptimized
                width={32}
              />
            ) : (
              <BrandMark />
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {organizationName}
              </span>
              <span className="text-muted-foreground block truncate text-xs">
                /c/{organizationPublicSlug}
              </span>
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <Navigation pathname={pathname} sections={navigationSections} />
        </SidebarContent>
        <SidebarFooter>
          <NavUser />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="dashboard-view border-border/70 min-h-0 overflow-hidden border shadow-2xl shadow-black/5 dark:shadow-black/30">
        <div aria-hidden="true" className="dashboard-view-effects" />
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
