"use client";

import { BlobLoadingText } from "@/components/brand/blob-loader";

import { useEffect } from "react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconBuilding,
  IconCheck,
  IconChevronDown,
  IconCreditCard,
  IconPlus,
  IconSettings,
  IconShieldCheck,
} from "@tabler/icons-react";
import { usePaginatedQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { organizationSwitchRoute } from "@/lib/organization-switch-route";

function organizationInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

type OrganizationSwitcherProps = {
  canCreateProject?: boolean;
  canReadAudit: boolean;
  canReadBilling: boolean;
  canUpdateOrganization: boolean;
  currentLogoUrl?: string | null;
  currentName: string;
  currentSlug: string;
};

export function OrganizationSwitcher(props: OrganizationSwitcherProps) {
  const {
    results: organizations,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.organizations.listMinePage,
    {},
    { initialNumItems: 50 },
  );
  const pathname = usePathname();
  const router = useRouter();
  const { currentSlug } = props;

  useEffect(() => {
    if (
      status !== "Exhausted" ||
      organizations.some(({ slug }) => slug === currentSlug)
    ) {
      return;
    }

    if (organizations.length === 0) {
      router.replace("/onboarding");
      return;
    }

    router.replace(organizationSwitchRoute(pathname, organizations[0].slug));
  }, [currentSlug, organizations, pathname, router, status]);

  return (
    <OrganizationSwitcherView
      {...props}
      organizations={organizations}
      status={status}
      loadMore={() => loadMore(50)}
      switchProject={(slug) =>
        router.replace(organizationSwitchRoute(pathname, slug))
      }
    />
  );
}

export function OrganizationSwitcherView({
  canCreateProject = true,
  canReadAudit,
  canReadBilling,
  canUpdateOrganization,
  currentLogoUrl,
  currentName,
  currentSlug,
  organizations,
  status,
  loadMore,
  switchProject,
}: OrganizationSwitcherProps & {
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
  }>;
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  loadMore: () => void;
  switchProject: (slug: string) => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {/* The project's name is the sidebar's title, and the title is the
                switch: the project's own logo when it has one, the name in
                Gelica at `heading`, a thin chevron (DESIGN.md section 6).
                A project without a logo shows the name alone: no initials, no
                placeholder square, nothing to fill the hole. */}
            <button
              aria-label={`${currentName}, switch project`}
              className="hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent focus-visible:ring-ring -mx-1.5 flex max-w-[calc(100%+0.75rem)] cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-left outline-none focus-visible:ring-[3px]"
              type="button"
            >
              {/* The logo lands in the navigation's icon column (20px from
                  the panel) and the name in its label column (50px), so the
                  sidebar reads as one left rhythm rather than a title
                  staggered above the list. The 4px and 2px sit on top of the
                  button's own 4px gap. */}
              {currentLogoUrl ? (
                <Image
                  alt=""
                  className="mr-0.5 ml-1 size-6 shrink-0 rounded-md object-cover"
                  height={24}
                  src={currentLogoUrl}
                  unoptimized
                  width={24}
                />
              ) : null}
              <span className="type-heading min-w-0 truncate">
                {currentName}
              </span>
              <IconChevronDown
                aria-hidden="true"
                className="text-ink-3 mt-1 size-5 shrink-0"
                stroke={1.75}
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-64 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Projects
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {organizations?.map((organization) => {
                const active = organization.slug === currentSlug;
                return (
                  <DropdownMenuItem
                    key={organization.id}
                    onSelect={() => {
                      if (!active) {
                        switchProject(organization.slug);
                        if (isMobile) setOpenMobile(false);
                      }
                    }}
                  >
                    <Avatar className="size-6 rounded-md">
                      {organization.logoUrl ? (
                        <AvatarImage
                          alt={`${organization.name} logo`}
                          src={organization.logoUrl}
                        />
                      ) : null}
                      <AvatarFallback className="rounded-md text-[10px] font-medium">
                        {organizationInitials(organization.name) || "OR"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate">
                      {organization.name}
                    </span>
                    {active ? <IconCheck className="size-4" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
            {status === "CanLoadMore" || status === "LoadingMore" ? (
              <DropdownMenuItem
                disabled={status === "LoadingMore"}
                onSelect={(event) => {
                  event.preventDefault();
                  loadMore();
                }}
              >
                Load more projects
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {canUpdateOrganization ? (
                <DropdownMenuItem asChild>
                  <Link href={`/org/${currentSlug}/settings` as Route}>
                    <IconSettings />
                    Project settings
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {canReadAudit ? (
                <DropdownMenuItem asChild>
                  <Link href={`/org/${currentSlug}/audit` as Route}>
                    <IconShieldCheck />
                    Audit Log
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {canReadBilling ? (
                <DropdownMenuItem asChild>
                  <Link href={`/org/${currentSlug}/billing` as Route}>
                    <IconCreditCard />
                    Billing
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <Link
                  href={
                    (canCreateProject
                      ? "/projects/new"
                      : `/org/${currentSlug}/billing`) as Route
                  }
                >
                  <span className="grid size-6 place-items-center rounded-md border">
                    <IconPlus className="size-3.5" />
                  </span>
                  Create project
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            {status === "LoadingFirstPage" ? (
              <BlobLoadingText label="Loading Projects…" />
            ) : null}
            {status === "Exhausted" && organizations.length === 0 ? (
              <DropdownMenuItem asChild>
                <Link href={"/onboarding" as Route}>
                  <IconBuilding />
                  Create your first project
                </Link>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
