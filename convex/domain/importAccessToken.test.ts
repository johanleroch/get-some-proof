import { expect, it, vi } from "vitest";
import { verifyImportAccessToken } from "./importAccessToken";

it("checks expiry at the HTTP boundary and carries that verified time into private queries", async () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(1_800_000_000_250);
    const issuedAt = Math.floor(Date.now() / 1000);
    const verifyJwt = vi.fn().mockResolvedValue({
      payload: {
        sub: "owner-willow",
        azp: "import-client",
        scope: "testimonials:import",
        iat: issuedAt,
        exp: issuedAt + 900,
      },
    });
    expect(
      await verifyImportAccessToken(
        "Bearer header.payload.signature",
        verifyJwt,
      ),
    ).toEqual({
      actorId: "owner-willow",
      clientId: "import-client",
      issuedAt: issuedAt * 1000,
      expiresAt: (issuedAt + 900) * 1000,
      verifiedAt: Date.now(),
    });
    vi.setSystemTime((issuedAt + 900) * 1000);
    expect(
      await verifyImportAccessToken(
        "Bearer header.payload.signature",
        verifyJwt,
      ),
    ).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
