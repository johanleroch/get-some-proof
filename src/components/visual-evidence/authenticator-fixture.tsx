"use client";

import { useState } from "react";

import {
  AuthenticatorView,
  type RecoveryCodesReason,
} from "@/components/account/authenticator-view";

/** A real `otpauth://` address, so the QR code in the capture is the real one. */
const fixtureTotpURI =
  "otpauth://totp/Get%20Some%20Proof:alex@fernhill.studio?secret=JBSWY3DPEHPK3PXPJBSWY3DP&issuer=Get%20Some%20Proof&algorithm=SHA1&digits=6&period=30";

const fixtureCodes = [
  "4kqd9-whxm2",
  "7bnrt-3vlc8",
  "u2xpe-9ha4k",
  "m6wzq-tf1nd",
  "y8cjr-52bvs",
  "p3ltk-x7dgm",
  "a9fhn-q4wre",
  "z5vbd-8mkct",
  "h1sxg-rj6pw",
  "c7dmu-2nyta",
];

function Screen({
  codes = null,
  codesReason = "enabled",
  enabled = false,
  error = null,
  errorNeedsSignIn,
  providers = ["credential"],
  totpURI = null,
}: {
  codes?: string[] | null;
  codesReason?: RecoveryCodesReason;
  enabled?: boolean;
  error?: string | null;
  errorNeedsSignIn?: boolean;
  providers?: string[] | null;
  totpURI?: string | null;
}) {
  /* Each state is its own capture, but the fixture still walks: the whole
     journey can be clicked through in the gallery without an Account. */
  const [shownCodes, setShownCodes] = useState(codes);
  const [reason, setReason] = useState(codesReason);
  const [isOn, setIsOn] = useState(enabled);
  const [uri, setUri] = useState(totpURI);
  return (
    <main className="bg-paper text-ink min-h-svh p-5 md:p-8">
      <AuthenticatorView
        codes={shownCodes}
        codesReason={reason}
        enabled={isOn}
        error={error}
        errorNeedsSignIn={errorNeedsSignIn}
        onDisable={() => {
          setIsOn(false);
          setUri(null);
          setShownCodes(null);
        }}
        onDismissCodes={() => {
          setShownCodes(null);
          setUri(null);
        }}
        onRegenerate={() => {
          setReason("regenerated");
          setShownCodes(fixtureCodes);
        }}
        onStart={() => setUri(fixtureTotpURI)}
        onVerify={() => {
          setReason("enabled");
          setShownCodes(fixtureCodes);
          setIsOn(true);
        }}
        pending={false}
        providers={providers}
        totpURI={uri}
      />
    </main>
  );
}

/** Step one: nothing set up yet, the Owner confirms their password. */
export function AuthenticatorScreenFixture() {
  return <Screen />;
}

/** Step two: the QR code, the fallback key and the six-digit field. */
export function AuthenticatorSetupScreenFixture() {
  return <Screen totpURI={fixtureTotpURI} />;
}

/** Step three: the recovery codes, waiting to be saved. */
export function AuthenticatorCodesScreenFixture() {
  return <Screen codes={fixtureCodes} totpURI={fixtureTotpURI} />;
}

/** Already on: the two things left to do with it. */
export function AuthenticatorOnScreenFixture() {
  return <Screen enabled providers={["credential", "google"]} />;
}

/** A refused password, answered in place rather than in a toast. */
export function AuthenticatorErrorScreenFixture() {
  return (
    <Screen error="That password is incorrect. Enter your current account password and try again." />
  );
}

/** Google-only sign-in: there is no password here for a second step to guard. */
export function AuthenticatorExternalScreenFixture() {
  return <Screen providers={["google"]} />;
}
