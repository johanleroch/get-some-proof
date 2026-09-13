"use client";

import { useEffect, useRef, useState } from "react";
import type { ReviewRead, ReviewUpdate } from "./types";

function sameSelection(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((id, i) => id === right[i]);
}

/** Owns pagination, invalidation, burst coalescing, retries and stale responses.
 * Mount one browser per connection generation. The provider supplies a stable
 * read function and translates its notifications into a monotonic revision.
 */
export function useReviewBrowser<Page>({
  connected,
  read,
  update,
  onError,
}: {
  connected: boolean;
  read: (request: ReviewRead) => Promise<Page>;
  update: ReviewUpdate | null;
  onError: (error: unknown) => void;
}) {
  const [request, setRequest] = useState<
    (ReviewRead & { revision: number }) | null
  >(() =>
    update ? { selection: update.selection, revision: update.revision } : null,
  );
  const [page, setPage] = useState<Page | null>(null);
  const [reading, setReading] = useState(false);
  const lastReadAt = useRef(0);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  const revision =
    request && update && sameSelection(request.selection, update.selection)
      ? update.revision
      : 0;

  useEffect(() => {
    if (!connected || !request) return;
    let current = true;
    let timer: ReturnType<typeof setTimeout>;
    const invalidated = revision !== request.revision;
    async function attempt(retry: number) {
      lastReadAt.current = Date.now();
      setReading(true);
      if (!invalidated && retry === 0) setPage(null);
      try {
        const result = await read({
          selection: request!.selection,
          cursor: invalidated ? undefined : request!.cursor,
        });
        if (current) {
          setPage(result);
          setReading(false);
        }
      } catch (error) {
        if (!current) return;
        // Recover transient push-triggered failures without waiting for another event.
        if (invalidated && retry < 2) {
          timer = setTimeout(() => void attempt(retry + 1), 3000 * (retry + 1));
        } else {
          setReading(false);
          onErrorRef.current(error);
        }
      }
    }
    timer = setTimeout(
      () => void attempt(0),
      invalidated ? Math.max(0, lastReadAt.current + 3000 - Date.now()) : 0,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [connected, read, request, revision]);

  function select(next: ReviewRead) {
    setRequest({
      ...next,
      revision:
        update && sameSelection(next.selection, update.selection)
          ? update.revision
          : 0,
    });
  }
  return {
    page,
    reading,
    selection: request?.selection,
    select,
    clear: () => setPage(null),
  };
}
