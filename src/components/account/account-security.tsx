"use client";

import { BlobLoadingText } from "@/components/brand/blob-loader";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconDeviceLaptop,
  IconDeviceMobile,
  IconKey,
  IconShieldCheck,
} from "@tabler/icons-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SuccessToast } from "@/components/ui/error-toast";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
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
  const [providers, setProviders] = useState<string[] | null>(null);
  const [providerError, setProviderError] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [setup, setSetup] = useState<{
    totpURI: string;
    backupCodes: string[];
  } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const refreshSessions = useCallback(() => {
    return authClient
      .listSessions()
      .then((result) => {
        setSessionsError(null);
        setNeedsSignIn(false);
        if (result.error) {
          setNeedsSignIn(
            result.error.code === "SESSION_NOT_FRESH" ||
              result.error.status === 401,
          );
          setSessionsError(
            result.error.code === "SESSION_NOT_FRESH"
              ? "Sign in again to review and manage your sessions."
              : (result.error.message ?? "Unable to load sessions."),
          );
        } else {
          setSessions((result.data ?? []) as Session[]);
        }
      })
      .catch(() => {
        setSessionsError(
          "Unable to load sessions. Check your connection and try again.",
        );
      });
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    let active = true;
    void authClient
      .listAccounts()
      .then((result) => {
        if (!active) return;
        if (result.error) setProviderError(true);
        else
          setProviders(
            (result.data ?? []).map((account) => account.providerId),
          );
      })
      .catch(() => {
        if (active) setProviderError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const hasPassword = providers?.includes("credential") ?? false;

  const twoFactorEnabled = Boolean(session.data?.user.twoFactorEnabled);
  const currentToken = session.data?.session.token;

  async function enableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const password = String(new FormData(form).get("password"));
      const result = await authClient.twoFactor.enable({
        password,
        issuer: "Get Some Proof",
      });
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
        setBackupCodes(result.data.backupCodes);
        setSuccess(
          "Add the authenticator, then enter its code to finish setup.",
        );
      }
    } catch {
      setError(
        "Unable to complete this action. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function verifyTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code"));
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code });
      if (result.error) {
        setError(result.error.message ?? "Invalid authenticator code.");
        return;
      }
      setSetup(null);
      await session.refetch();
      await refreshSessions();
      setSuccess("Two-factor authentication enabled.");
    } catch {
      setError("Unable to verify the code. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function disableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const password = String(new FormData(form).get("password"));
      const result = await authClient.twoFactor.disable({ password });
      form.reset();
      if (result.error) {
        setError(result.error.message ?? "Two-factor disable failed.");
        return;
      }
      setSetup(null);
      setBackupCodes(null);
      await session.refetch();
      await refreshSessions();
      setSuccess("Two-factor authentication disabled.");
    } catch {
      setError(
        "Unable to complete this action. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function regenerateCodes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const password = String(new FormData(form).get("password"));
      const result = await authClient.twoFactor.generateBackupCodes({
        password,
      });
      form.reset();
      if (result.error) {
        setError(result.error.message ?? "Recovery-code generation failed.");
        return;
      }
      setBackupCodes(result.data?.backupCodes ?? []);
      setSuccess("Previous recovery codes were invalidated.");
    } catch {
      setError(
        "Unable to complete this action. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function revokeSession(token: string) {
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
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
    } catch {
      setError(
        "Unable to complete this action. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function revokeOtherSessions() {
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await authClient.revokeOtherSessions();
      if (result.error) {
        setError(result.error.message ?? "Session revocation failed.");
        return;
      }
      setSuccess("Every other Session was revoked.");
      await refreshSessions();
    } catch {
      setError(
        "Unable to complete this action. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  const visibleCodes = backupCodes;

  return (
    <div className="space-y-6">
      <PageHeader
        description="These controls protect your Owner account and private Workspace."
        eyebrow="Account"
        title="Security"
      />

      {error ? (
        <div role="alert" className="text-danger text-sm">
          {error}
        </div>
      ) : null}
      {success ? <SuccessToast message={success} /> : null}

      <section className="bg-card rounded-lg border p-5">
        <div className="flex items-start gap-4">
          <div className="bg-brand-soft text-brand-text grid size-10 place-items-center rounded-md">
            <IconShieldCheck aria-hidden="true" className="size-5" />
          </div>
          <div>
            <h2 className="type-subheading">Authenticator app</h2>
            <p className="text-ink-2 mt-1 text-sm">
              Status: {twoFactorEnabled ? "enabled" : "not enabled"}
            </p>
          </div>
        </div>

        {providerError ? (
          <p className="mt-6 text-sm" role="alert">
            Unable to load sign-in methods. Reload this page to try again.
          </p>
        ) : providers === null ? (
          <BlobLoadingText label="Loading sign-in methods…" />
        ) : !hasPassword ? (
          <div className="mt-6 space-y-3 text-sm">
            <p>
              You sign in with{" "}
              {providers.includes("google") ? "Google" : "an external provider"}
              . Two-step verification for this sign-in is managed by that
              provider, not by a Get Some Proof password.
            </p>
            {providers.includes("google") ? (
              <Button asChild variant="outline">
                <a
                  href="https://myaccount.google.com/security"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Manage Google security
                </a>
              </Button>
            ) : null}
          </div>
        ) : !twoFactorEnabled && !setup ? (
          <form
            className="mt-6 flex max-w-md items-end gap-3"
            onSubmit={enableTwoFactor}
          >
            <Field className="flex-1">
              <Label htmlFor="enable-2fa-password">Current password</Label>
              <PasswordInput
                id="enable-2fa-password"
                name="password"
                required
              />
            </Field>
            <Button loading={pending} type="submit">
              Enable 2FA
            </Button>
          </form>
        ) : twoFactorEnabled ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <form className="space-y-3" onSubmit={regenerateCodes}>
              <Label htmlFor="codes-password">Regenerate recovery codes</Label>
              <PasswordInput id="codes-password" name="password" required />
              <Button loading={pending} type="submit" variant="outline">
                <IconKey aria-hidden="true" className="size-4" />
                Generate new codes
              </Button>
            </form>
            <form className="space-y-3" onSubmit={disableTwoFactor}>
              <Label htmlFor="disable-2fa-password">
                Disable with password
              </Label>
              <PasswordInput
                id="disable-2fa-password"
                name="password"
                required
              />
              <Button loading={pending} type="submit" variant="outline">
                Disable 2FA
              </Button>
            </form>
          </div>
        ) : null}

        {hasPassword && providers?.includes("google") ? (
          <p className="text-ink-2 mt-4 text-sm">
            This authenticator protects email and password sign-in. Google
            sign-in uses your Google account’s two-step verification.
          </p>
        ) : null}
        {setup ? (
          <div className="bg-surface-2 mt-6 rounded-md border p-4">
            <p className="text-sm font-medium">Authenticator setup URI</p>
            <code className="text-ink-2 mt-2 block text-xs break-all">
              {setup.totpURI}
            </code>
            <p className="mt-3 text-sm">
              Add this setup key to your authenticator app:
            </p>
            <code className="mt-2 block text-sm break-all">
              {new URL(setup.totpURI).searchParams.get("secret")}
            </code>
            <form
              className="mt-4 max-w-sm space-y-3"
              onSubmit={verifyTwoFactor}
            >
              <Label htmlFor="authenticator-code">Authenticator code</Label>
              <Input
                id="authenticator-code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
              />
              <Button loading={pending} type="submit">
                Verify and enable 2FA
              </Button>
            </form>
          </div>
        ) : null}

        {visibleCodes ? (
          <div className="border-warning/30 bg-warning-soft text-ink mt-6 rounded-md border p-4">
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

      <section className="bg-card rounded-lg border p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="type-subheading">Active Sessions</h2>
            <p className="text-ink-2 mt-1 text-sm">
              Review devices and revoke access you no longer recognize.
            </p>
          </div>
          <Button
            disabled={
              sessions === null ||
              Boolean(sessionsError) ||
              pending ||
              !sessions.some((item) => item.token !== currentToken)
            }
            onClick={() => void revokeOtherSessions()}
            variant="outline"
          >
            Revoke every other Session
          </Button>
        </div>

        <div className="mt-5 divide-y rounded-lg border">
          {sessionsError ? (
            <div className="space-y-3 p-4" role="alert">
              <p className="text-sm">{sessionsError}</p>
              {needsSignIn ? (
                <Button asChild variant="outline">
                  <Link href="/sign-in?callbackURL=%2Faccount%2Fsecurity">
                    Sign in again
                  </Link>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => void refreshSessions()}
                >
                  Retry loading sessions
                </Button>
              )}
            </div>
          ) : sessions === null ? (
            <BlobLoadingText label="Loading Sessions…" />
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
                ? IconDeviceMobile
                : IconDeviceLaptop;
              return (
                <div className="flex items-center gap-4 p-4" key={item.id}>
                  <DeviceIcon
                    aria-hidden="true"
                    className="text-ink-2 size-5"
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
                    disabled={pending}
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
  );
}
