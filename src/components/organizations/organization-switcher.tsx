"use client";

import { useEffect } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { organizationSwitchRoute } from "@/lib/organization-switch-route";

export function OrganizationSwitcher({
  currentName,
  currentSlug,
}: {
  currentName: string;
  currentSlug: string;
}) {
  const organizations = useQuery(api.organizations.listMine, {});
  const pathname = usePathname();
  const router = useRouter();

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
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold">Convex Admin</p>
      {organizations && organizations.length > 1 ? (
        <label className="mt-1 block">
          <span className="sr-only">Switch Organization</span>
          <select
            aria-label="Switch Organization"
            className="text-muted-foreground focus-visible:ring-ring -ml-1 w-full rounded-md border-0 bg-transparent py-1 pr-7 pl-1 text-xs font-medium outline-none focus-visible:ring-2"
            onChange={(event) =>
              router.replace(
                organizationSwitchRoute(pathname, event.target.value),
              )
            }
            value={currentSlug}
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.slug}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-muted-foreground truncate text-xs">{currentName}</p>
      )}
      <Link
        className="text-primary mt-2 inline-flex items-center gap-1 text-xs font-medium hover:underline"
        href={"/onboarding" as Route}
      >
        <Plus aria-hidden="true" className="size-3" />
        Create another Organization
      </Link>
    </div>
  );
}
