"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { safeInternalRoute } from "@/lib/safe-route";

export function TwoFactorChallenge() {
  const router = useRouter();
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const code = String(form.get("code")).trim();
    const result =
      mode === "totp"
        ? await authClient.twoFactor.verifyTotp({ code, trustDevice: true })
        : await authClient.twoFactor.verifyBackupCode({
            code,
            trustDevice: true,
          });
    setPending(false);

    if (result.error) {
      setError(result.error.message ?? "The verification code is invalid.");
      return;
    }

    const destination = safeInternalRoute(
      sessionStorage.getItem("post-two-factor-route"),
      "/dashboard",
    );
    sessionStorage.removeItem("post-two-factor-route");
    router.replace(destination);
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={verify}>
      <div className="space-y-2">
        <Label htmlFor="two-factor-code">
          {mode === "totp" ? "Authenticator code" : "Recovery code"}
        </Label>
        <Input
          autoComplete="one-time-code"
          id="two-factor-code"
          inputMode={mode === "totp" ? "numeric" : "text"}
          name="code"
          required
        />
      </div>
      {error ? (
        <p aria-live="assertive" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Verifying…" : "Verify"}
      </Button>
      <Button
        className="w-full"
        onClick={() => setMode(mode === "totp" ? "backup" : "totp")}
        type="button"
        variant="ghost"
      >
        {mode === "totp" ? "Use a recovery code" : "Use an authenticator code"}
      </Button>
    </form>
  );
}
