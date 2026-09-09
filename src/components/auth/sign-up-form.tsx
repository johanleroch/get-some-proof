"use client";

import { type FormEvent, useState } from "react";
import { IconArrowLeft } from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";

import { AuthHeading } from "@/components/auth/auth-heading";
import {
  type AuthAttempt,
  GoogleSignInButton,
  type SocialSignIn,
} from "@/components/auth/google-sign-in-button";
import { EnvelopeStamp } from "@/components/doodles";
import { Button } from "@/components/ui/button";
import { ErrorToast } from "@/components/ui/error-toast";
import { Field, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

/** The title and lead above the account form. They leave with the form. */
const signUpCopy = {
  description: "Verify your email before creating your Brand.",
  title: "Create your account",
} as const;

export type SignUpInput = {
  callbackURL: Route;
  email: string;
  name: string;
  password: string;
};

export function SignUpForm({
  callbackURL = "/dashboard",
}: {
  callbackURL?: Route;
}) {
  return (
    <SignUpFormView
      callbackURL={callbackURL}
      signUp={(input) => authClient.signUp.email(input)}
    />
  );
}

/**
 * The account form with its auth calls handed in, so the same screen can be
 * played without a backend. The heading belongs to the form: after a
 * successful sign-up both give way to the "Check your email" notice, which
 * is where a new Owner leaves the product for their inbox, and that notice
 * carries the page's one title.
 */
export function SignUpFormView({
  callbackURL = "/dashboard",
  onEmailSent,
  signInWithGoogle,
  signUp,
}: {
  callbackURL?: Route;
  /** Called once the verification email is on its way. */
  onEmailSent?: (account: { email: string; name: string }) => void;
  signInWithGoogle?: SocialSignIn;
  signUp: (input: SignUpInput) => Promise<AuthAttempt>;
}) {
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const input: SignUpInput = {
      callbackURL,
      email: String(form.get("email")),
      name: String(form.get("name")),
      password: String(form.get("password")),
    };

    const result = await signUp(input);

    setPending(false);

    if (result?.error) {
      setError(result.error.message ?? "Unable to create the account.");
      return;
    }

    onEmailSent?.({ email: input.email, name: input.name });
    setEmailSent(true);
  }

  if (emailSent) {
    return <VerificationSentNotice callbackURL={callbackURL} />;
  }

  return (
    <>
      <AuthHeading
        description={signUpCopy.description}
        title={signUpCopy.title}
      />
      <form className="space-y-5" onSubmit={submit}>
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
          signIn={signInWithGoogle}
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
    </>
  );
}

/** What the sign-up page shows once the verification email has gone out. */
export function VerificationSentNotice({
  callbackURL,
}: {
  callbackURL: Route;
}) {
  return (
    <div className="space-y-5">
      <EnvelopeStamp className="text-ink h-28 w-auto" />
      <div className="space-y-1.5">
        <h1 className="type-heading">Check your email</h1>
        <p className="type-body text-ink-2">
          We sent a verification link. Verify your address before creating your
          Brand.
        </p>
      </div>
      <Link
        className="text-brand-text inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        href={`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`}
      >
        <IconArrowLeft aria-hidden="true" className="size-4" stroke={1.75} />
        Return to sign in
      </Link>
    </div>
  );
}
