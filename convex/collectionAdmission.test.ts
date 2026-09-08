import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPublicationConsent } from "./domain/submission";
import { api } from "./_generated/api";
import {
  authenticatedUser,
  createConvexTest,
} from "../tests/convex-test-helpers";

async function verifiedFlow() {
  vi.stubEnv("TURNSTILE_ENFORCE_IN_TESTS", "true");
  vi.stubEnv("TURNSTILE_SECRET", "fixture-turnstile-secret");
  vi.stubEnv("TURNSTILE_HOSTNAMES", "proof.example");
  vi.stubEnv("EMAIL_PROVIDER", "test");
  vi.stubEnv("SITE_URL", "https://proof.example");
  const verify = vi.fn().mockImplementation(() =>
    Promise.resolve(
      Response.json({
        success: true,
        hostname: "proof.example",
        action: "collect_proof",
      }),
    ),
  );
  vi.stubGlobal("fetch", verify);
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  await owner.client.mutation(api.organizations.create, {
    name: "Mira Studio",
    publicSlug: "mira-studio",
  });
  const identity = {
    publicSlug: "mira-studio",
    clientSubmissionId: "verified-flow-client",
  };
  const grant = await t.action(api.collectionAdmission.create, {
    ...identity,
    turnstileToken: "verified-challenge-fixture",
  });
  return { t, identity, grant, verify };
}

describe("Collection upload admission", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it("refuses unverified allocation before consuming Brand upload budgets", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      name: "Mira Studio",
      publicSlug: "mira-studio",
    });
    const identity = {
      publicSlug: "mira-studio",
      clientSubmissionId: "admission-test-client",
    };
    await expect(
      t.mutation(api.testimonialImages.generateUploadUrl, identity),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.submissions.generateAvatarUploadUrl, identity),
    ).rejects.toThrow();
    expect(
      await t.run((ctx) => ctx.db.query("testimonialImages").collect()),
    ).toEqual([]);
    expect(
      await t.run((ctx) => ctx.db.query("submissionAvatarUploads").collect()),
    ).toEqual([]);
  });
  it("binds verified admission to its flow and serializes the image budget", async () => {
    const { t, identity, grant } = await verifiedFlow();
    const otherOwner = await authenticatedUser(t, {
      email: "other-owner@example.com",
      name: "Other Owner",
    });
    await otherOwner.client.mutation(api.organizations.create, {
      name: "Another Studio",
      publicSlug: "another-studio",
    });
    for (const args of [
      {
        ...identity,
        publicSlug: "another-studio",
        admissionToken: grant.token,
      },
      { ...identity, admissionToken: "f".repeat(64) },
      {
        ...identity,
        clientSubmissionId: "different-flow-client",
        admissionToken: grant.token,
      },
    ])
      await expect(
        t.mutation(api.testimonialImages.generateUploadUrl, args),
      ).rejects.toThrow();
    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        t.mutation(api.testimonialImages.generateUploadUrl, {
          ...identity,
          admissionToken: grant.token,
        }),
      ),
    );
    expect(
      attempts.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(3);
    expect(
      await t.run((ctx) => ctx.db.query("testimonialImages").collect()),
    ).toHaveLength(3);
    const stored = await t.run((ctx) =>
      ctx.db.query("collectionAdmissions").unique(),
    );
    expect(JSON.stringify(stored)).not.toContain(grant.token);
  });

  it("lets one verified flow finish without verifying its single-use challenge twice", async () => {
    const { t, identity, grant, verify } = await verifiedFlow();
    const consent = buildPublicationConsent({
      brandName: "Mira Studio",
      privacyContact: "alice@example.com",
      suppliedIdentity: { avatarSupplied: false, name: "Mira" },
    });
    const input = {
      ...identity,
      admissionToken: grant.token,
      ageConfirmed: true,
      consentAccepted: true,
      consentText: consent.text,
      consentVersion: consent.version,
      submitterEmail: "mira@example.com",
      submitterName: "Mira",
      text: "We now spend more time with our customers and less time chasing paperwork.",
    };
    await expect(
      t.action(api.submissions.submitText, input),
    ).resolves.toHaveProperty("testimonialId");
    expect(verify).toHaveBeenCalledTimes(1);
    await expect(t.action(api.submissions.submitText, input)).rejects.toThrow(
      "COLLECTION_ADMISSION_UNAVAILABLE",
    );
    await expect(
      t.mutation(api.submissions.generateAvatarUploadUrl, {
        ...identity,
        admissionToken: grant.token,
      }),
    ).rejects.toThrow();
  });

  it("refuses expired admissions and rejected or replayed provider verification", async () => {
    vi.useFakeTimers();
    const { t, identity, grant, verify } = await verifiedFlow();
    vi.setSystemTime(grant.expiresAt + 1);
    await expect(
      t.mutation(api.submissions.generateAvatarUploadUrl, {
        ...identity,
        admissionToken: grant.token,
      }),
    ).rejects.toThrow();
    verify.mockImplementation(() =>
      Promise.resolve(Response.json({ success: false })),
    );
    await expect(
      t.action(api.collectionAdmission.create, {
        ...identity,
        turnstileToken: "verified-challenge-fixture",
      }),
    ).rejects.toThrow("COLLECTION_BOT_VERIFICATION_FAILED");
    expect(
      await t.run((ctx) => ctx.db.query("collectionAdmissions").collect()),
    ).toHaveLength(1);
  });
});
