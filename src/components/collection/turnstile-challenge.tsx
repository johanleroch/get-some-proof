"use client";

import { useEffect, useRef, useState } from "react";

import { browserTurnstile } from "@/lib/turnstile-browser";

export function TurnstileChallenge({
  onToken,
  onWidget,
}: {
  onToken: (token: string | undefined) => void;
  onWidget: (widgetId: string | undefined) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [status, setStatus] = useState<"error" | "loading" | "ready">(
    "loading",
  );

  useEffect(() => {
    const hostname = window.location.hostname;
    const localSiteKey =
      hostname === "localhost" || hostname === "127.0.0.1"
        ? "1x00000000000000000000AA"
        : undefined;
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || localSiteKey;
    if (!sitekey || !containerRef.current) {
      queueMicrotask(() => setStatus("error"));
      return;
    }
    let widgetId: string | undefined;
    let cancelled = false;
    const render = () => {
      const turnstile = browserTurnstile();
      if (cancelled || !turnstile || !containerRef.current || widgetId) return;
      try {
        widgetId = turnstile.render(containerRef.current, {
          action: "collect_proof",
          callback: (token) => {
            setStatus("ready");
            onToken(token);
          },
          "error-callback": () => {
            setStatus("error");
            onToken(undefined);
          },
          "expired-callback": () => {
            setStatus("error");
            onToken(undefined);
          },
          sitekey,
        });
        onWidget(widgetId);
      } catch {
        queueMicrotask(() => setStatus("error"));
      }
    };
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-proof-turnstile="true"]',
    );
    const script = existing ?? document.createElement("script");
    const handleScriptError = () => {
      setStatus("error");
      onToken(undefined);
      script.remove();
    };
    if (!existing) {
      script.async = true;
      script.defer = true;
      script.dataset.proofTurnstile = "true";
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      document.head.append(script);
    }
    script.addEventListener("load", render);
    script.addEventListener("error", handleScriptError);
    render();
    return () => {
      cancelled = true;
      script.removeEventListener("load", render);
      script.removeEventListener("error", handleScriptError);
      if (widgetId) browserTurnstile()?.remove(widgetId);
      onToken(undefined);
      onWidget(undefined);
    };
  }, [onToken, onWidget, retryNonce]);

  return (
    <div>
      <div ref={containerRef} />
      {status === "loading" ? (
        <p className="text-muted-foreground text-sm" role="status">
          Verifying this submission…
        </p>
      ) : null}
      {status === "error" ? (
        <div className="space-y-2" role="alert">
          <p className="text-destructive text-sm">
            Verification is unavailable. Check your connection and try again.
          </p>
          <button
            className="rounded-md border px-3 py-2 text-sm font-medium"
            onClick={() => {
              setStatus("loading");
              setRetryNonce((value) => value + 1);
            }}
            type="button"
          >
            Retry verification
          </button>
        </div>
      ) : null}
      <noscript>JavaScript is required to verify this submission.</noscript>
    </div>
  );
}
