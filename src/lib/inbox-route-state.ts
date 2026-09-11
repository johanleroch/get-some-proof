export const inboxCategoryDefinitions = [
  { key: "pending", label: "Pending" },
  { key: "published", label: "Published" },
  { key: "archived", label: "Archived" },
  { key: "spam", label: "Spam" },
] as const;

export type InboxRouteCategory =
  (typeof inboxCategoryDefinitions)[number]["key"];

export type InboxCounts = Record<InboxRouteCategory, number>;

export function inboxCategoryFromUrl(searchParams: {
  getAll: (name: string) => string[];
}): InboxRouteCategory {
  const requestedCategory = searchParams.getAll("tab");
  return (
    (requestedCategory.length === 1
      ? inboxCategoryDefinitions.find(
          (category) => category.key === requestedCategory[0],
        )?.key
      : undefined) ?? "pending"
  );
}

export function setModerationStatusFilter(category: InboxRouteCategory) {
  const url = new URL(window.location.href);
  if (
    url.searchParams.getAll("tab").length === 1 &&
    url.searchParams.get("tab") === category
  )
    return;
  url.searchParams.set("tab", category);
  window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
}
