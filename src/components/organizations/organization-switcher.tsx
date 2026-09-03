"use client";

import { useEffect } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconBuilding,
  IconCheck,
  IconCreditCard,
  IconPlus,
  IconSelector,
  IconSettings,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useQuery } from "convex/react";

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
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { productName } from "@/lib/brand";
import { organizationSwitchRoute } from "@/lib/organization-switch-route";

function organizationInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function OrganizationSwitcher({
  canReadAudit,
  canReadBilling,
  canUpdateOrganization,
  currentName,
  currentLogoUrl,
  currentSlug,
}: {
  canReadAudit: boolean;
  canReadBilling: boolean;
  canUpdateOrganization: boolean;
  currentName: string;
  currentLogoUrl?: string | null;
  currentSlug: string;
}) {
  const organizations = useQuery(api.organizations.listMine, {});
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile } = useSidebar();

  useEffect(() => {
    if (
      !organizations ||
      organizations.some(({ slug }) => slug === currentSlug)
    ) {
      return;
    }

    if (organizations.length === 0) {
      router.replace("/onboarding");
      return;
    }

    router.replace(organizationSwitchRoute(pathname, organizations[0].slug));
  }, [currentSlug, organizations, pathname, router]);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              aria-label="Switch Organization"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              size="lg"
            >
              <Avatar className="size-8 rounded-lg">
                {currentLogoUrl ? (
                  <AvatarImage
                    alt={`${currentName} logo`}
                    src={currentLogoUrl}
                  />
                ) : null}
                <AvatarFallback className="bg-foreground text-background rounded-lg text-xs font-semibold">
                  {organizationInitials(currentName) || "OR"}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{currentName}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {productName}
                </span>
              </div>
              <IconSelector className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-64 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Organizations
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {organizations?.map((organization) => {
                const active = organization.slug === currentSlug;
                return (
                  <DropdownMenuItem
                    key={organization.id}
                    onSelect={() => {
                      if (!active) {
                        router.replace(
                          organizationSwitchRoute(pathname, organization.slug),
                        );
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
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {canUpdateOrganization ? (
                <DropdownMenuItem asChild>
                  <Link href={`/org/${currentSlug}/settings` as Route}>
                    <IconSettings />
                    Organization settings
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
                <Link href={"/onboarding" as Route}>
                  <span className="grid size-6 place-items-center rounded-md border">
                    <IconPlus className="size-3.5" />
                  </span>
                  Create Organization
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            {!organizations ? (
              <div className="text-muted-foreground px-2 py-1.5 text-xs">
                Loading Organizations…
              </div>
            ) : null}
            {organizations?.length === 0 ? (
              <DropdownMenuItem asChild>
                <Link href={"/onboarding" as Route}>
                  <IconBuilding />
                  Create your first Organization
                </Link>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
