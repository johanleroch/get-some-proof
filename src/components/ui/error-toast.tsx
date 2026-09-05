"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function ErrorToast({ message }: { message: string }) {
  useEffect(() => {
    toast.error(message, { id: `error:${message}` });
  }, [message]);

  return (
    <span data-testid="error-toast-message" hidden>
      {message}
    </span>
  );
}
