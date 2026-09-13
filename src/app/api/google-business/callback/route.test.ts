import { beforeEach, expect, it, vi } from "vitest";
const complete = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth-server", () => ({ fetchAuthAction: complete }));
import { GET } from "./route";
beforeEach(() => complete.mockReset());
it("does not exchange a denied or missing authorization", async () => {
  const result = await GET(
    new Request(
      "https://getsomeproof.com/api/google-business/callback?error=access_denied",
    ),
  );
  expect(result.status).toBe(400);
  expect(complete).not.toHaveBeenCalled();
  expect(result.headers.get("Cache-Control")).toBe("no-store");
});
it("returns to the authenticated Project without reflecting an external redirect", async () => {
  complete.mockResolvedValue("willow-ceramics");
  const result = await GET(
    new Request(
      "https://getsomeproof.com/api/google-business/callback?state=state&code=code&next=https://example.com",
    ),
  );
  expect(result.status).toBe(303);
  expect(result.headers.get("Location")).toBe(
    "/org/willow-ceramics/import?source=google",
  );
  expect(result.headers.get("Referrer-Policy")).toBe("no-referrer");
});
