"use client";

import { blobToast } from "@/components/brand/blob-toast";
import { securityErrorMessage } from "@/lib/security-error-message";

import { Skeleton } from "@/components/ui/skeleton";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  IconDeviceLaptop,
  IconDeviceMobile,
  IconShieldCheck,
} from "@tabler/icons-react";

import { authenticatorBackHref } from "@/components/account/authenticator-view";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { SuccessToast } from "@/components/ui/error-toast";
import { authClient } from "@/lib/auth-client";

/** The Authenticator lives on its own page; this is the way in. */
const authenticatorHref = `${authenticatorBackHref}/authenticator` as Route;

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
  const methodsLoading = providers === null && !providerError;

  function reportError(
    error: Parameters<typeof securityErrorMessage>[0],
    fallback: string,
  ) {
    const { message, needsSignIn } = securityErrorMessage(error, fallback);
    blobToast.error(message, {
      id: "account-security-error",
      duration: 8000,
      ...(needsSignIn
        ? {
            action: {
              label: "Sign in again",
              onClick: () =>
                router.push("/sign-in?callbackURL=%2Faccount%2Fsecurity"),
            },
          }
        : {}),
    });
  }

  async function revokeSession(token: string) {
    setPending(true);
    setSuccess(null);
    try {
      const result = await authClient.revokeSession({ token });
      if (result.error) {
        reportError(
          result.error,
          "We couldn’t revoke access. Please try again.",
        );
        return;
      }
      blobToast.dismiss("account-security-error");
      if (token === currentToken) {
        router.replace("/sign-in");
        router.refresh();
        return;
      }
      setSuccess("Session revoked.");
      await refreshSessions();
    } catch {
      reportError(
        null,
        "Unable to complete this action. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function revokeOtherSessions() {
    setPending(true);
    setSuccess(null);
    try {
      const result = await authClient.revokeOtherSessions();
      if (result.error) {
        reportError(
          result.error,
          "We couldn’t revoke access. Please try again.",
        );
        return;
      }
      blobToast.dismiss("account-security-error");
      setSuccess("Every other Session was revoked.");
      await refreshSessions();
    } catch {
      reportError(
        null,
        "Unable to complete this action. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  const authenticatorStatus = !hasPassword
    ? "Your external sign-in provider carries the second step for this account."
    : twoFactorEnabled
      ? "On. Your app is asked for a six-digit code after your password."
      : "Off. Add a second step so a stolen password is never enough on its own.";

  return (
    <div className="space-y-6">
      <PageHeader
        description="These controls protect your Owner account and private Workspace."
        title="Security"
      />

      {success ? <SuccessToast message={success} /> : null}

      <section className="bg-card rounded-lg border p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="flex items-start gap-4">
            <div className="bg-brand-soft text-brand-text grid size-10 shrink-0 place-items-center rounded-md">
              <IconShieldCheck aria-hidden="true" className="size-5" />
            </div>
            <div className="max-w-prose">
              <h2 className="type-subheading">Authenticator app</h2>
              {providerError ? (
                <p className="text-ink-2 mt-1 text-sm" role="alert">
                  We couldn’t load your sign-in methods. Open the page to try
                  again.
                </p>
              ) : methodsLoading ? (
                <Skeleton className="mt-2 h-4 w-64 max-w-full" />
              ) : (
                <p className="text-ink-2 mt-1 text-sm">{authenticatorStatus}</p>
              )}
            </div>
          </div>
          {methodsLoading ? (
            <Skeleton className="h-10 w-28" />
          ) : (
            <Button
              asChild
              variant={twoFactorEnabled || !hasPassword ? "outline" : "default"}
            >
              <Link href={authenticatorHref}>
                {twoFactorEnabled || !hasPassword
                  ? "Manage authenticator"
                  : "Set up"}
              </Link>
            </Button>
          )}
        </div>
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
            <div
              className="flex items-center justify-between gap-4 p-4"
              role="status"
              aria-label="Loading Sessions"
            >
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-10 w-24" />
            </div>
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
