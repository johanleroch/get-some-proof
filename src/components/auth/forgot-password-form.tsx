"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);

    await authClient.requestPasswordReset({
      email: String(form.get("email")),
      redirectTo: "/reset-password",
    });

    setPending(false);
    setSent(true);
  }

  return (
    <form className="space-y-5" onSubmit={requestReset}>
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          autoComplete="email"
          id="email"
          name="email"
          required
          type="email"
        />
      </div>
      {sent ? (
        <p
          aria-live="polite"
          className="text-muted-foreground text-sm leading-6"
        >
          If an account matches that address, a reset link is on its way.
        </p>
      ) : null}
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-center text-sm">
        <Link
          className="text-primary font-medium hover:underline"
          href="/sign-in"
        >
          Return to sign in
        </Link>
      </p>
    </form>
  );
}
