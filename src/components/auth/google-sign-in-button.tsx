"use client";

import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function GoogleSignInButton({
  callbackURL,
  pending,
  setPending,
  setError,
}: {
  callbackURL: Route;
  pending: boolean;
  setPending: (pending: boolean) => void;
  setError: (error: string | null) => void;
}) {
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
    <>
      <div className="text-ink-2 before:border-line relative py-1 text-center text-xs font-semibold tracking-[0.06em] uppercase before:absolute before:top-1/2 before:left-0 before:w-full before:border-t">
        <span className="bg-background relative px-3">or</span>
      </div>
      <Button
        className="w-full"
        disabled={pending}
        onClick={signInWithGoogle}
        type="button"
        variant="outline"
      >
        <svg
          aria-hidden="true"
          className="size-5"
          viewBox="0 0 48 48"
          focusable="false"
        >
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.02 46.98 31.86 46.98 24.55Z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.78-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
          />
        </svg>
        Continue with Google
      </Button>
    </>
  );
}
