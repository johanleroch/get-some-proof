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

export function SuccessToast({ message }: { message: string }) {
  useEffect(() => {
    toast.success(message, { id: `success:${message}` });
  }, [message]);

  return (
    <span data-testid="success-toast-message" hidden>
      {message}
    </span>
  );
}

export function InfoToast({ message }: { message: string }) {
  useEffect(() => {
    toast.info(message, { id: `info:${message}` });
  }, [message]);

  return (
    <span data-testid="info-toast-message" hidden>
      {message}
    </span>
  );
}
