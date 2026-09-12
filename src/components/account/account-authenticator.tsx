"use client";

import { useCallback, useEffect, useState } from "react";

import {
  AuthenticatorView,
  type RecoveryCodesReason,
} from "@/components/account/authenticator-view";
import { blobToast } from "@/components/brand/blob-toast";
import { authClient } from "@/lib/auth-client";
import { securityErrorMessage } from "@/lib/security-error-message";

export function AccountAuthenticator() {
  const session = authClient.useSession();
  const [providers, setProviders] = useState<string[] | null>(null);
  const [providersFailed, setProvidersFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{
    message: string;
    needsSignIn: boolean;
  } | null>(null);
  const [totpURI, setTotpURI] = useState<string | null>(null);
  /* Handed over when setup starts, but only useful once the app is verified. */
  const [heldCodes, setHeldCodes] = useState<string[] | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [codesReason, setCodesReason] =
    useState<RecoveryCodesReason>("enabled");

  useEffect(() => {
    let active = true;
    void authClient
      .listAccounts()
      .then((result) => {
        if (!active) return;
        if (result.error) setProvidersFailed(true);
        else setProviders((result.data ?? []).map((item) => item.providerId));
      })
      .catch(() => {
        if (active) setProvidersFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const report = useCallback(
    (cause: Parameters<typeof securityErrorMessage>[0], fallback: string) => {
      setError(securityErrorMessage(cause, fallback));
    },
    [],
  );

  /** Every action shares the same shape: clear, run, report, release. */
  const run = useCallback(async (action: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch {
      setError({
        message:
          "Unable to complete this action. Check your connection and try again.",
        needsSignIn: false,
      });
    } finally {
      setPending(false);
    }
  }, []);

  function start(password: string) {
    void run(async () => {
      const result = await authClient.twoFactor.enable({
        password,
        issuer: "Get Some Proof",
      });
      if (result.error) {
        report(
          result.error,
          "We couldn’t start the setup. Please try again in a moment.",
        );
        return;
      }
      if (!result.data) return;
      setTotpURI(result.data.totpURI);
      setHeldCodes(result.data.backupCodes);
    });
  }

  function verify(code: string) {
    void run(async () => {
      const result = await authClient.twoFactor.verifyTotp({ code });
      if (result.error) {
        report(result.error, "We couldn’t verify that code. Please try again.");
        return;
      }
      setCodesReason("enabled");
      setCodes(heldCodes);
      setHeldCodes(null);
      await session.refetch();
      blobToast.success("Two-step verification is on.", {
        id: "authenticator",
      });
    });
  }

  function regenerate(password: string) {
    void run(async () => {
      const result = await authClient.twoFactor.generateBackupCodes({
        password,
      });
      if (result.error) {
        report(
          result.error,
          "We couldn’t generate new recovery codes. Please try again.",
        );
        return;
      }
      setCodesReason("regenerated");
      setCodes(result.data?.backupCodes ?? []);
      blobToast.success("Your previous recovery codes were retired.", {
        id: "authenticator",
      });
    });
  }

  function disable(password: string) {
    void run(async () => {
      const result = await authClient.twoFactor.disable({ password });
      if (result.error) {
        report(
          result.error,
          "We couldn’t turn off two-step verification. Please try again.",
        );
        return;
      }
      setTotpURI(null);
      setHeldCodes(null);
      setCodes(null);
      await session.refetch();
      blobToast.success("Two-step verification is off.", {
        id: "authenticator",
      });
    });
  }

  return (
    <AuthenticatorView
      codes={codes}
      codesReason={codesReason}
      enabled={Boolean(session.data?.user.twoFactorEnabled)}
      error={error?.message ?? null}
      errorNeedsSignIn={error?.needsSignIn}
      onDisable={disable}
      onDismissCodes={() => {
        setCodes(null);
        setTotpURI(null);
      }}
      onRegenerate={regenerate}
      onStart={start}
      onVerify={verify}
      pending={pending}
      providers={providers}
      providersFailed={providersFailed}
      totpURI={totpURI}
    />
  );
}
