import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@convex/_generated/api";
import { buildPublicationConsent } from "@convex/domain/submission";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";

describe("public collection Turnstile gate", () => {
  beforeEach(() => {
    vi.stubEnv("EMAIL_PROVIDER", "test");
    vi.stubEnv("MUX_PROVIDER", "fake");
    vi.stubEnv("SITE_URL", "https://proof.example");
    vi.stubEnv("TURNSTILE_ENFORCE_IN_TESTS", "true");
    vi.stubEnv("TURNSTILE_HOSTNAMES", "proof.example");
    vi.stubEnv("TURNSTILE_SECRET", "test-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function setup() {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Acme Studio",
      privacyContact: "privacy@acme.example",
      publicSlug: "acme-proof",
    });
    return t;
  }

  const consent = buildPublicationConsent({
    brandName: "Acme Studio",
    privacyContact: "privacy@acme.example",
    suppliedIdentity: { avatarSupplied: false, name: "Camille Test" },
  });

  function textInput(turnstileToken?: string) {
    return {
      ageConfirmed: true,
      clientSubmissionId: "turnstile-text-submission",
      consentAccepted: true,
      consentText: consent.text,
      consentVersion: consent.version,
      publicSlug: "acme-proof",
      submitterEmail: "camille@example.invalid",
      submitterName: "Camille Test",
      text: "This testimonial is long enough to pass content validation.",
      ...(turnstileToken ? { turnstileToken } : {}),
    };
  }

  function videoInput(turnstileToken?: string) {
    return {
      clientSubmissionId: "turnstile-video-submission",
      fileSizeBytes: 2_048,
      mimeType: "video/mp4",
      publicSlug: "acme-proof",
      spokenLanguage: "en" as const,
      ...(turnstileToken ? { turnstileToken } : {}),
    };
  }

  async function expectNoCollectionState(
    t: ReturnType<typeof createConvexTest>,
  ) {
    await expect(
      t.run(async (ctx) => ({
        credits: await ctx.db.query("collectionCredits").collect(),
        rateLimits: await ctx.db.query("publicReadRateLimitBuckets").collect(),
        reservations: await ctx.db.query("videoReservations").collect(),
        testimonials: await ctx.db.query("testimonials").collect(),
      })),
    ).resolves.toEqual({
      credits: [],
      rateLimits: [],
      reservations: [],
      testimonials: [],
    });
  }

  it("rejects missing tokens for both public actions before state changes", async () => {
    const t = await setup();
    await expect(
      t.action(api.submissions.submitText, textInput()),
    ).rejects.toMatchObject({
      data: { code: "COLLECTION_BOT_VERIFICATION_FAILED" },
    });
    await expect(
      t.action(api.video.createDirectUpload, videoInput()),
    ).rejects.toMatchObject({
      data: { code: "COLLECTION_BOT_VERIFICATION_FAILED" },
    });
    await expectNoCollectionState(t);
  });

  it("rejects invalid tokens for both public actions before state changes", async () => {
    const t = await setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ success: false }), { status: 200 }),
        ),
    );
    await expect(
      t.action(api.submissions.submitText, textInput("invalid-text-token")),
    ).rejects.toMatchObject({
      data: { code: "COLLECTION_BOT_VERIFICATION_FAILED" },
    });
    await expect(
      t.action(api.video.createDirectUpload, videoInput("invalid-video-token")),
    ).rejects.toMatchObject({
      data: { code: "COLLECTION_BOT_VERIFICATION_FAILED" },
    });
    await expectNoCollectionState(t);
  });
});
