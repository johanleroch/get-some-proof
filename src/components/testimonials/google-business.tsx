"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { GoogleBusinessView, type GooglePage } from "./google-business-view";
import { BlobLoader } from "@/components/brand/blob-loader";

function message(error: unknown) {
  return error instanceof ConvexError &&
    typeof error.data === "object" &&
    error.data &&
    "message" in error.data
    ? String(error.data.message)
    : "Google connection failed. Try again.";
}
export function GoogleBusiness({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const status = useQuery(api.googleBusiness.status, { organizationId });
  if (!status)
    return <BlobLoader label="Loading Google connection…" showLabel />;
  return (
    <Connection
      key={status.generation ?? "disconnected"}
      organizationId={organizationId}
      {...status}
    />
  );
}
function Connection({
  organizationId,
  connected,
  configured,
  disconnecting,
}: {
  organizationId: Id<"organizations">;
  connected: boolean;
  configured: boolean;
  disconnecting: boolean;
}) {
  const connect = useAction(api.googleBusinessActions.connect);
  const disconnect = useAction(api.googleBusinessActions.disconnect);
  const read = useAction(api.googleBusinessActions.read);
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<{
    account?: string;
    location?: string;
  }>({});
  const [page, setPage] = useState<GooglePage | null>(null);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <GoogleBusinessView
      {...{
        connected,
        configured,
        busy: busy || disconnecting,
        page,
        ...selection,
      }}
      onConnect={() =>
        void run(async () => {
          window.location.assign(await connect({ organizationId }));
        })
      }
      onDisconnect={() =>
        void run(async () => {
          setPage(null);
          const result = await disconnect({ organizationId });
          if (result.revoked) toast.success("Google disconnected.");
          else
            toast.error(
              "Disconnected here. Remove access in your Google Account's Connections page to finish revoking permission.",
            );
        })
      }
      onRead={(account, location, pageToken) =>
        void run(async () => {
          setPage(null);
          const result = await read({
            organizationId,
            account,
            location,
            pageToken,
          });
          setSelection({ account, location });
          setPage(result);
        })
      }
    />
  );
}
