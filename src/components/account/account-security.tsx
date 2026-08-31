"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Laptop, ShieldCheck, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { authClient } from "@/lib/auth-client";

type Session = {
  id: string;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function deviceLabel(userAgent?: string | null) {
  if (!userAgent) return "Unknown device";
  if (/iphone|android|mobile/i.test(userAgent)) return "Mobile device";
  if (/mac/i.test(userAgent)) return "Mac";
  if (/windows/i.test(userAgent)) return "Windows device";
  if (/linux/i.test(userAgent)) return "Linux device";
  return "Browser session";
}

export function AccountSecurity() {
  const router = useRouter();
  const session = authClient.useSession();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [setup, setSetup] = useState<{
    totpURI: string;
    backupCodes: string[];
  } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const refreshSessions = useCallback(async () => {
    const result = await authClient.listSessions();
    if (result.error) {
      setError(result.error.message ?? "Unable to load Sessions.");
    } else {
      setSessions((result.data ?? []) as Session[]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void authClient.listSessions().then((result) => {
      if (!active) return;
      if (result.error) {
        setError(result.error.message ?? "Unable to load Sessions.");
      } else {
        setSessions((result.data ?? []) as Session[]);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const twoFactorEnabled = Boolean(session.data?.user.twoFactorEnabled);
  const currentToken = session.data?.session.token;

  async function enableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(null);
    setSuccess(null);
    const password = String(new FormData(form).get("password"));
    const result = await authClient.twoFactor.enable({
      password,
      issuer: "Convex Admin Starter",
    });
    setPending(false);
    form.reset();
    if (result.error) {
      setError(result.error.message ?? "Two-factor setup failed.");
      return;
    }
    if (result.data) {
      setSetup({
        totpURI: result.data.totpURI,
        backupCodes: result.data.backupCodes,
      });
      setSuccess("Two-factor authentication enabled.");
    }
  }

  async function disableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(null);
    const password = String(new FormData(form).get("password"));
    const result = await authClient.twoFactor.disable({ password });
    setPending(false);
    form.reset();
    if (result.error) {
      setError(result.error.message ?? "Two-factor disable failed.");
      return;
    }
    setSetup(null);
    setBackupCodes(null);
    setSuccess("Two-factor authentication disabled.");
  }

  async function regenerateCodes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(null);
    const password = String(new FormData(form).get("password"));
    const result = await authClient.twoFactor.generateBackupCodes({ password });
    setPending(false);
    form.reset();
    if (result.error) {
      setError(result.error.message ?? "Recovery-code generation failed.");
      return;
    }
    setBackupCodes(result.data?.backupCodes ?? []);
    setSuccess("Previous recovery codes were invalidated.");
  }

  async function revokeSession(token: string) {
    setError(null);
    const result = await authClient.revokeSession({ token });
    if (result.error) {
      setError(result.error.message ?? "Session revocation failed.");
      return;
    }
    if (token === currentToken) {
      router.replace("/sign-in");
      router.refresh();
      return;
    }
    setSuccess("Session revoked.");
    await refreshSessions();
  }

  async function revokeOtherSessions() {
    setError(null);
    const result = await authClient.revokeOtherSessions();
    if (result.error) {
      setError(result.error.message ?? "Session revocation failed.");
      return;
    }
    setSuccess("Every other Session was revoked.");
    await refreshSessions();
  }

  const visibleCodes = setup?.backupCodes ?? backupCodes;

  return (
    <main className="bg-muted/30 min-h-svh px-5 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <div className="flex items-center justify-between gap-4">
            <Link
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
              href="/dashboard"
            >
              ← Back to dashboard
            </Link>
            <ThemeToggle />
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            Account security
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            These controls protect your User account across every Organization.
          </p>
        </div>

        {error ? (
          <p
            aria-live="assertive"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}
        {success ? (
          <p
            aria-live="polite"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
          >
            {success}
          </p>
        ) : null}

        <section className="bg-card rounded-xl border p-6 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="bg-muted text-foreground grid size-10 place-items-center rounded-lg">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Authenticator app</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Status: {twoFactorEnabled ? "enabled" : "not enabled"}
              </p>
            </div>
          </div>

          {!twoFactorEnabled ? (
            <form
              className="mt-6 flex max-w-md items-end gap-3"
              onSubmit={enableTwoFactor}
            >
              <div className="flex-1 space-y-2">
                <Label htmlFor="enable-2fa-password">Current password</Label>
                <Input
                  id="enable-2fa-password"
                  name="password"
                  required
                  type="password"
                />
              </div>
              <Button disabled={pending} type="submit">
                Enable 2FA
              </Button>
            </form>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <form className="space-y-3" onSubmit={regenerateCodes}>
                <Label htmlFor="codes-password">
                  Regenerate recovery codes
                </Label>
                <Input
                  id="codes-password"
                  name="password"
                  required
                  type="password"
                />
                <Button disabled={pending} type="submit" variant="outline">
                  <KeyRound aria-hidden="true" className="size-4" />
                  Generate new codes
                </Button>
              </form>
              <form className="space-y-3" onSubmit={disableTwoFactor}>
                <Label htmlFor="disable-2fa-password">
                  Disable with password
                </Label>
                <Input
                  id="disable-2fa-password"
                  name="password"
                  required
                  type="password"
                />
                <Button disabled={pending} type="submit" variant="outline">
                  Disable 2FA
                </Button>
              </form>
            </div>
          )}

          {setup ? (
            <div className="bg-muted/30 mt-6 rounded-xl border p-4">
              <p className="text-sm font-medium">Authenticator setup URI</p>
              <code className="text-muted-foreground mt-2 block text-xs break-all">
                {setup.totpURI}
              </code>
            </div>
          ) : null}

          {visibleCodes ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <h3 className="font-semibold">Save these recovery codes now</h3>
              <p className="mt-1 text-sm">
                Each code works once. They will not remain visible after you
                dismiss them.
              </p>
              <ul className="mt-4 grid gap-2 font-mono text-sm sm:grid-cols-2">
                {visibleCodes.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
              <Button
                className="mt-4"
                onClick={() => {
                  setSetup(null);
                  setBackupCodes(null);
                }}
                type="button"
                variant="outline"
              >
                I saved these codes
              </Button>
            </div>
          ) : null}
        </section>

        <section className="bg-card rounded-xl border p-6 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Active Sessions</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Review devices and revoke access you no longer recognize.
              </p>
            </div>
            <Button
              onClick={() => void revokeOtherSessions()}
              variant="outline"
            >
              Revoke every other Session
            </Button>
          </div>

          <div className="mt-5 divide-y rounded-xl border">
            {sessions === null ? (
              <p className="text-muted-foreground p-4 text-sm">
                Loading Sessions…
              </p>
            ) : sessions.length === 0 ? (
              <p className="text-muted-foreground p-4 text-sm">
                No active Sessions found.
              </p>
            ) : (
              sessions.map((item) => {
                const isCurrent = item.token === currentToken;
                const DeviceIcon = /iphone|android|mobile/i.test(
                  item.userAgent ?? "",
                )
                  ? Smartphone
                  : Laptop;
                return (
                  <div className="flex items-center gap-4 p-4" key={item.id}>
                    <DeviceIcon
                      aria-hidden="true"
                      className="text-muted-foreground size-5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {deviceLabel(item.userAgent)}{" "}
                        {isCurrent ? "(current)" : ""}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {item.ipAddress ?? "IP unavailable"} · active{" "}
                        {new Date(item.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      aria-label={`Revoke ${deviceLabel(item.userAgent)}`}
                      onClick={() => void revokeSession(item.token)}
                      size="sm"
                      variant="ghost"
                    >
                      Revoke
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
