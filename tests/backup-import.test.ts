import { expect, it, vi, afterEach } from "vitest";
import { api } from "@convex/_generated/api";
import {
  authenticatedUser,
  createConvexTest,
  testDirectImageVerification,
  testImageMetadata,
} from "./convex-test-helpers";
afterEach(() => vi.unstubAllEnvs());
it("restores pending testimonials, resumes media without duplicates, and refuses another owner", async () => {
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("EMAIL_PROVIDER", "test");
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const org = await owner.client.mutation(api.organizations.create, {
    name: "Backup",
  });
  const args = {
    organizationId: org.id,
    sourceProject: "original",
    items: [
      {
        sourceId: "review",
        type: "text" as const,
        authorName: "Maya Chen",
        text: "Wonderful!",
        rating: 5,
      },
    ],
  };
  const first = await owner.client.mutation(api.backupImports.restore, args);
  const id = first.items[0].testimonialId!;
  expect(first.items[0].skipped).toBe(false);
  const upload = (await owner.client.mutation(api.backupImports.imageUpload, {
    testimonialId: id,
    role: "avatar",
    sourcePath: "avatar",
  }))!;
  const storageId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["image"])),
  );
  const verificationId = await testDirectImageVerification(
    t,
    upload.target,
    storageId,
    testImageMetadata("submitterPhoto", 5),
  );
  await owner.client.mutation(api.backupImports.attachImage, {
    testimonialId: id,
    target: upload.target,
    verificationId,
  });
  const repeat = await owner.client.mutation(api.backupImports.restore, args);
  expect(repeat.items[0].testimonialId).toBe(id);
  expect(repeat.items[0].itemId).toBe(first.items[0].itemId);
  expect(
    await owner.client.mutation(api.backupImports.imageUpload, {
      testimonialId: id,
      role: "avatar",
      sourcePath: "avatar",
    }),
  ).toBeNull();
  const saved = await t.run((ctx) => ctx.db.get(id));
  expect(saved).toMatchObject({
    submitterName: "Maya Chen",
    moderationStatus: "pending",
    avatarStorageId: storageId,
  });
  const stranger = await authenticatedUser(t, {
    email: "stranger@example.com",
  });
  await expect(
    stranger.client.mutation(api.backupImports.restore, args),
  ).rejects.toThrow();
  await expect(
    stranger.client.mutation(api.backupImports.imageUpload, {
      testimonialId: id,
      role: "avatar",
      sourcePath: "avatar",
    }),
  ).rejects.toThrow();
});

it("retains a canonical video upload target when the same backup is retried", async () => {
  vi.stubEnv("SITE_URL", "http://localhost:3000");
  vi.stubEnv("EMAIL_PROVIDER", "test");
  vi.stubEnv("MUX_PROVIDER", "fake");
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const org = await owner.client.mutation(api.organizations.create, {
    name: "Video backup",
  });
  const args = {
    organizationId: org.id,
    sourceProject: "original",
    items: [
      {
        sourceId: "video",
        type: "video" as const,
        authorName: "Maya Chen",
        text: "",
      },
    ],
  };
  const first = await owner.client.mutation(api.backupImports.restore, args);
  expect(first.items[0]).toMatchObject({ skipped: false, videoNeeded: true });
  const retry = await owner.client.mutation(api.backupImports.restore, args);
  expect(retry.items[0]).toEqual(first.items[0]);
});
