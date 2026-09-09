"use client";

import { type FormEvent, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Button } from "@/components/ui/button";
import { ErrorToast } from "@/components/ui/error-toast";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function SignInForm({
  callbackURL = "/dashboard",
}: {
  callbackURL?: Route;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signInWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const destination = callbackURL;
    sessionStorage.setItem("post-two-factor-route", destination);
    const result = await authClient.signIn.email({
      email,
      password: String(form.get("password")),
      callbackURL: destination,
    });

    setPending(false);

    if (result.error) {
      setError(result.error.message ?? "Unable to sign in.");
      return;
    }

    if (result.data && "twoFactorRedirect" in result.data) {
      return;
    }

    router.push(destination);
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={signInWithEmail}>
      <Field>
        <Label htmlFor="email">Email address</Label>
        <Input
          autoComplete="email"
          id="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </Field>
      <Field>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="password">Password</Label>
          <Link
            className="text-brand-text text-sm font-medium hover:underline"
            href="/forgot-password"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          autoComplete="current-password"
          id="password"
          minLength={8}
          name="password"
          required
        />
      </Field>
      {error ? <ErrorToast message={error} /> : null}
      <Button className="w-full" loading={pending} type="submit">
        Sign in
      </Button>
      <GoogleSignInButton
        callbackURL={callbackURL}
        pending={pending}
        setPending={setPending}
        setError={setError}
      />
      <p className="text-ink-2 text-center text-sm">
        New to Get Some Proof?{" "}
        <Link
          className="text-brand-text font-medium hover:underline"
          href={`/sign-up?callbackURL=${encodeURIComponent(callbackURL)}`}
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
