"use client";
import { useState } from "react";
import { IconBell, IconBellCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function GoogleNotificationsView({
  enabled,
  configured,
  busy,
  onEnable,
  onDisable,
}: {
  enabled: boolean;
  configured: boolean;
  busy: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="border-line flex flex-wrap items-start justify-between gap-4 border-y py-4">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="type-ui flex items-center gap-2">
          {enabled ? (
            <IconBellCheck
              className="text-success"
              aria-hidden="true"
              size={16}
              stroke={1.75}
            />
          ) : (
            <IconBell aria-hidden="true" size={16} stroke={1.75} />
          )}
          {enabled
            ? "Automatic updates enabled"
            : "Get new reviews automatically"}
        </p>
        <p className="type-small text-ink-2 max-w-prose">
          {enabled
            ? "This list refreshes when Google notifies us of a new or edited review."
            : configured
              ? "Enabling updates may replace another tool’s Google review notifications for this Google account."
              : "Automatic Google updates are not available yet. You can still refresh manually."}
        </p>
      </div>
      {enabled ? (
        <Button variant="ghost" disabled={busy} onClick={onDisable}>
          Turn off here
        </Button>
      ) : (
        <Button
          variant="outline"
          disabled={!configured || busy}
          onClick={() => setConfirming(true)}
        >
          Enable automatic updates
        </Button>
      )}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Enable automatic Google updates?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Google allows one notification destination per account. Continuing
              replaces its current destination and selected notification types.
              Another connected tool may stop receiving notifications for any
              business in this Google account. Your reviews on Google will not
              be changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onEnable}>
              Enable automatic updates
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
