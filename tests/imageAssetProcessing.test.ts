import { describe, expect, it } from "vitest";

import { api } from "@convex/_generated/api";
import {
  authenticatedUser,
  createConvexTest,
  testImageMetadata,
  testPngBytes,
} from "./convex-test-helpers";

async function storeTemporaryWebp(
  t: ReturnType<typeof createConvexTest>,
  bytes: BlobPart,
) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(
      new Blob([bytes], { type: "image/webp" }),
    );
    await ctx.db.patch(storageId, {
      contentType: "image/webp",
      size: new Blob([bytes]).size,
    });
    return storageId;
  });
}

describe("direct image processing", () => {
  it("rejects a forged WebP declaration when the stored bytes are not an image", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const temporaryStorageId = await storeTemporaryWebp(t, "not-an-image");

    await expect(
      owner.client.action(api.imageAssetProcessing.processDirectUpload, {
        browserMetadata: testImageMetadata("ownerPhoto", 12, {
          originalContentType: "image/jpeg",
          originalSize: 12,
        }),
        target: { kind: "ownerPhoto" },
        temporaryStorageId,
      }),
    ).rejects.toMatchObject({
      data: { code: "UNSUPPORTED_IMAGE" },
    });
    expect(
      await t.run((ctx) => ctx.db.system.get("_storage", temporaryStorageId)),
    ).toBeNull();
  });

  it("re-encodes valid bytes and trusts the server-derived dimensions", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const { default: sharp } = await import("sharp");
    const source = await testPngBytes(73, 41);
    const browserWebp = await sharp(source).webp({ quality: 90 }).toBuffer();
    const temporaryStorageId = await storeTemporaryWebp(t, browserWebp);

    const result = await owner.client.action(
      api.imageAssetProcessing.processDirectUpload,
      {
        browserMetadata: testImageMetadata("ownerPhoto", browserWebp.length, {
          height: 999,
          originalContentType: "image/png",
          originalSize: source.length,
          width: 999,
        }),
        target: { kind: "ownerPhoto" },
        temporaryStorageId,
      },
    );

    expect(result.metadata).toMatchObject({
      contentType: "image/webp",
      height: 41,
      kind: "ownerPhoto",
      originalContentType: "image/png",
      originalSize: source.length,
      width: 41,
    });
    expect(
      await t.run((ctx) => ctx.db.system.get("_storage", temporaryStorageId)),
    ).toBeNull();
    // convex-test does not preserve Blob.type for storage created inside actions.
    await t.run((ctx) =>
      ctx.db.patch(result.storageId, {
        contentType: "image/webp",
        size: result.metadata.size,
      }),
    );
    expect(
      await t.run((ctx) => ctx.db.system.get("_storage", result.storageId)),
    ).toMatchObject({
      contentType: "image/webp",
      size: result.metadata.size,
    });
    const other = await authenticatedUser(t, {
      email: "other@example.com",
      name: "Other Owner",
    });
    await expect(
      other.client.mutation(api.profileImages.setMyAvatar, {
        verificationId: result.verificationId,
      }),
    ).rejects.toMatchObject({
      data: { code: "IMAGE_UPLOAD_UNAVAILABLE" },
    });

    await owner.client.mutation(api.profileImages.setMyAvatar, {
      verificationId: result.verificationId,
    });
    await expect(
      owner.client.mutation(api.profileImages.setMyAvatar, {
        verificationId: result.verificationId,
      }),
    ).rejects.toMatchObject({
      data: { code: "IMAGE_UPLOAD_UNAVAILABLE" },
    });
  });

  it("binds a verification to its authorized target", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const brand = await owner.client.mutation(api.organizations.create, {
      name: "First Brand",
    });
    const { default: sharp } = await import("sharp");
    const browserWebp = await sharp(await testPngBytes())
      .webp()
      .toBuffer();
    const temporaryStorageId = await storeTemporaryWebp(t, browserWebp);
    const result = await owner.client.action(
      api.imageAssetProcessing.processDirectUpload,
      {
        browserMetadata: testImageMetadata("brandLogo", browserWebp.length),
        target: { kind: "brandLogo", organizationId: brand.id },
        temporaryStorageId,
      },
    );
    // convex-test does not preserve Blob.type for storage created inside actions.
    await t.run((ctx) =>
      ctx.db.patch(result.storageId, {
        contentType: "image/webp",
        size: result.metadata.size,
      }),
    );

    await expect(
      owner.client.mutation(api.profileImages.setMyAvatar, {
        verificationId: result.verificationId,
      }),
    ).rejects.toMatchObject({
      data: { code: "IMAGE_UPLOAD_UNAVAILABLE" },
    });
    await expect(
      owner.client.mutation(api.organizations.setLogo, {
        organizationId: brand.id,
        verificationId: result.verificationId,
      }),
    ).resolves.toBeNull();
  });
});
