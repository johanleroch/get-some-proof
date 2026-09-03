import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAction } = vi.hoisted(() => ({ fetchAction: vi.fn() }));
vi.mock("convex/nextjs", () => ({ fetchAction }));

import { POST } from "./route";

function request(body: string, secret: string, timestamp = Date.now()) {
  const seconds = Math.floor(timestamp / 1_000);
  const signature = createHmac("sha256", secret)
    .update(`${seconds}.${body}`)
    .digest("hex");
  return new Request("https://proof.example/api/mux/webhook", {
    body,
    headers: { "mux-signature": `t=${seconds},v1=${signature}` },
    method: "POST",
  });
}

describe("POST /api/mux/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(
      "MUX_WEBHOOK_SECRET",
      "mux-webhook-secret-with-at-least-32-chars",
    );
    vi.stubEnv(
      "VIDEO_WEBHOOK_INGEST_SECRET",
      "convex-ingest-secret-with-at-least-32-chars",
    );
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
    fetchAction.mockResolvedValue({ outcome: "ready" });
  });

  it("verifies the raw signed body before forwarding the event", async () => {
    const body = JSON.stringify({
      data: { id: "asset-1" },
      id: "event-1",
      type: "video.asset.ready",
    });

    const response = await POST(
      request(body, "mux-webhook-secret-with-at-least-32-chars"),
    );

    expect(response.status).toBe(200);
    expect(fetchAction).toHaveBeenCalledWith(expect.anything(), {
      event: JSON.parse(body),
      ingestSecret: "convex-ingest-secret-with-at-least-32-chars",
    });
  });

  it("rejects tampered and stale deliveries without touching Convex", async () => {
    const body = JSON.stringify({
      data: {},
      id: "event-1",
      type: "video.asset.ready",
    });
    const tampered = request(body, "wrong-mux-secret-with-at-least-32-chars");
    const stale = request(
      body,
      "mux-webhook-secret-with-at-least-32-chars",
      Date.now() - 10 * 60 * 1_000,
    );

    await expect(POST(tampered)).resolves.toMatchObject({ status: 401 });
    await expect(POST(stale)).resolves.toMatchObject({ status: 401 });
    expect(fetchAction).not.toHaveBeenCalled();
  });
});
