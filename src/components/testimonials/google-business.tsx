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
  async function perform(
    operation: "connect" | "disconnect" | "read",
    request: { account?: string; location?: string; pageToken?: string } = {},
  ) {
    setBusy(true);
    try {
      if (operation === "connect") {
        window.location.assign(await connect({ organizationId }));
      } else if (operation === "disconnect") {
        setPage(null);
        const result = await disconnect({ organizationId });
        if (result.revoked) toast.success("Google disconnected.");
        else
          toast.error(
            "Disconnected here. Remove access in your Google Account's Connections page to finish revoking permission.",
          );
      } else {
        setPage(null);
        const result = await read({ organizationId, ...request });
        setSelection({ account: request.account, location: request.location });
        setPage(result);
      }
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
      onConnect={() => void perform("connect")}
      onDisconnect={() => void perform("disconnect")}
      onRead={(account, location, pageToken) =>
        void perform("read", { account, location, pageToken })
      }
    />
  );
}
