"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";

import { ScribbleStar } from "@/components/doodles";
import { Button } from "@/components/ui/button";
import { ErrorToast } from "@/components/ui/error-toast";
import { Field } from "@/components/ui/field";
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
      <div className="space-y-5">
        <ScribbleStar className="text-brand size-12" draw />
        <div className="space-y-1.5">
          <h2 className="type-heading">Password updated</h2>
          <p className="type-body text-ink-2">
            Existing sessions were revoked. Sign in again with your new
            password.
          </p>
        </div>
        <Link
          className="text-brand-text text-sm font-medium hover:underline"
          href="/sign-in"
        >
          Continue to sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={resetPassword}>
      <Field>
        <Label htmlFor="password">New password</Label>
        <Input
          autoComplete="new-password"
          id="password"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </Field>
      {error ? <ErrorToast message={error} /> : null}
      <Button className="w-full" loading={pending} type="submit">
        Update password
      </Button>
    </form>
  );
}
