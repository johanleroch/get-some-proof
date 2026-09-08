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
        const response = await fetch(
          cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error("Public Wall unavailable.");
        const value = (await response.json()) as PublicWallResponse;
        if (controller !== request.current || controller.signal.aborted) return;
        if (
          privacyRevision !== undefined &&
          value.privacyRevision !== privacyRevision
        )
          return;
        setSnapshot((previous) => ({
          wall: {
            ...wallFromResponse(value),
            testimonials:
              cursor && previous.privacyRevision === value.privacyRevision
                ? [
                    ...previous.wall.testimonials,
                    ...value.testimonials.filter(
                      (item) =>
                        !previous.wall.testimonials.some(
                          (old) => old.id === item.id,
                        ),
                    ),
                  ]
                : value.testimonials,
          },
          cursor: value.pagination.cursor,
          privacyRevision: value.privacyRevision,
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
