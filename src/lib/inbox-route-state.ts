export type InboxRouteCategory = "pending" | "published" | "archived" | "spam";

export type InboxCounts = Record<InboxRouteCategory, number>;

const categories: readonly InboxRouteCategory[] = [
  "pending",
  "published",
  "archived",
  "spam",
];

export function inboxCategoryFromUrl(searchParams: {
  getAll: (name: string) => string[];
}): InboxRouteCategory {
  const requestedCategory = searchParams.getAll("tab");
  return (
    (requestedCategory.length === 1
      ? categories.find((category) => category === requestedCategory[0])
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
