"use client";

import { usePaginatedQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import {
  HostedWall,
  type PublicWallValue,
} from "@/components/public-wall/hosted-wall";

export function PublicWallLive({
  initialWall,
}: {
  initialWall: PublicWallValue;
}) {
  const { loadMore, results, status } = usePaginatedQuery(
    api.publicWall.list,
    { publicSlug: initialWall.publicSlug },
    { initialNumItems: 24 },
  );
  const testimonials =
    status === "LoadingFirstPage" ? initialWall.testimonials : results;

  return (
    <HostedWall
      canLoadMore={status === "CanLoadMore" || status === "LoadingMore"}
      loadingMore={status === "LoadingMore"}
      onLoadMore={() => loadMore(24)}
      wall={{ ...initialWall, testimonials }}
    />
  );
}
