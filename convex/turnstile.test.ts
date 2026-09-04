import { afterEach, describe, expect, it, vi } from "vitest";

import { isValidTurnstileResult, verifyTurnstileToken } from "./turnstile";

describe("Turnstile result validation", () => {
  const hostnames = new Set(["proof.example"]);

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("requires success, the collection action, and an approved hostname", () => {
    expect(
      isValidTurnstileResult(
        { action: "collect_proof", hostname: "proof.example", success: true },
        "collect_proof",
        hostnames,
      ),
    ).toBe(true);
    expect(
      isValidTurnstileResult(
        { action: "other", hostname: "proof.example", success: true },
        "collect_proof",
        hostnames,
      ),
    ).toBe(false);
    expect(
      isValidTurnstileResult(
        {
          action: "collect_proof",
          hostname: "attacker.example",
          success: true,
        },
        "collect_proof",
        hostnames,
      ),
    ).toBe(false);
    expect(
      isValidTurnstileResult(
        { action: "collect_proof", hostname: "proof.example", success: false },
        "collect_proof",
        hostnames,
      ),
    ).toBe(false);
  });

  it("fails closed when Siteverify rejects or cannot be reached", async () => {
    vi.stubEnv("TURNSTILE_SECRET", "test-secret");
    vi.stubEnv("TURNSTILE_HOSTNAMES", "proof.example");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            action: "collect_proof",
            hostname: "proof.example",
            success: false,
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      verifyTurnstileToken("rejected-token", "collect_proof"),
    ).rejects.toMatchObject({
      data: { code: "COLLECTION_BOT_VERIFICATION_FAILED" },
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(
      verifyTurnstileToken("unreachable-token", "collect_proof"),
    ).rejects.toMatchObject({
      data: { code: "COLLECTION_BOT_VERIFICATION_FAILED" },
    });
  });

  it("accepts only the canonical successful response and sends form-encoded credentials", async () => {
    vi.stubEnv("TURNSTILE_SECRET", "test-secret");
    vi.stubEnv("TURNSTILE_HOSTNAMES", "proof.example");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          action: "collect_proof",
          hostname: "proof.example",
          success: true,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      verifyTurnstileToken("fresh-token", "collect_proof"),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    expect(request.method).toBe("POST");
    expect(String(request.body)).toContain("secret=test-secret");
    expect(String(request.body)).toContain("response=fresh-token");
  });

  it("accepts Cloudflare's official passing test response only for automatic localhost configuration", async () => {
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    vi.stubEnv("TURNSTILE_HOSTNAMES", "");
    vi.stubEnv("TURNSTILE_SECRET", "");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ hostname: "example.com", success: true }),
            { status: 200 },
          ),
        ),
    );

    await expect(
      verifyTurnstileToken("official-local-test-token", "collect_proof"),
    ).resolves.toBeUndefined();

    vi.stubEnv("TURNSTILE_HOSTNAMES", "localhost");
    await expect(
      verifyTurnstileToken("explicit-hostname-token", "collect_proof"),
    ).rejects.toMatchObject({
      data: { code: "COLLECTION_BOT_VERIFICATION_FAILED" },
    });

    vi.stubEnv("TURNSTILE_HOSTNAMES", "");
    vi.stubEnv("TURNSTILE_SECRET", "explicit-secret");
    await expect(
      verifyTurnstileToken("same-shape-with-explicit-secret", "collect_proof"),
    ).rejects.toMatchObject({
      data: { code: "COLLECTION_BOT_VERIFICATION_FAILED" },
    });
  });
});
