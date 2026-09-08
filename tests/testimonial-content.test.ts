import { admittedUpload } from "./convex-test-helpers";
import { beforeEach as beforeWallTest } from "vitest";
beforeWallTest(() => {
  process.env.PUBLIC_READ_RATE_LIMIT_SECRET =
    "wall-service-test-credential-32-characters";
});
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "@convex/_generated/api";
import {
  buildPublicationConsent,
  hashSubmissionManagementToken,
} from "@convex/domain/submission";
import { richTextFromPlain } from "@convex/domain/testimonialRichText";
import type { Id } from "@convex/_generated/dataModel";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";

const text = "We saved five hours every week with this product.";
const token = "a".repeat(64);
async function setup() {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const brand = await owner.client.mutation(api.organizations.create, {
    name: "Acme",
    privacyContact: "privacy@example.invalid",
    publicSlug: "acme-proof",
  });
  const identity = {
    clientSubmissionId: "private-client-001",
    publicSlug: "acme-proof",
  };
  const consent = (imageCount = 0) =>
    buildPublicationConsent({
      brandName: "Acme",
      privacyContact: "privacy@example.invalid",
      imageCount,
      suppliedIdentity: { avatarSupplied: false, name: "Alice" },
    });
  const upload = async (
    overrides: { token?: string; clientSubmissionId?: string } = {},
  ) => {
    const uploadIdentity = { ...identity, ...overrides };
    const reservation = await t.mutation(
      api.testimonialImages.generateUploadUrl,
      await admittedUpload(t, uploadIdentity),
    );
    const storageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob(["test image"]));
      await ctx.db.patch(id, { contentType: "image/png", size: 10 });
      return id;
    });
    const image = await t.mutation(api.testimonialImages.registerUpload, {
      ...uploadIdentity,
      imageId: reservation.imageId,
      storageId,
    });
    return { ...image, storageId };
  };
  const submit = async (
    imageIds: Id<"testimonialImages">[] = [],
    clientSubmissionId = identity.clientSubmissionId,
  ) => {
    const permission = consent(imageIds.length);
    return t.mutation(internal.submissions.createTextRecords, {
      ...identity,
      clientSubmissionId,
      imageIds,
      text,
      richText: [
        {
          type: "p",
          children: [
            { text: "We saved " },
            { text: "five hours", highlight: true },
            { text: " every week with this product." },
          ],
        },
      ],
      ageConfirmed: true,
      consentAccepted: true,
      consentText: permission.text,
      consentVersion: permission.version,
      submitterName: "Alice",
      submitterEmail: "alice@example.invalid",
      managementTokenHash: await hashSubmissionManagementToken(token),
      deliveryAttemptId: "attempt-001",
    });
  };
  return { t, owner, brand, identity, consent, upload, submit };
}

describe("Rich Testimonials and images across their lifecycle", () => {
  beforeEach(() => {
    vi.stubEnv("EMAIL_PROVIDER", "test");
    vi.stubEnv("SITE_URL", "http://localhost:3000");
    vi.stubEnv("STRIPE_SECRET_KEY", "");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("collects images and highlights, publishes only the projection and preserves the original words during owner formatting", async () => {
    const { t, owner, brand, upload, submit } = await setup();
    const image = await upload();
    const submission = await submit([image.id]);
    const args = {
      organizationId: brand.id,
      testimonialId: submission.testimonialId,
    };
    expect(
      (
        await t.query(api.publicWall.list, {
          secret: "wall-service-test-credential-32-characters",
          publicSlug: "acme-proof",
          paginationOpts: { numItems: 10, cursor: null },
        })
      ).page,
    ).toHaveLength(0);
    await owner.client.mutation(api.testimonialModeration.setStatus, {
      ...args,
      status: "published",
    });
    let wall = await t.query(api.publicWall.list, {
      secret: "wall-service-test-credential-32-characters",
      publicSlug: "acme-proof",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(wall.page[0]).toMatchObject({
      text,
      images: [{ id: image.id, url: image.url }],
      richText: [
        {
          type: "p",
          children: [
            { text: "We saved " },
            { text: "five hours", highlight: true },
            { text: " every week with this product." },
          ],
        },
      ],
    });
    expect(wall.page[0]).not.toHaveProperty("submitterEmail");
    expect(wall.page[0]).not.toHaveProperty("organizationId");
    await expect(
      owner.client.mutation(api.testimonialModeration.setHighlights, {
        ...args,
        richText: richTextFromPlain("An invented replacement testimonial."),
      }),
    ).rejects.toThrow("preserve");
    await owner.client.mutation(api.testimonialModeration.setHighlights, {
      ...args,
      richText: richTextFromPlain(text),
    });
    wall = await t.query(api.publicWall.list, {
      secret: "wall-service-test-credential-32-characters",
      publicSlug: "acme-proof",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(wall.page[0]).toMatchObject({
      text,
      richText: richTextFromPlain(text),
    });
    const outsider = await authenticatedUser(t, {
      email: "outsider@example.invalid",
    });
    await expect(
      outsider.client.mutation(api.testimonialModeration.setHighlights, {
        ...args,
        richText: richTextFromPlain(text),
      }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.testimonialModeration.setHighlights, {
        ...args,
        richText: richTextFromPlain(text),
      }),
    ).rejects.toThrow();
    await t.mutation(internal.testimonialImages.expireUpload, {
      imageId: image.id,
    });
    expect(
      await t.run((ctx) => ctx.storage.getUrl(image.storageId)),
    ).not.toBeNull();
  });
  it("revises attachments with fresh consent, returns to Pending and deletes images on withdrawal", async () => {
    const { t, owner, brand, upload, submit, consent } = await setup();
    const first = await upload();
    const submission = await submit([first.id]);
    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: brand.id,
      testimonialId: submission.testimonialId,
      status: "published",
    });
    const second = await upload({
      token,
      clientSubmissionId: "revision-client-001",
    });
    const permission = consent(1);
    await t.mutation(api.submissionManagement.confirmRevision, {
      token,
      expectedContentVersion: 1,
      text,
      richText: richTextFromPlain(text),
      imageIds: [second.id],
      submitterName: "Alice",
      consentAccepted: true,
      consentText: permission.text,
      consentVersion: permission.version,
    });
    expect(
      await t.run((ctx) => ctx.storage.getUrl(first.storageId)),
    ).toBeNull();
    expect(
      (await t.query(api.submissionManagement.get, { token }))?.images,
    ).toEqual([{ id: second.id, url: second.url }]);
    expect(
      (
        await t.query(api.publicWall.list, {
          secret: "wall-service-test-credential-32-characters",
          publicSlug: "acme-proof",
          paginationOpts: { numItems: 10, cursor: null },
        })
      ).page,
    ).toHaveLength(0);
    expect(
      await t.query(api.publicWall.privacyRevision, {
        publicSlug: "acme-proof",
      }),
    ).toBe(1);
    await owner.client.mutation(api.testimonialModeration.setStatus, {
      organizationId: brand.id,
      testimonialId: submission.testimonialId,
      status: "published",
    });
    await t.mutation(api.submissionManagement.withdrawConsent, { token });
    expect(
      await t.query(api.publicWall.privacyRevision, {
        publicSlug: "acme-proof",
      }),
    ).toBe(2);
    expect(
      await t.run((ctx) => ctx.storage.getUrl(second.storageId)),
    ).toBeNull();
  });
  it("rejects cross-submission attachment theft, avatar reuse, unsupported files and more than three images", async () => {
    const { t, owner, identity, upload, submit } = await setup();
    const image = await upload();
    await expect(submit([image.id], "another-private-client")).rejects.toThrow(
      "Image unavailable",
    );
    await expect(
      owner.client.mutation(api.profileImages.setMyAvatar, {
        storageId: image.storageId,
      }),
    ).rejects.toThrow("already in use");
    const reservation = await t.mutation(
      api.testimonialImages.generateUploadUrl,
      await admittedUpload(t, identity),
    );
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["<svg/>"], { type: "image/svg+xml" })),
    );
    await expect(
      t.mutation(api.testimonialImages.registerUpload, {
        ...identity,
        imageId: reservation.imageId,
        storageId,
      }),
    ).rejects.toThrow("JPG, PNG or WebP");
    await expect(
      t.mutation(api.testimonialImages.registerUpload, {
        ...identity,
        clientSubmissionId: "another-private-client",
        imageId: reservation.imageId,
        storageId,
      }),
    ).rejects.toThrow("Image unavailable");
    await admittedUpload(t, identity, true);
    const others = await Promise.all([upload(), upload(), upload()]);
    await expect(
      submit([image.id, ...others.map((item) => item.id)]),
    ).rejects.toThrow("Image unavailable");
    await expect(submit([image.id, image.id])).rejects.toThrow(
      "Image unavailable",
    );
  });
  it("rejects expired management links and purges abandoned uploads without deleting attached files", async () => {
    const { t, upload, submit, identity } = await setup();
    const image = await upload();
    const submission = await submit([image.id]);
    await t.run((ctx) =>
      ctx.db.patch(submission.testimonialId, {
        managementTokenExpiresAt: Date.now() - 1,
      }),
    );
    await expect(
      t.mutation(
        api.testimonialImages.generateUploadUrl,
        await admittedUpload(t, {
          ...identity,
          token,
        }),
      ),
    ).rejects.toThrow();
    const orphan = await upload();
    await t.run((ctx) =>
      ctx.db.patch(orphan.id, { expiresAt: Date.now() - 1 }),
    );
    await t.mutation(internal.testimonialImages.expireUpload, {
      imageId: orphan.id,
    });
    expect(
      await t.run((ctx) => ctx.storage.getUrl(orphan.storageId)),
    ).toBeNull();
    expect(
      await t.run((ctx) => ctx.storage.getUrl(image.storageId)),
    ).not.toBeNull();
  });
  it("counts upload URLs independently of deleted attachment records", async () => {
    const { t, identity } = await setup();
    for (let index = 0; index < 30; index++) {
      const reservation = await t.mutation(
        api.testimonialImages.generateUploadUrl,
        await admittedUpload(t, {
          ...identity,
          clientSubmissionId: `image-budget-${index}`,
        }),
      );
      await t.run((ctx) => ctx.db.delete(reservation.imageId));
    }
    await expect(
      t.mutation(
        api.testimonialImages.generateUploadUrl,
        await admittedUpload(t, {
          ...identity,
          clientSubmissionId: "image-budget-final",
        }),
      ),
    ).rejects.toThrow("temporarily unavailable");
  });
  it("deletes attachments on Owner deletion and Spam expiry", async () => {
    const first = await setup();
    const image = await first.upload();
    const proof = await first.submit([image.id]);
    await first.owner.client.mutation(api.testimonialModeration.remove, {
      organizationId: first.brand.id,
      testimonialId: proof.testimonialId,
    });
    expect(
      await first.t.run((ctx) => ctx.storage.getUrl(image.storageId)),
    ).toBeNull();
    const second = await setup();
    const spamImage = await second.upload();
    const spamProof = await second.submit([spamImage.id]);
    await second.owner.client.mutation(api.testimonialModeration.markSpam, {
      organizationId: second.brand.id,
      testimonialId: spamProof.testimonialId,
    });
    const quarantineId = await second.t.run(async (ctx) => {
      const quarantine = (await ctx.db
        .query("spamQuarantines")
        .withIndex("by_testimonial", (q) =>
          q.eq("testimonialId", spamProof.testimonialId),
        )
        .unique())!;
      await ctx.db.patch(quarantine._id, { expiresAt: Date.now() - 1 });
      return quarantine._id;
    });
    await second.t.mutation(
      internal.testimonialModeration.expireSpamQuarantine,
      { quarantineId },
    );
    expect(
      await second.t.run((ctx) => ctx.storage.getUrl(spamImage.storageId)),
    ).toBeNull();
  });

  it("removes attached and abandoned images during Workspace deletion", async () => {
    const { t, owner, brand, upload, submit } = await setup();
    const attached = await upload();
    await submit([attached.id]);
    const abandoned = await upload();
    const deletion = await owner.client.action(api.workspaceDeletion.remove, {
      organizationId: brand.id,
      brandName: "Acme",
      irreversibleConfirmed: true,
    });
    for (let step = 0; step < 100; step++) {
      await owner.client.action(internal.workspaceDeletion.processDeletion, {
        deletionId: deletion.deletionId,
      });
      const status = await owner.client.query(api.workspaceDeletion.getStatus, {
        deletionId: deletion.deletionId,
      });
      if (status.status === "deleted") break;
    }
    expect(
      await owner.client.query(api.workspaceDeletion.getStatus, {
        deletionId: deletion.deletionId,
      }),
    ).toMatchObject({ status: "deleted" });
    expect(
      await t.run((ctx) => ctx.storage.getUrl(attached.storageId)),
    ).toBeNull();
    expect(
      await t.run((ctx) => ctx.storage.getUrl(abandoned.storageId)),
    ).toBeNull();
  });
});
