"use client";

import { useState } from "react";
import type { Doc } from "@convex/_generated/dataModel";
import { convexErrorMessage } from "@/lib/convex-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldError } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ImportIdentityDialog({
  item,
  onClose,
  onSave,
}: {
  item: Doc<"testimonialImportItems">;
  onClose: () => void;
  onSave: (identity: { authorName: string; tagline: string }) => Promise<void>;
}) {
  const [authorName, setAuthorName] = useState(
    item.identityCorrection?.authorName ?? item.authorName,
  );
  const [tagline, setTagline] = useState(
    item.identityCorrection?.tagline ?? item.tagline ?? "",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setPending(true);
    setError(null);
    try {
      await onSave({ authorName, tagline });
      onClose();
    } catch (cause) {
      setError(
        convexErrorMessage(cause, "The customer details could not be saved."),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Correct customer details</DialogTitle>
          <DialogDescription>
            Check the name and role before importing. Your customer&apos;s words
            and the original source are kept.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Field>
            <Label htmlFor="import-author-name">Customer name</Label>
            <Input
              id="import-author-name"
              required
              maxLength={100}
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              disabled={pending}
            />
          </Field>
          <Field>
            <Label htmlFor="import-tagline">Role or company</Label>
            <Input
              id="import-tagline"
              maxLength={200}
              value={tagline}
              onChange={(event) => setTagline(event.target.value)}
              disabled={pending}
            />
          </Field>
          <FieldError>{error}</FieldError>
          <DialogFooter>
            <Button
              className="min-h-11"
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="min-h-11"
              type="submit"
              loading={pending}
              disabled={!authorName.trim()}
            >
              Save details
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
