"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { InboxCategory } from "./testimonial-inbox";

type InboxPageScope = {
  organizationId?: Id<"organizations">;
  importJobId?: string;
};

function useCategoryPage(
  category: InboxCategory,
  selected: InboxCategory,
  { organizationId, importJobId }: InboxPageScope,
) {
  const scope = JSON.stringify([organizationId, importJobId]);
  const active = category === selected;
  const [subscription, setSubscription] = useState({ scope, visited: active });
  const visited =
    subscription.scope === scope ? subscription.visited || active : active;
  // Reset during render so a different Project/import can never use an old page.
  if (subscription.scope !== scope || subscription.visited !== visited) {
    setSubscription({ scope, visited });
  }

  return usePaginatedQuery(
    api.testimonialModeration.listInbox,
    organizationId && visited
      ? {
          organizationId,
          ...(importJobId !== undefined ? { importJobId } : {}),
          sort: category === "published" ? "wall" : "newest",
          status: category,
        }
      : "skip",
    { initialNumItems: 20 },
  );
}

/** Keep visited categories subscribed, including their loaded page depth. */
export function useInboxPages(category: InboxCategory, scope: InboxPageScope) {
  const pending = useCategoryPage("pending", category, scope);
  const published = useCategoryPage("published", category, scope);
  const archived = useCategoryPage("archived", category, scope);
  const spam = useCategoryPage("spam", category, scope);
  return { pending, published, archived, spam }[category];
}
