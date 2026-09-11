import type { ReactNode } from "react";
import { IconExternalLink } from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  inboxCategoryDefinitions,
  type InboxCounts,
  type InboxRouteCategory,
} from "@/lib/inbox-route-state";

const inboxCountCeiling = 500;
const inboxCountColors: Record<
  InboxRouteCategory,
  "text-danger" | "text-info" | "text-success" | "text-warning"
> = {
  archived: "text-info",
  pending: "text-warning",
  published: "text-success",
  spam: "text-danger",
};

export function InboxCategoryTabs({
  children,
  counts,
  moderationStatus,
  onModerationStatusChange,
  syncIndicator,
}: {
  syncIndicator?: ReactNode;
  children: ReactNode;
  counts?: InboxCounts;
  moderationStatus: InboxRouteCategory;
  onModerationStatusChange: (value: InboxRouteCategory) => void;
}) {
  return (
    <Tabs
      className="gap-6"
      onValueChange={(value) =>
        onModerationStatusChange(value as InboxRouteCategory)
      }
      value={moderationStatus}
    >
      <div className="relative">
        <TabsList
          aria-label="Testimonial categories"
          className="gap-0 sm:gap-5"
        >
          {inboxCategoryDefinitions.map((category) => {
            const count = counts?.[category.key] ?? 0;
            return (
              <TabsTrigger
                className="type-ui! gap-0 px-0 sm:gap-1.5 sm:px-0.5"
                key={category.key}
                value={category.key}
              >
                {category.label}{" "}
                <span
                  className="inline-flex h-6 w-8 shrink-0 items-center justify-center sm:w-9"
                  data-slot="inbox-category-count"
                >
                  {counts === undefined ? (
                    <Skeleton aria-hidden="true" className="size-full" />
                  ) : count > 0 ? (
                    <span
                      className={`${inboxCountColors[category.key]} type-small tabular-nums`}
                      data-slot="inbox-category-count-value"
                    >
                      {count > inboxCountCeiling
                        ? `${inboxCountCeiling}+`
                        : count}
                    </span>
                  ) : null}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        <div className="absolute -top-5 right-0 flex size-4 items-center justify-center">
          {syncIndicator}
        </div>
      </div>
      <TabsContent className="space-y-6" value={moderationStatus}>
        {children}
      </TabsContent>
    </Tabs>
  );
}

export function InboxImportActions({
  slug,
  publicSlug,
}: {
  slug: string;
  publicSlug: string;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild>
        <Link href={`/org/${slug}/import` as Route}>Import testimonials</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href={`/w/${publicSlug}` as Route} target="_blank">
          Open Public Wall
          <IconExternalLink aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}
