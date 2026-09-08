"use client";

import { useEffect } from "react";

import { blobToast } from "@/components/brand/blob-toast";

/**
 * Declarative toasts: render one of these while a message is set and the
 * mascot tells it (DESIGN.md section 4). The hidden span keeps the message in
 * the accessibility tree and in tests while the toast itself lives in the
 * sonner portal.
 */
function useMessageToast(type: "error" | "success" | "info", message: string) {
  useEffect(() => {
    blobToast[type](message, { id: `${type}:${message}` });
  }, [message, type]);
}

export function ErrorToast({ message }: { message: string }) {
  useMessageToast("error", message);

  return (
    <span data-testid="error-toast-message" hidden>
      {message}
    </span>
  );
}

export function SuccessToast({ message }: { message: string }) {
  useMessageToast("success", message);

  return (
    <span data-testid="success-toast-message" hidden>
      {message}
    </span>
  );
}

export function InfoToast({ message }: { message: string }) {
  useMessageToast("info", message);

  return (
    <span data-testid="info-toast-message" hidden>
      {message}
    </span>
  );
}
