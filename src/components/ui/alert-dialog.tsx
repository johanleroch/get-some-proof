"use client";

import * as React from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import type { VariantProps } from "class-variance-authority";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loopDialogOptionTab } from "@/lib/dialog-option-tab";
import { dialogOpener } from "@/lib/dialog-opener";

function AlertDialog(
  props: React.ComponentProps<typeof AlertDialogPrimitive.Root>,
) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogContent({
  className,
  onCloseAutoFocus,
  onOpenAutoFocus,
  onKeyDown,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  // Same contract as DialogContent: focus returns to whatever opened the
  // confirmation, since none of ours opens from an AlertDialogTrigger.
  const opener = React.useRef<HTMLElement | null>(null);
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        onKeyDown={(event) => {
          onKeyDown?.(event);
          loopDialogOptionTab(event);
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (event.defaultPrevented) return;
          const target = opener.current;
          if (target?.isConnected) {
            event.preventDefault();
            target.focus();
          }
        }}
        onOpenAutoFocus={(event) => {
          opener.current = dialogOpener();
          onOpenAutoFocus?.(event);
        }}
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98] shadow-float fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border p-6 data-[state=closed]:duration-[160ms] data-[state=closed]:ease-[var(--ease-exit)] data-[state=open]:duration-[260ms] data-[state=open]:ease-[var(--ease-settle-soft)]",
          className,
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2 text-left", className)}
      {...props}
    />
  );
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      className={cn(
        "font-display text-2xl leading-tight font-bold tracking-[-0.025em]",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

/**
 * The two footer buttons carry the button styles themselves, so a
 * confirmation can never render as bare text. Pass `asChild` with a `Button`
 * only when the action needs something the variants do not cover, such as a
 * loading state.
 */
function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      data-slot="alert-dialog-cancel"
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  );
}

function AlertDialogAction({
  asChild,
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> &
  Pick<VariantProps<typeof buttonVariants>, "variant">) {
  // With `asChild` the child is a real Button that already carries its own
  // variant (destructive, with a loading state): painting the default variant
  // over it turned every confirmation's "Delete" brand amber.
  return (
    <AlertDialogPrimitive.Action
      asChild={asChild}
      data-slot="alert-dialog-action"
      data-variant={asChild ? undefined : variant}
      className={cn(
        asChild ? undefined : buttonVariants({ variant }),
        className,
      )}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
};
