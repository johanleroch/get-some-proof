"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type Icon,
  IconArrowLeft,
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
import { BrandMark } from "@/components/brand-mark";
import { OrganizationSwitcher } from "@/components/organizations/organization-switcher";
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
  useSidebar,
} from "@/components/ui/sidebar";

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

function Navigation({
  className,
  sections,
  pathname,
}: {
  className?: string;
  sections: NavigationSection[];
  pathname: string;
}) {
  const { setOpenMobile } = useSidebar();
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
                {visibleItems.map(
                  ({ href, icon: IconComponent, label, newTab }) => {
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
                            onClick={() => {
                              if (!newTab) setOpenMobile(false);
                            }}
                            target={newTab ? "_blank" : undefined}
                            rel={newTab ? "noopener noreferrer" : undefined}
                          >
                            {active ? (
                              <span
                                aria-hidden="true"
                                className="bg-brand absolute top-1.5 bottom-1.5 -left-2 w-[3px] rounded-full"
                              />
                            ) : null}
                            <IconComponent aria-hidden="true" />
                            <span>{label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  },
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}
    </div>
  );
}

/**
 * Below 768px the sidebar is a sheet, so the page needs a way in: one 48px
 * bar with the menu button and the brand mark, nothing else. On desktop the
 * sidebar is always there and the page header is the top of the page, so
 * there is no bar at all (DESIGN.md section 6); ⌘B folds the sidebar. Hidden
 * by CSS rather than by the mobile hook, so a phone never sees the page
 * jump down once the bar hydrates in.
 */
function MobileBar() {
  return (
    <header className="border-line flex h-12 shrink-0 items-center gap-1 border-b px-2 md:hidden">
      <SidebarTrigger className="size-11 [&_svg]:size-5" />
      <BrandMark className="size-7" />
    </header>
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
  return (
    <AppShellView
      {...props}
      pathname={pathname}
      account={account}
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
          currentLogoUrl={props.organizationLogoUrl}
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
  userMenu,
  projectSwitcher,
}: AppShellProps & {
  pathname: string;
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
  return (
    <SidebarProvider
      className="dashboard-frame h-svh overflow-hidden"
      style={{ "--sidebar-width": "16.25rem" } as CSSProperties}
    >
      <Sidebar collapsible="offcanvas" variant="sidebar">
        <SidebarHeader>{projectSwitcher}</SidebarHeader>
        <SidebarContent>
          <Navigation pathname={pathname} sections={navigationSections} />
        </SidebarContent>
        <SidebarFooter className="border-line gap-3 border-t pt-3">
          {account ? (
            <div className="flex flex-wrap items-center justify-between gap-2 px-2">
              <span className="bg-brand-soft text-brand-text inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold">
                {account.effectivePlan === "premium" ? "Pro plan" : "Free plan"}
              </span>
              <Link
                className="text-brand-text text-xs font-semibold hover:underline"
                href="/account/billing"
              >
                {account.effectivePlan === "premium"
                  ? "Manage subscription"
                  : "Upgrade to Pro"}
              </Link>
            </div>
          ) : null}
          {userMenu}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="dashboard-view min-h-0 overflow-clip">
        <div className="dashboard-view-content flex min-h-0 flex-1 flex-col">
          <MobileBar />
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
