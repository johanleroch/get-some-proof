"use client";

import { type FormEvent, useState } from "react";
import type { Route } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function SignUpForm({
  callbackURL = "/dashboard",
}: {
  callbackURL?: Route;
}) {
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);

    const result = await authClient.signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
      callbackURL,
    });

    setPending(false);

    if (result.error) {
      setError(result.error.message ?? "Unable to create the account.");
      return;
    }

    setEmailSent(true);
  }

  if (emailSent) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="text-muted-foreground text-sm leading-6">
          We sent a verification link. Verify your address before creating or
          joining an Organization.
        </p>
        <Link
          className="text-primary text-sm font-medium hover:underline"
          href={`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`}
        >
          Return to sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={signUp}>
      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input autoComplete="name" id="name" name="name" required />
      </div>
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
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          autoComplete="new-password"
          id="password"
          minLength={8}
          name="password"
          required
          type="password"
        />
        <p className="text-muted-foreground text-xs">
          Use at least 8 characters.
        </p>
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
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link
          className="text-primary font-medium hover:underline"
          href={`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`}
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
