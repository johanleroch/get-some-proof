import { ConvexError } from "convex/values";

const siteverifyUrl =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const localTestSecret = "1x0000000000000000000000000000000AA";

type TurnstileResult = {
  action?: unknown;
  hostname?: unknown;
  success?: unknown;
};

function forbidden(): never {
  throw new ConvexError({
    code: "COLLECTION_BOT_VERIFICATION_FAILED",
    message: "Verification failed. Refresh and try again.",
  });
}

function configuredHostnames() {
  const explicit = (process.env.TURNSTILE_HOSTNAMES ?? "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  if (explicit.length > 0) return new Set(explicit);
  try {
    const hostname = new URL(process.env.SITE_URL ?? "").hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return new Set(["localhost", "127.0.0.1"]);
    }
  } catch {
    // Missing or invalid configuration fails closed below.
  }
  return new Set<string>();
}

export function isValidTurnstileResult(
  result: TurnstileResult,
  expectedAction: string,
  expectedHostnames: Set<string>,
) {
  return (
    result.success === true &&
    result.action === expectedAction &&
    typeof result.hostname === "string" &&
    expectedHostnames.has(result.hostname.toLowerCase())
  );
}

export async function verifyTurnstileToken(
  token: string | undefined,
  expectedAction: "collect_proof",
) {
  if (
    process.env.NODE_ENV === "test" &&
    process.env.TURNSTILE_ENFORCE_IN_TESTS !== "true" &&
    token === undefined
  )
    return;
  if (!token || token.length > 2_048) forbidden();

  const expectedHostnames = configuredHostnames();
  const configuredSecret = process.env.TURNSTILE_SECRET;
  const localOnly = [...expectedHostnames].every(
    (hostname) => hostname === "localhost" || hostname === "127.0.0.1",
  );
  const secret = configuredSecret || (localOnly ? localTestSecret : undefined);
  if (!secret || expectedHostnames.size === 0) forbidden();

  try {
    const response = await fetch(siteverifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({ response: token, secret }),
    });
    if (!response.ok) throw new Error(`siteverify ${response.status}`);
    const result = (await response.json()) as TurnstileResult;
    if (!isValidTurnstileResult(result, expectedAction, expectedHostnames)) {
      forbidden();
    }
  } catch (error) {
    if (error instanceof ConvexError) throw error;
    forbidden();
  }
}
