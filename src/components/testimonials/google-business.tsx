"use client";

import { useCallback, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { GoogleBusinessView } from "./google-business-view";
import { useReviewBrowser } from "../review-connectors/use-review-browser";
import type { ReviewRead } from "../review-connectors/types";
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
  notifications,
  notificationsConfigured,
}: {
  organizationId: Id<"organizations">;
  connected: boolean;
  configured: boolean;
  disconnecting: boolean;
  notificationsConfigured: boolean;
  notifications: {
    account: string;
    location: string;
    revision: number;
    lastEventAt: number | null;
  } | null;
}) {
  const connect = useAction(api.googleBusinessActions.connect);
  const disconnect = useAction(api.googleBusinessActions.disconnect);
  const read = useAction(api.googleBusinessActions.read);
  const [busy, setBusy] = useState(false);
  const enableUpdates = useAction(
    api.googleBusinessNotificationsActions.enable,
  );
  const disableUpdates = useMutation(api.googleBusinessNotifications.disable);
  const readPage = useCallback(
    ({ selection, cursor }: ReviewRead) =>
      read({
        organizationId,
        account: selection[0],
        location: selection[1],
        pageToken: cursor,
      }),
    [organizationId, read],
  );
  const browser = useReviewBrowser({
    connected,
    read: readPage,
    update: notifications
      ? {
          selection: [notifications.account, notifications.location],
          revision: notifications.revision,
        }
      : null,
    onError: (error) => toast.error(message(error)),
  });
  const account = browser.selection?.[0];
  const location = browser.selection?.[1];
  async function perform(
    operation: "connect" | "disconnect" | "enable" | "disable",
  ) {
    setBusy(true);
    try {
      if (operation === "connect") {
        window.location.assign(await connect({ organizationId }));
      } else if (operation === "disconnect") {
        browser.clear();
        const result = await disconnect({ organizationId });
        if (result.revoked) toast.success("Google disconnected.");
        else
          toast.error(
            "Disconnected here. Remove access in your Google Account's Connections page to finish revoking permission.",
          );
      } else if (operation === "enable" && account && location) {
        await enableUpdates({
          organizationId,
          account,
          location,
          replaceExisting: true,
        });
        browser.select({ selection: [account, location] });
        toast.success("Automatic Google updates enabled.");
      } else if (operation === "disable") {
        await disableUpdates({ organizationId });
        toast.success("Automatic updates turned off for this project.");
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
        busy: busy || browser.reading || disconnecting,
        notifications,
        notificationsConfigured,
        page: browser.page,
        account,
        location,
      }}
      onConnect={() => void perform("connect")}
      onDisconnect={() => void perform("disconnect")}
      onEnableNotifications={() => void perform("enable")}
      onDisableNotifications={() => void perform("disable")}
      onRead={(account, location, cursor) =>
        browser.select({
          selection: account
            ? location
              ? [account, location]
              : [account]
            : [],
          cursor,
        })
      }
    />
  );
}
