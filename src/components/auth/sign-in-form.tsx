"use client";

import { type FormEvent, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  async function signInWithGoogle() {
    setError(null);
    setPending(true);
    sessionStorage.setItem("post-two-factor-route", callbackURL);
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL,
      errorCallbackURL: "/sign-in?error=oauth",
    });

    if (result?.error) {
      setPending(false);
      setError(result.error.message ?? "Google sign-in is not configured.");
    }
  }

  return (
    <form className="space-y-5" onSubmit={signInWithEmail}>
      <div className="space-y-2">
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
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="password">Password</Label>
          <Link
            className="text-primary text-sm font-medium hover:underline"
            href="/forgot-password"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          autoComplete="current-password"
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
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <div className="text-muted-foreground before:border-border relative py-1 text-center text-xs uppercase before:absolute before:top-1/2 before:left-0 before:w-full before:border-t">
        <span className="bg-card relative px-3">or</span>
      </div>
      <Button
        className="w-full"
        disabled={pending}
        onClick={signInWithGoogle}
        type="button"
        variant="outline"
      >
        Continue with Google
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        New to Get Some Proof?{" "}
        <Link
          className="text-primary font-medium hover:underline"
          href={`/sign-up?callbackURL=${encodeURIComponent(callbackURL)}`}
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
