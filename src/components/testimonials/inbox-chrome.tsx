import type { ReactNode } from "react";
import { IconExternalLink } from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InboxCounts, InboxRouteCategory } from "@/lib/inbox-route-state";

const categories: readonly {
  key: InboxRouteCategory;
  label: string;
}[] = [
  { key: "pending", label: "Pending" },
  { key: "published", label: "Published" },
  { key: "archived", label: "Archived" },
  { key: "spam", label: "Spam" },
];

const inboxCountCeiling = 500;

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
        <TabsList aria-label="Testimonial categories">
          {categories.map((category) => {
            const count = counts?.[category.key] ?? 0;
            return (
              <TabsTrigger key={category.key} value={category.key}>
                {category.label}{" "}
                {counts === undefined ? (
                  <Skeleton aria-hidden="true" className="h-3 w-4" />
                ) : count > 0 ? (
                  <span className="font-medium tabular-nums">
                    {count > inboxCountCeiling
                      ? `${inboxCountCeiling}+`
                      : count}
                  </span>
                ) : null}
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
