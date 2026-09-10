import { createHash } from "node:crypto";
import { importPreviewSessionKey } from "@/lib/import-preview-session";

export const runtime = "nodejs";

// This document runs before the application or any analytics. Fragments are not
// sent with HTTP requests; remove it before navigating into the normal app.
const script = `(() => {
  const fragment = location.hash;
  history.replaceState(null, "", "/import/continue");
  try {
    const match = /^#preview=([a-f0-9]{64})$/.exec(fragment);
    if (!match) throw new Error("Unavailable preview");
    localStorage.setItem(${JSON.stringify(importPreviewSessionKey)}, JSON.stringify({ token: match[1], resume: true }));
    location.replace("/import");
  } catch {
    location.replace("/import?handoff=failed");
  }
})();`;
const scriptHash = createHash("sha256").update(script).digest("base64");

export function GET() {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Continue your import</title></head><body><script>${script}</script><noscript>Enable JavaScript to continue your import. Your preview is still available in ChatGPT.</noscript></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": `default-src 'none'; script-src 'sha256-${scriptHash}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
