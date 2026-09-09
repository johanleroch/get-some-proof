"use client";

import { useState } from "react";
import { importAttestationText } from "@convex/domain/testimonialImport";
import { convexErrorMessage } from "@/lib/convex-error-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ImportPublicationDialog({
  name,
  onClose,
  onCloseAutoFocus,
  onPublish,
}: {
  name: string;
  onClose: () => void;
  onCloseAutoFocus?: (event: Event) => void;
  onPublish: () => Promise<void>;
}) {
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function publish() {
    setPending(true);
    setError(null);
    try {
      await onPublish();
      onClose();
    } catch (cause) {
      setError(
        convexErrorMessage(cause, "The testimonial could not be published."),
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
      <DialogContent
        className="sm:max-w-[480px]"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>Publish {name}&apos;s testimonial?</DialogTitle>
          <DialogDescription>
            This testimonial came from another wall. Confirm your permission
            before showing it on your Public Wall and embeds.
          </DialogDescription>
        </DialogHeader>
        <label className="type-body flex cursor-pointer items-start gap-3 py-4">
          <Checkbox
            checked={accepted}
            disabled={pending}
            onCheckedChange={(value) => setAccepted(value === true)}
            className="mt-0.5"
          />
          <span>{importAttestationText}</span>
        </label>
        <FieldError>{error}</FieldError>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!accepted}
            loading={pending}
            onClick={() => void publish()}
          >
            Publish testimonial
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
