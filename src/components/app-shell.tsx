"use client";

import { type CSSProperties, type ReactNode, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type Icon,
  IconArrowLeft,
  IconArrowUpRight,
  IconCreditCard,
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
import { SidebarPlanCard } from "@/components/account/sidebar-plan-card";
import { OrganizationSwitcher } from "@/components/organizations/organization-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type NavigationItem = {
  label: string;
  icon: Icon;
  href: Route;
  visible: boolean;
  newTab?: boolean;
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
  {
    label: "Billing",
    icon: IconCreditCard,
    href: "/account/billing",
    visible: true,
  },
];

/** Mirrors `inboxCountCeiling` in convex/testimonialModeration.ts. */
const inboxCountCeiling = 500;
/** Item height and gap in px, mirrored by `h-9` and `gap-1` in the list. */
const navigationItemHeight = 36;
const navigationItemGap = 4;

function isActiveHref(pathname: string, href: string) {
  return pathname === href || (pathname.startsWith(`${href}/`) && href !== "/");
}

/**
 * The destinations under the project title: a quiet 18px icon, the name, and
 * the meaning on the right edge, the Inbox queue as a count and an arrow on
 * what opens in a new tab. No group labels: the title above says which
 * project, and the account pages carry their own way back. Chosen by the
 * founder on 2026-09-09 as a mix of two of six drafts (DESIGN.md section 7).
 *
 * The active item is not a style on the item but one indicator per list, an
 * amber soft pill with a 3px amber rail in the gutter, flush with the
 * panel's edge. Being one element, it travels: a click sends it to the new
 * item before the page arrives, and the route settles it (section 8.3).
 */
function Navigation({
  inboxCount,
  pathname,
  sections,
}: {
  inboxCount?: number;
  pathname: string;
  sections: NavigationSection[];
}) {
  const [pendingHref, setPendingHref] = useState<Route | null>(null);
  // A new pathname settles the optimistic move: derived during render, the
  // React pattern for state that follows props.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setPendingHref(null);
  }
  return sections.map((section) => {
    const items = section.items.filter(({ visible }) => visible);
    if (items.length === 0) return null;
    return (
      <SidebarGroup className="pt-1" key={section.label}>
        <SidebarGroupContent>
          <NavigationList
            inboxCount={inboxCount}
            items={items}
            onNavigate={setPendingHref}
            pathname={pathname}
            pendingHref={pendingHref}
          />
        </SidebarGroupContent>
      </SidebarGroup>
    );
  });
}

function NavigationList({
  inboxCount,
  items,
  onNavigate,
  pathname,
  pendingHref,
}: {
  inboxCount?: number;
  items: NavigationItem[];
  onNavigate: (href: Route) => void;
  pathname: string;
  pendingHref: Route | null;
}) {
  const { setOpenMobile } = useSidebar();
  const routeIndex = items.findIndex(({ href }) =>
    isActiveHref(pathname, href),
  );
  const pendingIndex = pendingHref
    ? items.findIndex(({ href }) => href === pendingHref)
    : -1;
  const activeIndex = pendingIndex >= 0 ? pendingIndex : routeIndex;
  // The indicator stretches only while it travels: a change of item starts
  // the travel, the end of its animation stops it.
  const [lastIndex, setLastIndex] = useState(activeIndex);
  const [travelling, setTravelling] = useState(false);
  if (activeIndex !== lastIndex) {
    setLastIndex(activeIndex);
    if (lastIndex >= 0 && activeIndex >= 0) setTravelling(true);
  }

  return (
    <SidebarMenu className="relative gap-1">
      {activeIndex >= 0 ? (
        <li
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-9 transition-transform duration-[var(--motion-settle)] ease-[var(--ease-settle)] motion-reduce:transition-none"
          data-slot="sidebar-active-indicator"
          style={{
            transform: `translateY(${activeIndex * (navigationItemHeight + navigationItemGap)}px)`,
          }}
        >
          <span
            className={cn(
              "absolute inset-0",
              travelling && "nav-indicator-travel",
            )}
            key={activeIndex}
            onAnimationEnd={() => setTravelling(false)}
          >
            <span className="bg-brand-soft absolute inset-0 rounded-md" />
            <span className="bg-brand absolute top-0 bottom-0 -left-2 w-[3px] rounded-r-full" />
          </span>
        </li>
      ) : null}
      {items.map(({ href, icon: IconComponent, label, newTab }, index) => {
        const active = index === activeIndex;
        const count = label === "Inbox" && inboxCount ? inboxCount : null;
        const shownCount = count
          ? count > inboxCountCeiling
            ? `${inboxCountCeiling}+`
            : String(count)
          : null;
        return (
          <SidebarMenuItem key={href}>
            <SidebarMenuButton
              asChild
              className="h-9 gap-3 px-3 data-[active=true]:bg-transparent data-[active=true]:hover:bg-transparent [&>svg]:size-[18px]"
              isActive={active}
              tooltip={label}
            >
              <Link
                aria-current={index === routeIndex ? "page" : undefined}
                aria-label={
                  shownCount ? `${label}, ${shownCount} to review` : undefined
                }
                href={href}
                onClick={(event) => {
                  if (newTab) return;
                  // A modified click opens elsewhere: this route stays.
                  if (
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey ||
                    event.button !== 0
                  ) {
                    return;
                  }
                  onNavigate(href);
                  setOpenMobile(false);
                }}
                rel={newTab ? "noopener noreferrer" : undefined}
                target={newTab ? "_blank" : undefined}
              >
                <IconComponent
                  aria-hidden="true"
                  className={active ? "text-ink" : "text-ink-2"}
                  stroke={1.75}
                />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {shownCount ? (
                  <span
                    className={cn(
                      "type-small grid h-5 min-w-5 shrink-0 place-items-center rounded-md px-2 font-semibold tabular-nums",
                      active
                        ? "bg-surface text-ink"
                        : "bg-surface-2 text-ink-2",
                    )}
                  >
                    {shownCount}
                  </span>
                ) : newTab ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "shrink-0",
                      active ? "text-ink-2" : "text-ink-3",
                    )}
                  >
                    <IconArrowUpRight className="size-4" />
                  </span>
                ) : null}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
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

type AppShellProps = {
  children: ReactNode;
  organizationId: Id<"organizations">;
  organizationLogoUrl?: string | null;
  organizationName: string;
  organizationPublicSlug: string;
  organizationSlug: string;
};

export function AppShell(props: AppShellProps) {
  const pathname = usePathname();
  const authorization = useQuery(api.organizationAuthorization.getMine, {
    organizationId: props.organizationId,
  });
  const health = useQuery(api.system.health);
  const account = useQuery(api.accounts.getMine, {});
  // The Inbox queue beside its name; only owners can read it.
  const inbox = useQuery(
    api.testimonialModeration.countInbox,
    authorization?.can.manageOwnership
      ? { organizationId: props.organizationId }
      : "skip",
  );
  return (
    <AppShellView
      {...props}
      pathname={pathname}
      account={account}
      inboxCount={inbox?.pending}
      authorization={authorization}
      connected={health?.status === "ok"}
      userMenu={<NavUser />}
      projectSwitcher={
        <OrganizationSwitcher
          canReadAudit={false}
          canReadBilling={false}
          canUpdateOrganization={authorization?.can.updateOrganization ?? false}
          canCreateProject={account?.effectivePlan === "premium"}
          currentName={props.organizationName}
          currentSlug={props.organizationSlug}
        />
      }
    />
  );
}

export function AppShellView({
  children,
  organizationId,
  organizationPublicSlug,
  organizationSlug,
  pathname,
  account,
  authorization,
  connected,
  inboxCount,
  userMenu,
  projectSwitcher,
}: AppShellProps & {
  pathname: string;
  inboxCount?: number;
  account?: {
    effectivePlan: "free" | "premium";
    freeProjectId: Id<"organizations"> | null;
  } | null;
  authorization?: {
    can: { manageOwnership: boolean; updateOrganization: boolean };
  } | null;
  connected: boolean;
  userMenu: ReactNode;
  projectSwitcher: ReactNode;
}) {
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
      newTab: true,
      icon: IconWorld,
      href: `/w/${organizationPublicSlug}` as Route,
      visible: true,
    },
    {
      label: "Project settings",
      icon: IconSettings,
      href: `/org/${organizationSlug}/settings` as Route,
      visible: authorization?.can.updateOrganization ?? false,
    },
  ];

  const navigationSections: NavigationSection[] = accountContext
    ? [
        {
          label: "Account",
          items: [
            {
              label: "Back to project",
              icon: IconArrowLeft,
              href: `/org/${organizationSlug}/dashboard` as Route,
              visible: true,
            },
            ...accountNavigation,
          ],
        },
      ]
    : [{ label: "Project", items: productNavigation }];
  const navigation = navigationSections.flatMap(({ items }) => items);
  const title = pageTitle(pathname, navigation);

  return (
    <SidebarProvider
      className="dashboard-frame h-svh overflow-hidden"
      style={
        {
          "--sidebar-width": "17rem",
          "--header-height": "3rem",
        } as CSSProperties
      }
    >
      <Sidebar
        className="group-data-[side=left]:border-r-0"
        collapsible="offcanvas"
        variant="sidebar"
      >
        <SidebarHeader className="px-4 pt-4 pb-1">
          {projectSwitcher}
        </SidebarHeader>
        <SidebarContent>
          <Navigation
            inboxCount={inboxCount}
            pathname={pathname}
            sections={navigationSections}
          />
        </SidebarContent>
        <SidebarFooter className="gap-3">
          {account?.effectivePlan === "free" ? <SidebarPlanCard /> : null}
          {userMenu}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="dashboard-view min-h-0 overflow-clip">
        <div className="dashboard-view-content flex min-h-0 flex-1 flex-col">
          <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
              <SidebarTrigger className="-ml-1" />
              <Separator
                className="mx-2 data-[orientation=vertical]:h-4"
                orientation="vertical"
              />
              <div className="min-w-0">
                <p className="text-ink-2 truncate text-sm font-medium tracking-[-0.008em]">
                  {title}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <ThemeToggle />
              </div>
            </div>
          </header>
          <div
            role="region"
            aria-label="Page content"
            tabIndex={0}
            className="min-h-0 flex-1 overflow-y-auto scroll-smooth motion-reduce:scroll-auto"
          >
            <div className="@container/main mx-auto flex w-full max-w-[1200px] flex-1 flex-col">
              <div className="flex flex-1 flex-col gap-6 p-5 md:p-8">
                {!accountContext &&
                account?.effectivePlan === "free" &&
                account.freeProjectId &&
                account.freeProjectId !== organizationId ? (
                  <section
                    className="bg-muted space-y-1 rounded-lg border p-4"
                    aria-label="Inactive project"
                  >
                    <h2 className="text-sm font-semibold">
                      This project is inactive
                    </h2>
                    <p className="text-ink-2 text-sm">
                      You can review your testimonials privately. Collection,
                      the public Wall, and embeds are disabled. Upgrade to Pro
                      to use all your projects again.
                    </p>
                  </section>
                ) : null}
                {children}
              </div>
            </div>
          </div>
          <span className="sr-only" aria-live="polite">
            {connected ? "Convex connected" : "Connecting to Convex"}
          </span>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
