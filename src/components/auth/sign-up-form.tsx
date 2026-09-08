"use client";

import { type FormEvent, useState } from "react";
import type { Route } from "next";
import Link from "next/link";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { EnvelopeStamp } from "@/components/doodles";
import { Button } from "@/components/ui/button";
import { ErrorToast } from "@/components/ui/error-toast";
import { Field, FieldDescription } from "@/components/ui/field";
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
      <div className="space-y-5">
        <EnvelopeStamp className="text-ink h-28 w-auto" />
        <div className="space-y-1.5">
          <h2 className="type-heading">Check your email</h2>
          <p className="type-body text-ink-2">
            We sent a verification link. Verify your address before creating
            your Brand.
          </p>
        </div>
        <Link
          className="text-brand-text text-sm font-medium hover:underline"
          href={`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`}
        >
          Return to sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={signUp}>
      <Field>
        <Label htmlFor="name">Full name</Label>
        <Input autoComplete="name" id="name" name="name" required />
      </Field>
      <Field>
        <Label htmlFor="email">Email address</Label>
        <Input
          autoComplete="email"
          id="email"
          name="email"
          required
          type="email"
        />
      </Field>
      <Field>
        <Label htmlFor="password">Password</Label>
        <Input
          autoComplete="new-password"
          id="password"
          minLength={8}
          name="password"
          required
          type="password"
        />
        <FieldDescription>Use at least 8 characters.</FieldDescription>
      </Field>
      {error ? <ErrorToast message={error} /> : null}
      <Button className="w-full" loading={pending} type="submit">
        Create account
      </Button>
      <GoogleSignInButton
        callbackURL={callbackURL}
        pending={pending}
        setPending={setPending}
        setError={setError}
      />
      <p className="text-ink-2 text-center text-sm">
        Already have an account?{" "}
        <Link
          className="text-brand-text font-medium hover:underline"
          href={`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`}
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
