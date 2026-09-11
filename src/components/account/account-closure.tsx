"use client";

import {
  MediaDeletionProgress,
  type MediaDeletionCounts,
} from "@/components/ui/media-deletion-progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorToast } from "@/components/ui/error-toast";
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

type ClosureStatus = {
  mediaProgress?: MediaDeletionCounts;
  status: "requested" | "failed" | "deleted";
  lastError?: string;
} | null;

export function AccountClosure() {
  const status = useQuery(api.accountDeletion.getMine, {});
  const remove = useMutation(api.accountDeletion.remove);
  if (status === undefined) return null;
  return (
    <AccountDeletionSection
      status={status}
      onDelete={async () => {
        await remove({
          confirmation: "DELETE ACCOUNT",
          irreversibleConfirmed: true,
        });
      }}
    />
  );
}

export function AccountDeletionSection({
  status,
  onDelete,
}: {
  status: ClosureStatus;
  onDelete: () => Promise<void>;
}) {
  const [progressOpen, setProgressOpen] = useState(true);
  const [confirmation, setConfirmation] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    setPending(true);
    setError(null);
    try {
      await onDelete();
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to close your account.",
      );
    } finally {
      setPending(false);
    }
  }
  if (status)
    return (
      <section
        aria-live="polite"
        className="bg-card space-y-3 rounded-lg border p-5"
      >
        <h2 className="type-subheading">
          {status.status === "deleted" ? "Account deleted" : "Account deletion"}
        </h2>
        <p className="text-ink-2 text-sm">
          {status.status === "deleted"
            ? "Your subscription has been canceled and all projects and hosted media have been deleted."
            : "All projects are now private and unavailable for new activity. Subscription cancellation and permanent cleanup are in progress."}
        </p>
        {status.status !== "deleted" ? (
          <>
            <Button variant="outline" onClick={() => setProgressOpen(true)}>
              View deletion progress
            </Button>
            <Dialog open={progressOpen} onOpenChange={setProgressOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Deleting your account</DialogTitle>
                  <DialogDescription>
                    All project images and videos are cleaned up before your
                    account is deleted.
                  </DialogDescription>
                </DialogHeader>
                <MediaDeletionProgress
                  progress={status.mediaProgress}
                  status={status.status}
                />
                {status.status === "failed" ? (
                  <p className="type-small text-ink-2">
                    We will retry automatically.
                  </p>
                ) : null}
              </DialogContent>
            </Dialog>
          </>
        ) : null}
      </section>
    );
  return (
    <section className="bg-card border-danger/40 space-y-4 rounded-lg border p-5">
      <h2 className="type-subheading">Delete account</h2>
      <p className="text-ink-2 text-sm">
        Permanently delete all your projects, testimonials and hosted videos,
        and cancel your subscription. This cannot be undone. To keep your
        account, delete an individual project from its settings instead.
      </p>
      <div className="space-y-2">
        <Label htmlFor="account-deletion-confirmation">
          Type DELETE ACCOUNT to continue
        </Label>
        <Input
          id="account-deletion-confirmation"
          autoComplete="off"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </div>
      {error ? <ErrorToast message={error} /> : null}
      <Button
        variant="destructive"
        disabled={confirmation !== "DELETE ACCOUNT" || pending}
        onClick={() => setOpen(true)}
      >
        Review account deletion
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete your account and every project?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Public access stops immediately for all projects. Your
              subscription will be canceled and all project data and hosted
              videos permanently deleted. There is no recovery window.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              Keep account
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                loading={pending}
                onClick={(event) => {
                  event.preventDefault();
                  void remove();
                }}
              >
                Delete account permanently
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
