import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@convex/_generated/api";
import { hashSubmissionManagementToken } from "@convex/domain/submission";
import { deriveVideoRetryToken } from "@convex/domain/video";
import { buildPublicationConsent } from "@convex/domain/submission";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";

const webhookSecret = "mux-webhook-secret-with-at-least-32-chars";
const retrySecret = "retry-token-secret-with-at-least-32-characters";

function signedRequest(body: string, timestamp = Date.now()) {
  const seconds = Math.floor(timestamp / 1_000);
  const signature = createHmac("sha256", webhookSecret)
    .update(`${seconds}.${body}`)
    .digest("hex");
  return {
    body,
    headers: { "mux-signature": `t=${seconds},v1=${signature}` },
    method: "POST",
  };
}

describe("POST /mux/webhook", () => {
  beforeEach(() => {
    vi.stubEnv("EMAIL_PROVIDER", "test");
    vi.stubEnv("MUX_PROVIDER", "fake");
    vi.stubEnv("MUX_WEBHOOK_SECRET", webhookSecret);
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    vi.stubEnv("VIDEO_WEBHOOK_INGEST_SECRET", retrySecret);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("accepts a signed Mux event directly and makes the asset ready", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const upload = await t.action(api.video.createDirectUpload, {
      clientSubmissionId: "direct-convex-webhook",
      fileSizeBytes: 2_048,
      mimeType: "video/mp4",
      publicSlug: "acme-proof",
      spokenLanguage: "fr",
    });
    await t.run(async (ctx) => {
      const asset = await ctx.db.query("videoAssets").unique();
      if (!asset) throw new Error("Video asset missing.");
      await ctx.db.patch(asset._id, { provider: "mux" });
    });
    const body = JSON.stringify({
      data: {
        aspect_ratio: "16:9",
        duration: 7.7,
        id: "mux-asset-direct",
        passthrough: upload.reservationId,
        playback_ids: [{ id: "mux-playback-direct", policy: "public" }],
      },
      id: "mux-event-direct",
      type: "video.asset.ready",
    });

    const response = await t.fetch("/mux/webhook", signedRequest(body));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ outcome: "ready" });
    await expect(
      t.run((ctx) => ctx.db.query("videoAssets").unique()),
    ).resolves.toMatchObject({
      playbackId: "mux-playback-direct",
      providerAssetId: "mux-asset-direct",
      status: "ready",
    });
  });

  it("rejects tampered and stale events before writing", async () => {
    const t = createConvexTest();
    const body = JSON.stringify({
      data: {},
      id: "mux-event-rejected",
      type: "video.asset.ready",
    });
    const tampered = signedRequest(`${body} `);
    tampered.body = body;
    const stale = signedRequest(body, Date.now() - 10 * 60 * 1_000);

    await expect(t.fetch("/mux/webhook", tampered)).resolves.toMatchObject({
      status: 401,
    });
    await expect(t.fetch("/mux/webhook", stale)).resolves.toMatchObject({
      status: 401,
    });
    await expect(
      t.run((ctx) => ctx.db.query("videoWebhookEvents").collect()),
    ).resolves.toEqual([]);
  });

  it("rejects a signed event with invalid identifiers as a bad request", async () => {
    const t = createConvexTest();
    const body = JSON.stringify({ data: {}, id: "", type: "" });

    await expect(
      t.fetch("/mux/webhook", signedRequest(body)),
    ).resolves.toMatchObject({ status: 400 });
    await expect(
      t.run((ctx) => ctx.db.query("videoWebhookEvents").collect()),
    ).resolves.toEqual([]);
  });

  it("derives failure retry links with the delivery worker secret", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      publicSlug: "acme-proof",
    });
    const upload = await t.action(api.video.createDirectUpload, {
      clientSubmissionId: "direct-webhook-failure",
      fileSizeBytes: 2_048,
      mimeType: "video/mp4",
      publicSlug: "acme-proof",
      spokenLanguage: "fr",
    });
    const consent = buildPublicationConsent({
      brandName: "Acme Studio",
      privacyContact: "alice@example.com",
      suppliedIdentity: { avatarSupplied: false, name: "Alice Martin" },
    });
    await t.action(api.video.submit, {
      ageConfirmed: true,
      clientSubmissionId: "direct-webhook-failure",
      consentAccepted: true,
      consentText: consent.text,
      consentVersion: consent.version,
      durationSeconds: 7.7,
      reservationId: upload.reservationId,
      submitterEmail: "alice@example.com",
      submitterName: "Alice Martin",
    });
    await t.run(async (ctx) => {
      const asset = await ctx.db.query("videoAssets").unique();
      if (!asset) throw new Error("Video asset missing.");
      await ctx.db.patch(asset._id, {
        provider: "mux",
        providerAssetId: "mux-asset-failed",
        status: "processing",
      });
      await ctx.db.patch(upload.reservationId, { status: "reserved" });
    });
    const eventId = "mux-event-failed";
    const body = JSON.stringify({
      data: { id: "mux-asset-failed" },
      id: eventId,
      type: "video.asset.errored",
    });

    const response = await t.fetch("/mux/webhook", signedRequest(body));

    expect(response.status).toBe(200);
    const retryLink = await t.run((ctx) =>
      ctx.db.query("videoRetryLinks").unique(),
    );
    expect(retryLink?.tokenHash).toBe(
      await hashSubmissionManagementToken(
        await deriveVideoRetryToken(retrySecret, `webhook:${eventId}`),
      ),
    );
  });
});
