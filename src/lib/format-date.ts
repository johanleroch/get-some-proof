/**
 * A short date in the product's own English ("6 Sept 2026"), the same on the
 * server and in every browser. Reading the viewer's locale here made the
 * server render one string and the client another, which React reported as
 * a hydration mismatch on every Inbox row.
 */
export function formatShortDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(timestamp);
}
