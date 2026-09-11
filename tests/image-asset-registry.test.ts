import { expect, it } from "vitest";

import { api } from "@convex/_generated/api";
import {
  deleteImageAsset,
  registerImageAsset,
} from "@convex/imageAssetRegistry";
import { setTestimonialImages } from "@convex/testimonialImages";
import {
  authenticatedUser,
  createConvexTest,
  testImageMetadata,
} from "./convex-test-helpers";

it("rejects duplicate Testimonial Images by stored digest", async () => {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const organization = await owner.client.mutation(api.organizations.create, {
    name: "Digest Studio",
  });
  const bytes = new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]);
  const [firstStorageId, secondStorageId] = await t.run((ctx) =>
    Promise.all([
      ctx.storage.store(new Blob([bytes], { type: "image/webp" })),
      ctx.storage.store(new Blob([bytes], { type: "image/webp" })),
    ]),
  );
  const testimonialId = await t.run(async (ctx) => {
    const now = Date.now();
    const id = await ctx.db.insert("testimonials", {
      clientSubmissionId: "digest-testimonial",
      createdAt: now,
      moderationStatus: "pending",
      organizationId: organization.id,
      submissionType: "text",
      submitterName: "Maya",
      text: "A useful proof with screenshots.",
      updatedAt: now,
    });
    await registerImageAsset(
      ctx,
      firstStorageId,
      testImageMetadata("testimonialImage", bytes.byteLength),
      "testimonialImage",
      { organizationId: organization.id },
    );
    await registerImageAsset(
      ctx,
      secondStorageId,
      testImageMetadata("testimonialImage", bytes.byteLength),
      "testimonialImage",
      { organizationId: organization.id },
    );
    return id;
  });

  await expect(
    t.run(async (ctx) => {
      const testimonial = (await ctx.db.get(testimonialId))!;
      await setTestimonialImages(ctx, testimonial, [
        await ctx.db.insert("testimonialImages", {
          clientSubmissionId: "digest-testimonial",
          createdAt: Date.now(),
          expiresAt: Date.now() + 60_000,
          organizationId: organization.id,
          storageId: firstStorageId,
          testimonialId,
        }),
        await ctx.db.insert("testimonialImages", {
          clientSubmissionId: "digest-testimonial",
          createdAt: Date.now(),
          expiresAt: Date.now() + 60_000,
          organizationId: organization.id,
          storageId: secondStorageId,
          testimonialId,
        }),
      ]);
    }),
  ).rejects.toMatchObject({
    data: { code: "DUPLICATE_TESTIMONIAL_IMAGE" },
  });
});

it("tombstones registry metadata when the stored image is deleted", async () => {
  const t = createConvexTest();
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["webp"], { type: "image/webp" })),
  );
  const assetId = await t.run((ctx) =>
    registerImageAsset(
      ctx,
      storageId,
      testImageMetadata("ownerPhoto", 4),
      "ownerPhoto",
      { ownerUserId: "owner-fixture" },
    ),
  );

  await t.run((ctx) => deleteImageAsset(ctx, storageId));
  expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).toBeNull();
  const deleted = await t.run((ctx) => ctx.db.get(assetId));
  expect(deleted).toMatchObject({
    deletedAt: expect.any(Number),
    status: "deleted",
  });
  expect(deleted).not.toHaveProperty("storageId");
});
