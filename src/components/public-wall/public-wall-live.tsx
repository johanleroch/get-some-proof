"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import {
  wallFromResponse,
  type PublicWallResponse,
} from "@/lib/public-wall-response";
import {
  HostedWall,
  type PublicWallValue,
} from "@/components/public-wall/hosted-wall";

export function PublicWallLive({
  initialWall,
  initialCursor,
  initialPrivacyRevision,
}: {
  initialWall: PublicWallValue;
  initialCursor: string | null;
  initialPrivacyRevision: number;
}) {
  const privacyRevision = useQuery(api.publicWall.privacyRevision, {
    publicSlug: initialWall.publicSlug,
  });
  const [snapshot, setSnapshot] = useState({
    wall: initialWall,
    cursor: initialCursor,
    privacyRevision: initialPrivacyRevision,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const pageCount = useRef(1);
  const request = useRef<AbortController | null>(null);
  const expiry = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(
    async (cursor: string | null = null) => {
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const path = `/api/public-wall/${encodeURIComponent(initialWall.publicSlug)}`;
        const depth = cursor ? 1 : pageCount.current;
        let nextCursor = cursor;
        let value: PublicWallResponse | undefined;
        let loadedPages = 0;
        const testimonials: PublicWallResponse["testimonials"] = [];
        do {
          const response = await fetch(
            nextCursor
              ? `${path}?cursor=${encodeURIComponent(nextCursor)}`
              : path,
            {
              cache: "no-store",
              signal: controller.signal,
            },
          );
          if (!response.ok) throw new Error("Public Wall unavailable.");
          const page = (await response.json()) as PublicWallResponse;
          if (controller !== request.current || controller.signal.aborted)
            return;
          if (
            (privacyRevision !== undefined &&
              page.privacyRevision !== privacyRevision) ||
            (value && page.privacyRevision !== value.privacyRevision)
          )
            throw new Error("Public Wall changed.");
          value = page;
          testimonials.push(
            ...page.testimonials.filter(
              (item) => !testimonials.some((old) => old.id === item.id),
            ),
          );
          nextCursor = page.pagination.cursor;
          loadedPages += 1;
        } while (nextCursor && loadedPages < depth);
        if (!value) return;
        const current = { ...value, testimonials };
        pageCount.current = cursor
          ? pageCount.current + loadedPages
          : loadedPages;
        setSnapshot((previous) => ({
          wall: {
            ...wallFromResponse(current),
            testimonials:
              cursor && previous.privacyRevision === current.privacyRevision
                ? [
                    ...previous.wall.testimonials,
                    ...current.testimonials.filter(
                      (item) =>
                        !previous.wall.testimonials.some(
                          (old) => old.id === item.id,
                        ),
                    ),
                  ]
                : current.testimonials,
          },
          cursor: current.pagination.cursor,
          privacyRevision: current.privacyRevision,
        }));
        if (!cursor) {
          if (expiry.current) clearTimeout(expiry.current);
          expiry.current = setTimeout(
            () =>
              setSnapshot((previous) => ({
                ...previous,
                cursor: null,
                wall: { ...previous.wall, testimonials: [] },
              })),
            60_000,
          );
        }
      } catch {
        if (controller === request.current)
          setSnapshot((previous) => ({
            ...previous,
            cursor: null,
            wall: { ...previous.wall, testimonials: [] },
          }));
      } finally {
        clearTimeout(timeout);
        if (controller === request.current) setLoadingMore(false);
      }
    },
    [initialWall.publicSlug, privacyRevision],
  );

  const refreshFromEffect = useEffectEvent(() => {
    void refresh();
  });
  useEffect(() => {
    // Coalesce invalidations before starting the next network refresh.
    const initial = setTimeout(() => refreshFromEffect(), 0);
    const interval = setInterval(() => refreshFromEffect(), 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshFromEffect();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      request.current?.abort();
      if (expiry.current) clearTimeout(expiry.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [initialWall.publicSlug, privacyRevision]);

  // A privacy invalidation hides every loaded page immediately, even during a failed refresh.
  const invalidated =
    privacyRevision !== undefined &&
    privacyRevision !== snapshot.privacyRevision;
  return (
    <HostedWall
      canLoadMore={!invalidated && snapshot.cursor !== null}
      loadingMore={loadingMore}
      onLoadMore={() => {
        setLoadingMore(true);
        void refresh(snapshot.cursor);
      }}
      wall={
        invalidated ? { ...snapshot.wall, testimonials: [] } : snapshot.wall
      }
    />
  );
}
