"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import type { ScreenStatus, ScreenStatuses } from "@/lib/screens-catalog";

function withStatus(
  current: ScreenStatuses,
  slug: string,
  status: ScreenStatus | null,
): ScreenStatuses {
  const next = { ...current };
  if (status) next[slug] = status;
  else delete next[slug];
  return next;
}

export function useScreenStatuses(initialStatuses: ScreenStatuses) {
  const [statuses, setStatuses] = useState(initialStatuses);
  const confirmed = useRef(initialStatuses);
  const revisions = useRef<Record<string, number>>({});
  const queue = useRef(Promise.resolve());

  const updateStatus = useCallback(
    (slug: string, status: ScreenStatus | null) => {
      const revision = (revisions.current[slug] ?? 0) + 1;
      revisions.current[slug] = revision;
      setStatuses((current) => withStatus(current, slug, status));

      // Serialize writes to the shared status file while keeping clicks optimistic.
      const save = async () => {
        try {
          const response = await fetch("/api/screens/status", {
            body: JSON.stringify({ slug, status }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = (await response.json()) as { statuses: ScreenStatuses };
          const saved = data.statuses[slug] ?? null;
          confirmed.current = withStatus(confirmed.current, slug, saved);
          if (revisions.current[slug] === revision) {
            setStatuses((current) => withStatus(current, slug, saved));
          }
        } catch {
          if (revisions.current[slug] === revision) {
            const saved = confirmed.current[slug] ?? null;
            setStatuses((current) => withStatus(current, slug, saved));
          }
          toast.error("Could not save the screen status.");
        }
      };
      queue.current = queue.current.then(save, save);
      return queue.current;
    },
    [],
  );

  return { statuses, updateStatus };
}
