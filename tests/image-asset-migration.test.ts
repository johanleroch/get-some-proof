import { expect, it } from "vitest";

import { api, internal } from "@convex/_generated/api";
import {
  authenticatedUser,
  createConvexTest,
  testPngBytes,
} from "./convex-test-helpers";

it("dry-runs then idempotently replaces a legacy logo with registered WebP", async () => {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const organization = await owner.client.mutation(api.organizations.create, {
    name: "Legacy Studio",
  });
  const source = new Blob([await testPngBytes(640, 320)], {
    type: "image/png",
  });
  const storageId = await t.run((ctx) => ctx.storage.store(source));
  const jobId = await t.run(async (ctx) => {
    await ctx.db.patch(organization.id, { logoStorageId: storageId });
    const now = Date.now();
    return ctx.db.insert("imageAssetMigrationJobs", {
      attempts: 0,
      createdAt: now,
      kind: "brandLogo",
      organizationId: organization.id,
      referenceId: String(organization.id),
      referenceTable: "organizations",
      status: "queued",
      storageId,
      updatedAt: now,
    });
  });

  const preview = (await t.action(internal.imageAssetMigration.process, {
    dryRun: true,
    limit: 1,
  })) as { results: Array<{ status: string }> };
  expect(preview.results).toMatchObject([{ status: "dry-run" }]);
  expect((await t.run((ctx) => ctx.db.get(jobId)))?.status).toBe("queued");
  expect(
    (await t.run((ctx) => ctx.db.get(organization.id)))?.logoStorageId,
  ).toBe(storageId);

  await t.action(internal.imageAssetMigration.process, { limit: 1 });
  const migratedOrganization = await t.run((ctx) =>
    ctx.db.get(organization.id),
  );
  expect(migratedOrganization?.logoStorageId).not.toBe(storageId);
  expect(await t.run((ctx) => ctx.storage.get(storageId))).toBeNull();
  expect(await t.run((ctx) => ctx.db.get(jobId))).toMatchObject({
    attempts: 1,
    status: "complete",
    replacementStorageId: migratedOrganization?.logoStorageId,
  });
  const asset = await t.run((ctx) =>
    ctx.db
      .query("imageAssets")
      .withIndex("by_storage_id", (q) =>
        q.eq("storageId", migratedOrganization?.logoStorageId),
      )
      .unique(),
  );
  expect(asset).toMatchObject({
    contentType: "image/webp",
    kind: "brandLogo",
    originalContentType: "image/png",
    source: "migration",
    status: "attached",
  });
  const repeat = (await t.action(internal.imageAssetMigration.process, {
    limit: 1,
  })) as { processed: number };
  expect(repeat.processed).toBe(0);
});

it("fails closed and retains an undecodable legacy reference", async () => {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const organization = await owner.client.mutation(api.organizations.create, {
    name: "Broken Legacy Studio",
  });
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["not-an-image"], { type: "image/png" })),
  );
  const jobId = await t.run(async (ctx) => {
    await ctx.db.patch(organization.id, { logoStorageId: storageId });
    const now = Date.now();
    return ctx.db.insert("imageAssetMigrationJobs", {
      attempts: 0,
      createdAt: now,
      kind: "brandLogo",
      organizationId: organization.id,
      referenceId: String(organization.id),
      referenceTable: "organizations",
      status: "queued",
      storageId,
      updatedAt: now,
    });
  });

  await t.action(internal.imageAssetMigration.process, { limit: 1 });
  expect(await t.run((ctx) => ctx.db.get(jobId))).toMatchObject({
    attempts: 1,
    diagnostic: "UNSUPPORTED_IMAGE",
    status: "failed",
  });
  expect(
    (await t.run((ctx) => ctx.db.get(organization.id)))?.logoStorageId,
  ).toBe(storageId);
  expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).not.toBeNull();
});
