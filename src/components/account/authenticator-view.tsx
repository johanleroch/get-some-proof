"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  IconArrowLeft,
  IconCheck,
  IconDownload,
  IconKey,
  IconLoader2,
} from "@tabler/icons-react";

import { ArrowNote } from "@/components/doodles";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { CodeInput } from "@/components/ui/code-input";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { QrCode } from "@/components/ui/qr-code";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const authenticatorBackHref = "/account/security";

/** Why the codes on screen are being shown, which changes what to say. */
export type RecoveryCodesReason = "enabled" | "regenerated";

export type AuthenticatorViewProps = {
  /** Ten one-time codes waiting to be saved, or null when there are none. */
  codes: string[] | null;
  codesReason: RecoveryCodesReason;
  enabled: boolean;
  error: string | null;
  /** True while the error asks for a fresher sign-in. */
  errorNeedsSignIn?: boolean;
  /** Null while the Account's sign-in methods are still loading. */
  providers: string[] | null;
  providersFailed?: boolean;
  pending: boolean;
  /** The `otpauth://` address once setup has started. */
  totpURI: string | null;
  onDisable: (password: string) => void;
  onDismissCodes: () => void;
  onRegenerate: (password: string) => void;
  onStart: (password: string) => void;
  onVerify: (code: string) => void;
};

function secretFromUri(totpURI: string) {
  try {
    return new URL(totpURI).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

/** The secret reads in groups of four, the way a card number does. */
function groupedSecret(secret: string) {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

function StepMark({ index, state }: { index: number; state: StepState }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "type-small grid size-8 shrink-0 place-items-center rounded-full font-semibold tabular-nums transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out-soft)]",
        state === "done" && "bg-success-soft text-success",
        state === "current" && "bg-brand text-brand-ink",
        state === "waiting" && "bg-surface-2 text-ink-2",
      )}
    >
      {state === "done" ? <IconCheck className="size-4" /> : index}
    </span>
  );
}

type StepState = "done" | "current" | "waiting";

function Step({
  children,
  index,
  last,
  state,
  title,
}: {
  children?: ReactNode;
  index: number;
  last?: boolean;
  state: StepState;
  title: string;
}) {
  return (
    <li className="grid gap-x-4 md:grid-cols-[2rem_minmax(0,1fr)]">
      {/* The rail needs a column beside the content to live in. A phone has
          no room to spare, so the mark joins the title instead. */}
      <div className="hidden grid-rows-[auto_1fr] justify-items-center gap-2 md:grid">
        <StepMark index={index} state={state} />
        {last ? null : <span className="bg-line w-px rounded-full" />}
      </div>
      <div className={cn("min-w-0", last ? "pb-0" : "pb-8")}>
        <div className="flex h-8 items-center justify-center gap-3 md:justify-start">
          <span className="md:hidden">
            <StepMark index={index} state={state} />
          </span>
          <h2
            className={cn(
              "type-subheading transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out-soft)]",
              state === "waiting" && "text-ink-2",
            )}
          >
            {title}
          </h2>
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </li>
  );
}

/** A step's content when it opens, arriving from just above its mark. */
function Revealed({ children }: { children: ReactNode }) {
  return (
    <div className="animate-in fade-in-0 slide-in-from-top-2 duration-[var(--motion-settle)] ease-[var(--ease-settle-soft)] motion-reduce:animate-none">
      {children}
    </div>
  );
}

function ErrorNote({
  message,
  needsSignIn,
}: {
  message: string | null;
  needsSignIn?: boolean;
}) {
  if (!message) return null;
  return (
    <div className="mt-4 grid justify-items-center gap-3 md:justify-items-start">
      <FieldError>{message}</FieldError>
      {needsSignIn ? (
        <Button asChild size="sm" variant="outline">
          <Link href="/sign-in?callbackURL=%2Faccount%2Fsecurity%2Fauthenticator">
            Sign in again
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function RecoveryCodes({
  codes,
  onDismiss,
  reason,
}: {
  codes: string[];
  onDismiss: () => void;
  reason: RecoveryCodesReason;
}) {
  const asText = codes.join("\n");

  function download() {
    const url = URL.createObjectURL(
      new Blob([`Get Some Proof recovery codes\n\n${asText}\n`], {
        type: "text/plain",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "get-some-proof-recovery-codes.txt";
    // Attached and revoked late: some browsers read the blob after the click
    // returns, and a detached anchor or an immediate revoke drops the file.
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <div className="border-line grid gap-4 rounded-lg border p-5">
      <div className="grid gap-1 text-center md:text-left">
        <p className="type-ui font-semibold">
          {reason === "regenerated"
            ? "Your previous codes no longer work"
            : "Keep these somewhere safe"}
        </p>
        <p className="type-small text-ink-2">
          Each code signs you in once if you lose your phone. They will not be
          shown again.
        </p>
      </div>
      <ul className="bg-surface-2 grid gap-x-6 gap-y-2 rounded-md p-4 text-center font-mono text-sm tracking-wide md:grid-cols-2 md:text-left">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
        <CopyButton value={asText} variant="outline">
          Copy codes
        </CopyButton>
        <Button onClick={download} type="button" variant="outline">
          <IconDownload aria-hidden="true" className="size-4" />
          Download
        </Button>
        <Button className="md:ms-auto" onClick={onDismiss} type="button">
          I saved them
        </Button>
      </div>
    </div>
  );
}

/** The account typed in by hand, for whoever cannot scan or tap a link. */
function ManualKey({ label, secret }: { label: string; secret: string }) {
  return (
    <div className="grid w-full justify-items-center gap-2 md:justify-items-start">
      <p className="type-small text-ink-2">{label}</p>
      <p className="bg-surface-2 w-full rounded-md px-3 py-2 text-center font-mono text-sm break-all md:text-left">
        {groupedSecret(secret)}
      </p>
      <CopyButton value={secret} variant="outline">
        Copy key
      </CopyButton>
    </div>
  );
}

/** One row of the managed list, with its password form folded underneath. */
function ManagedAction({
  action,
  description,
  fieldId,
  onSubmit,
  open,
  onToggle,
  pending,
  title,
  trigger,
}: {
  action: string;
  description: string;
  fieldId: string;
  onSubmit: (password: string) => void;
  open: boolean;
  onToggle: () => void;
  pending: boolean;
  title: string;
  trigger: ReactNode;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    onSubmit(String(new FormData(form).get("password")));
    form.reset();
  }

  return (
    <div className="grid gap-4 p-5">
      {/* Both rows keep the same shape on a wide screen, so the buttons line
          up on one right edge instead of one of them wrapping. A phone stacks
          them instead of squeezing the words into a column. */}
      <div className="grid justify-items-center gap-3 text-center md:flex md:flex-wrap md:items-start md:justify-between md:gap-x-6 md:gap-y-3 md:text-left">
        <div className="grid gap-1 md:max-w-md md:min-w-0 md:flex-1">
          <h3 className="type-ui font-semibold">{title}</h3>
          <p className="type-small text-ink-2">{description}</p>
        </div>
        <Button
          aria-expanded={open}
          className="shrink-0"
          disabled={pending && !open}
          onClick={onToggle}
          type="button"
          variant="outline"
        >
          {open ? "Cancel" : trigger}
        </Button>
      </div>
      {open ? (
        <Revealed>
          <form
            className="flex flex-wrap items-end justify-center gap-3 md:justify-start"
            onSubmit={submit}
          >
            <Field className="min-w-56 flex-1">
              <Label
                className="justify-center md:justify-start"
                htmlFor={fieldId}
              >
                Current password
              </Label>
              <PasswordInput
                autoComplete="current-password"
                id={fieldId}
                name="password"
                required
              />
            </Field>
            <Button loading={pending} type="submit">
              {action}
            </Button>
          </form>
        </Revealed>
      ) : null}
    </div>
  );
}

export function AuthenticatorView({
  codes,
  codesReason,
  enabled,
  error,
  errorNeedsSignIn,
  onDisable,
  onDismissCodes,
  onRegenerate,
  onStart,
  onVerify,
  pending,
  providers,
  providersFailed,
  totpURI,
}: AuthenticatorViewProps) {
  const [openAction, setOpenAction] = useState<"codes" | "off" | null>(null);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  /* A phone cannot photograph its own screen, so the QR code is useless on
     the device that is showing it. There, the account is handed to the app
     through the `otpauth://` link it registers, or typed in by hand. */
  const isMobile = useIsMobile();

  const loading = providers === null && !providersFailed;
  const hasPassword = providers?.includes("credential") ?? false;
  const usesGoogle = providers?.includes("google") ?? false;
  /* The recovery codes are handed over at the very start of setup, but they
     only mean anything once the code has been verified, so they are held back
     until then and shown as the last step. Two-step verification is already on
     by that point, and the journey stays on screen until the codes are put
     away, so the last step can actually be completed. */
  const finishing = Boolean(codes && codesReason === "enabled");

  const header = (
    <PageHeader
      description="After your password, a code from your phone — so a stolen password is not enough."
      leading={
        <Button asChild className="shrink-0" size="icon" variant="ghost">
          <Link
            aria-label="Back to Security"
            href={authenticatorBackHref as Route}
          >
            <IconArrowLeft aria-hidden="true" />
          </Link>
        </Button>
      }
      title="Authenticator app"
    />
  );

  if (loading) {
    return (
      <div
        aria-busy="true"
        className="mx-auto grid w-full max-w-5xl gap-8"
        role="status"
        aria-label="Loading your sign-in methods"
      >
        {header}
        <div className="grid max-w-3xl gap-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-10 w-44" />
        </div>
      </div>
    );
  }

  if (providersFailed) {
    return (
      <div className="mx-auto grid w-full max-w-5xl gap-8">
        {header}
        <div className="grid max-w-prose justify-items-center gap-4 text-center md:justify-items-start md:text-left">
          <p className="type-body" role="alert">
            We couldn’t load your sign-in methods. Reload this page to try
            again.
          </p>
        </div>
      </div>
    );
  }

  /* Signing in through Google alone means there is no password for a second
     step to stand beside: Google carries the whole sign-in. */
  if (!hasPassword) {
    return (
      <div className="mx-auto grid w-full max-w-5xl gap-8">
        {header}
        <section className="border-line grid max-w-prose justify-items-center gap-4 border-y py-6 text-center md:justify-items-start md:text-left">
          <h2 className="type-heading">
            {usesGoogle ? "Google guards this account" : "Managed elsewhere"}
          </h2>
          <p className="type-body text-ink-2">
            You sign in with{" "}
            {usesGoogle ? "Google" : "an external sign-in provider"}, so there
            is no Get Some Proof password for an authenticator to protect. Turn
            on two-step verification there and it covers this account too.
          </p>
          {usesGoogle ? (
            <Button asChild variant="outline">
              <a
                href="https://myaccount.google.com/security"
                rel="noopener noreferrer"
                target="_blank"
              >
                Manage Google security
              </a>
            </Button>
          ) : null}
        </section>
      </div>
    );
  }

  if (enabled && !finishing) {
    return (
      <div className="mx-auto grid w-full max-w-5xl gap-8">
        {header}
        <div className="grid max-w-3xl gap-6">
          <p
            className="type-body text-success flex items-center justify-center gap-2 md:justify-start"
            role="status"
          >
            <span
              aria-hidden="true"
              className="bg-success size-2 shrink-0 rounded-full"
            />
            Two-step verification is on for this account.
          </p>

          {codes ? (
            <Revealed>
              <RecoveryCodes
                codes={codes}
                onDismiss={onDismissCodes}
                reason={codesReason}
              />
            </Revealed>
          ) : null}

          <div className="border-line divide-line divide-y rounded-lg border">
            <ManagedAction
              action="Generate new codes"
              description="Ten one-time codes that get you back in if you lose your phone. Generating new ones retires the old set."
              fieldId="authenticator-codes-password"
              onSubmit={(password) => {
                setOpenAction(null);
                onRegenerate(password);
              }}
              onToggle={() =>
                setOpenAction(openAction === "codes" ? null : "codes")
              }
              open={openAction === "codes"}
              pending={pending}
              title="Recovery codes"
              trigger={
                <>
                  <IconKey aria-hidden="true" className="size-4" />
                  Generate new codes
                </>
              }
            />
            <ManagedAction
              action="Turn off"
              description="Your password alone will sign you in, and your recovery codes stop working."
              fieldId="authenticator-disable-password"
              onSubmit={(password) => {
                setOpenAction(null);
                onDisable(password);
              }}
              onToggle={() =>
                setOpenAction(openAction === "off" ? null : "off")
              }
              open={openAction === "off"}
              pending={pending}
              title="Turn off the authenticator"
              trigger="Turn off"
            />
          </div>

          <ErrorNote message={error} needsSignIn={errorNeedsSignIn} />

          {usesGoogle ? (
            <p className="type-small text-ink-2 text-center md:text-left">
              This protects email and password sign-in. Signing in with Google
              follows your Google account’s own two-step verification.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const secret = totpURI ? secretFromUri(totpURI) : "";
  const step = finishing ? 3 : totpURI ? 2 : 1;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8">
      {header}
      <div className="grid max-w-3xl items-start gap-8">
        <ol className="grid">
          <Step
            index={1}
            state={step > 1 ? "done" : "current"}
            title="Confirm it’s you"
          >
            {step === 1 ? (
              <>
                <form
                  className="flex flex-wrap items-end justify-center gap-3 md:justify-start"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    onStart(String(new FormData(form).get("password")));
                    form.reset();
                  }}
                >
                  <Field className="min-w-56 flex-1 text-center md:text-left">
                    <Label
                      className="justify-center md:justify-start"
                      htmlFor="authenticator-password"
                    >
                      Current password
                    </Label>
                    <PasswordInput
                      autoComplete="current-password"
                      id="authenticator-password"
                      name="password"
                      required
                    />
                  </Field>
                  <Button loading={pending} type="submit">
                    Continue
                  </Button>
                </form>
                <ErrorNote message={error} needsSignIn={errorNeedsSignIn} />
              </>
            ) : null}
          </Step>

          <Step
            index={2}
            state={step > 2 ? "done" : step === 2 ? "current" : "waiting"}
            title={isMobile ? "Add it to your app" : "Scan it with your app"}
          >
            {step === 2 && totpURI ? (
              <Revealed>
                <div className="grid gap-5">
                  <div className="grid justify-items-center gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:justify-items-stretch">
                    {isMobile ? (
                      <div className="grid w-full justify-items-center gap-3">
                        <Button asChild className="w-full max-w-xs">
                          {/* The scheme every authenticator app registers: it
                              opens with the account already filled in. */}
                          <a href={totpURI}>Open your authenticator app</a>
                        </Button>
                        <ManualKey
                          label="or add it by hand with this key"
                          secret={secret}
                        />
                      </div>
                    ) : (
                      <div className="grid justify-items-start gap-2">
                        <QrCode
                          className="size-64"
                          label="QR code for your authenticator app"
                          value={totpURI}
                        />
                        <ArrowNote
                          arrow="rise"
                          className="ps-6"
                          direction="left"
                          size="sm"
                        >
                          point your camera here
                        </ArrowNote>
                      </div>
                    )}

                    {/* Scanning and typing sit side by side: one gesture
                        leads straight into the other. */}
                    <form
                      className="grid w-full max-w-sm min-w-0 gap-3 text-center md:text-left"
                      onSubmit={(event) => {
                        event.preventDefault();
                        onVerify(
                          String(new FormData(event.currentTarget).get("code")),
                        );
                      }}
                    >
                      <Field className="min-w-0">
                        <Label
                          className="justify-center md:justify-start"
                          htmlFor="authenticator-code"
                          id="authenticator-code-label"
                        >
                          Then type the code it shows
                        </Label>
                        <CodeInput
                          describedBy="authenticator-code-hint"
                          disabled={pending}
                          id="authenticator-code"
                          invalid={Boolean(error)}
                          labelledBy="authenticator-code-label"
                          name="code"
                          // The last digit is the gesture. No button in the
                          // way; one appears only if the code is refused.
                          onComplete={onVerify}
                        />
                        <FieldDescription id="authenticator-code-hint">
                          It changes every 30 seconds.
                        </FieldDescription>
                      </Field>
                      {pending ? (
                        <p
                          className="type-small text-ink-2 flex items-center justify-center gap-2 md:justify-start"
                          role="status"
                        >
                          <IconLoader2
                            aria-hidden="true"
                            className="size-4 animate-spin motion-reduce:animate-none"
                          />
                          Checking the code…
                        </p>
                      ) : null}
                      <ErrorNote
                        message={error}
                        needsSignIn={errorNeedsSignIn}
                      />
                      {error && !errorNeedsSignIn ? (
                        <Button
                          className="justify-self-center md:justify-self-start"
                          type="submit"
                          variant="outline"
                        >
                          Try again
                        </Button>
                      ) : null}
                    </form>
                  </div>

                  {/* Both ways out of trouble live in one place, folded away
                      until something goes wrong. */}
                  <div className="grid justify-items-center gap-3 md:justify-items-start">
                    <Button
                      aria-expanded={fallbackOpen}
                      // Pulled back by its own padding, so the label starts on
                      // the same line as the content above it.
                      className="md:-ms-3"
                      onClick={() => setFallbackOpen(!fallbackOpen)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {isMobile ? "No app yet?" : "Can’t scan it?"}
                    </Button>
                    {fallbackOpen ? (
                      <Revealed>
                        <div className="border-line grid max-w-md gap-4 rounded-lg border p-4 text-center md:text-left">
                          {/* The key is already on screen on a phone. */}
                          {isMobile ? null : (
                            <ManualKey
                              label="Add the account by hand with this key:"
                              secret={secret}
                            />
                          )}
                          <p className="type-small text-ink-2">
                            Google Authenticator, 1Password and Bitwarden all
                            work, and all work offline.
                          </p>
                        </div>
                      </Revealed>
                    ) : null}
                  </div>
                </div>
              </Revealed>
            ) : null}
          </Step>

          <Step
            index={3}
            last
            state={step === 3 ? "current" : "waiting"}
            title="Save your recovery codes"
          >
            {step === 3 && codes ? (
              <Revealed>
                <RecoveryCodes
                  codes={codes}
                  onDismiss={onDismissCodes}
                  reason={codesReason}
                />
              </Revealed>
            ) : null}
          </Step>
        </ol>
      </div>
    </div>
  );
}
