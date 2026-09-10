// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { InboxCategory } from "./testimonial-inbox";
import { useInboxPages } from "./use-inbox-pages";

const queries = vi.hoisted(() => ({
  calls: [] as unknown[],
  rows: {} as Record<string, string[]>,
}));
vi.mock("convex/react", async () => {
  const { useState } = await import("react");
  return {
    usePaginatedQuery: (_ref: unknown, args: "skip" | { status: string }) => {
      queries.calls.push(args);
      const key = JSON.stringify(args);
      const [page, setPage] = useState({ key, limit: 20 });
      const limit = page.key === key ? page.limit : 20;
      if (page.key !== key) setPage({ key, limit });
      return {
        results:
          args === "skip"
            ? []
            : (queries.rows[args.status] ?? []).slice(0, limit),
        status: args === "skip" ? "LoadingFirstPage" : "CanLoadMore",
        loadMore: (count: number) => setPage({ key, limit: limit + count }),
      };
    },
  };
});
afterEach(() => {
  cleanup();
  queries.calls = [];
  queries.rows = {};
});
const organizationId = "project-one" as Id<"organizations">;

it("retains visited page depth and receives changes while another tab is selected", () => {
  queries.rows.pending = Array.from({ length: 40 }, (_, i) => String(i));
  const { result, rerender } = renderHook(
    ({ category }: { category: InboxCategory }) =>
      useInboxPages(category, { organizationId }),
    { initialProps: { category: "pending" as InboxCategory } },
  );
  expect(queries.calls.slice(-4)).toEqual([
    { organizationId, sort: "newest", status: "pending" },
    "skip",
    "skip",
    "skip",
  ]);
  act(() => result.current.loadMore(20));
  expect(result.current.results).toHaveLength(40);
  rerender({ category: "published" });
  expect(queries.calls.slice(-4)).toEqual([
    { organizationId, sort: "newest", status: "pending" },
    { organizationId, sort: "wall", status: "published" },
    "skip",
    "skip",
  ]);
  queries.rows.pending = queries.rows.pending.slice(1);
  rerender({ category: "pending" });
  expect(result.current.results).toHaveLength(39);
  expect(result.current.results[0]).toBe("1");
});

it("resets visited subscriptions and pagination when the project or import changes", () => {
  queries.rows.pending = Array.from({ length: 40 }, (_, i) => String(i));
  const { result, rerender } = renderHook(
    (props: {
      category: InboxCategory;
      organizationId: Id<"organizations">;
      importJobId?: string;
    }) => useInboxPages(props.category, props),
    {
      initialProps: {
        category: "pending" as InboxCategory,
        organizationId,
        importJobId: undefined as string | undefined,
      },
    },
  );
  act(() => result.current.loadMore(20));
  rerender({ category: "published", organizationId, importJobId: undefined });
  rerender({ category: "pending", organizationId, importJobId: "import-two" });
  expect(result.current.results).toHaveLength(20);
  expect(queries.calls.slice(-3)).toEqual(["skip", "skip", "skip"]);
  act(() => result.current.loadMore(20));
  rerender({
    category: "pending",
    organizationId: "project-two" as Id<"organizations">,
    importJobId: "import-two",
  });
  expect(result.current.results).toHaveLength(20);
});
