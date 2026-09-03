"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token }: { token?: string }) {
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("This reset link is incomplete or expired.");
      return;
    }

    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await authClient.resetPassword({
      newPassword: String(form.get("password")),
      token,
    });
    setPending(false);

    if (result.error) {
      setError(result.error.message ?? "Unable to reset the password.");
      return;
    }

    setComplete(true);
  }

  if (complete) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold">Password updated</h2>
        <p className="text-muted-foreground text-sm">
          Existing sessions were revoked. Sign in again with your new password.
        </p>
        <Link
          className="text-primary text-sm font-medium hover:underline"
          href="/sign-in"
        >
          Continue to sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={resetPassword}>
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          autoComplete="new-password"
          id="password"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </div>
      {error ? (
        <p
          aria-live="polite"
          className="text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
