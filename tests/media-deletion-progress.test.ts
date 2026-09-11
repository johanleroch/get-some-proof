import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "@convex/_generated/api";
import {
  authenticatedUser,
  createConvexTest,
  addStripeSubscription,
} from "./convex-test-helpers";

vi.mock("@convex/stripeBillingProvider", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@convex/stripeBillingProvider")>()),
  cancelStripeSubscription: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_media_progress");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_media_progress");
  vi.stubEnv("MUX_PROVIDER", "fake");
});
afterEach(() => vi.unstubAllEnvs());

async function setup() {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Fernhill Studio",
  });
  const media = await t.run(async (ctx) => {
    const avatar = await ctx.storage.store(
      new Blob(["avatar"], { type: "image/png" }),
    );
    const poster = await ctx.storage.store(
      new Blob(["poster"], { type: "image/png" }),
    );
    await ctx.db.patch(project.id, { logoStorageId: avatar });
    const testimonialId = await ctx.db.insert("testimonials", {
      organizationId: project.id,
      clientSubmissionId: "deletion-progress",
      submissionType: "text",
      moderationStatus: "pending",
      submitterName: "Camille",
      text: "Thoughtful work.",
      avatarStorageId: avatar,
      posterStorageId: poster,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { avatar, poster, testimonialId };
  });
  return { t, owner, project, ...media };
}

describe("confirmed media deletion progress", () => {
  it("counts shared Account media once and removes it before either Project", async () => {
    const { t, owner, project, avatar, poster } = await setup();
    await addStripeSubscription(t, project.id, "active");
    const second = await owner.client.mutation(api.organizations.create, {
      name: "Northwind Coffee",
    });
    const profileImage = await t.run(async (ctx) => {
      await ctx.db.patch(second.id, { logoStorageId: avatar });
      for (let index = 0; index < 64; index++) {
        await ctx.db.insert("testimonials", {
          organizationId: second.id,
          clientSubmissionId: `shared-${index}`,
          submissionType: "text",
          moderationStatus: "pending",
          submitterName: "Fixture",
          text: "Shared avatar",
          avatarStorageId: avatar,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      const storageId = await ctx.storage.store(
        new Blob(["profile"], { type: "image/png" }),
      );
      await ctx.db.insert("userProfiles", {
        userId: owner.actorId,
        avatarStorageId: storageId,
        updatedAt: Date.now(),
      });
      return storageId;
    });
    const deletionId = await owner.client.mutation(api.accountDeletion.remove, {
      confirmation: "DELETE ACCOUNT",
      irreversibleConfirmed: true,
    });
    await expect(
      owner.client.mutation(api.profileImages.generateAvatarUploadUrl, {}),
    ).rejects.toThrow("Account unavailable");
    for (let step = 0; step < 100; step++) {
      await t.action(internal.accountDeletion.processDeletion, { deletionId });
      if (
        (await owner.client.query(api.accountDeletion.getMine, {}))
          ?.mediaProgress?.inventoryComplete
      )
        break;
    }
    expect(
      await owner.client.query(api.accountDeletion.getMine, {}),
    ).toMatchObject({ mediaProgress: { imagesTotal: 3, imagesDeleted: 0 } });
    for (let step = 0; step < 20; step++) {
      await t.action(internal.accountDeletion.processDeletion, { deletionId });
      if (
        (await owner.client.query(api.accountDeletion.getMine, {}))
          ?.mediaProgress?.imagesDeleted === 1
      )
        break;
    }
    expect(
      await owner.client.query(api.accountDeletion.getMine, {}),
    ).toMatchObject({ mediaProgress: { imagesTotal: 3, imagesDeleted: 1 } });
    expect(await t.run((ctx) => ctx.db.get(project.id))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(second.id))).not.toBeNull();
    for (let step = 0; step < 200; step++) {
      await t.action(internal.accountDeletion.processDeletion, { deletionId });
      if (
        (await owner.client.query(api.accountDeletion.getMine, {}))?.status ===
        "deleted"
      )
        break;
    }
    expect(
      await owner.client.query(api.accountDeletion.getMine, {}),
    ).toMatchObject({
      status: "deleted",
      mediaProgress: { imagesTotal: 3, imagesDeleted: 3 },
    });
    for (const id of [avatar, poster, profileImage])
      expect(await t.run((ctx) => ctx.db.system.get(id))).toBeNull();
  });

  it("deduplicates images and retains the project and testimonial until all media is deleted", async () => {
    const { t, owner, project, avatar, poster, testimonialId } = await setup();
    const { deletionId } = await owner.client.mutation(
      internal.workspaceDeletion.prepare,
      {
        organizationId: project.id,
        brandName: "Fernhill Studio",
        irreversibleConfirmed: true,
      },
    );
    while (
      !(await t.mutation(internal.workspaceDeletionInventory.advance, {
        deletionId,
      }))
    ) {}
    expect(
      (
        await owner.client.query(api.workspaceDeletion.getStatus, {
          deletionId,
        })
      ).mediaProgress,
    ).toMatchObject({
      imagesTotal: 2,
      imagesDeleted: 0,
      inventoryComplete: true,
    });
    const target = await t.query(internal.deletionMedia.next, { deletionId });
    expect(target).not.toBeNull();
    await t.mutation(internal.deletionMedia.complete, { targetId: target!.id });
    await t.mutation(internal.deletionMedia.complete, { targetId: target!.id });
    expect(
      (
        await owner.client.query(api.workspaceDeletion.getStatus, {
          deletionId,
        })
      ).mediaProgress?.imagesDeleted,
    ).toBe(1);
    expect(await t.run((ctx) => ctx.db.get(testimonialId))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(project.id))).not.toBeNull();
    // Even a direct final-phase call cannot bypass unfinished media cleanup.
    await t.run((ctx) => ctx.db.patch(deletionId, { phase: "organization" }));
    await expect(
      t.mutation(internal.workspaceDeletion.purgeBatch, { deletionId }),
    ).resolves.toBe(false);
    expect((await t.run((ctx) => ctx.db.get(deletionId)))?.phase).toBe(
      "deleteMedia",
    );
    for (let step = 0; step < 100; step++) {
      await t.action(internal.workspaceDeletion.processDeletion, {
        deletionId,
      });
      if (
        (
          await owner.client.query(api.workspaceDeletion.getStatus, {
            deletionId,
          })
        ).status === "deleted"
      )
        break;
    }
    expect(await t.run((ctx) => ctx.db.get(project.id))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get(avatar))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get(poster))).toBeNull();
    expect(
      (
        await owner.client.query(api.workspaceDeletion.getStatus, {
          deletionId,
        })
      ).mediaProgress,
    ).toMatchObject({ imagesTotal: 2, imagesDeleted: 2 });
  });

  it("cleans up text testimonial images before finalization and exposes progress only to the Owner", async () => {
    const { t, owner, project, avatar, poster, testimonialId } = await setup();
    await expect(
      owner.client.mutation(api.testimonialModeration.remove, {
        organizationId: project.id,
        testimonialId,
      }),
    ).rejects.toThrow("Refresh this page");
    const prepared = await owner.client.mutation(
      internal.videoMedia.prepareRemoval,
      { organizationId: project.id, testimonialId },
    );
    while (
      !(await t.mutation(internal.testimonialDeletionInventory.advance, {
        deletionId: prepared.deletionId,
      }))
    ) {}
    await expect(
      owner.client.mutation(internal.videoMedia.finalizeRemoval, {
        organizationId: project.id,
        testimonialId,
      }),
    ).rejects.toThrow("Media cleanup is not complete");
    expect(await t.run((ctx) => ctx.db.get(testimonialId))).not.toBeNull();
    const outsider = await authenticatedUser(t, {
      email: "outsider@example.test",
    });
    await expect(
      outsider.client.query(api.videoMedia.getRemovalStatus, {
        organizationId: project.id,
        testimonialId,
      }),
    ).rejects.toThrow();
    await owner.client.action(api.videoMedia.remove, {
      organizationId: project.id,
      testimonialId,
    });
    expect(await t.run((ctx) => ctx.db.system.get(poster))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get(avatar))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(testimonialId))).toBeNull();
    expect(
      await owner.client.query(api.videoMedia.getRemovalStatus, {
        organizationId: project.id,
        testimonialId,
      }),
    ).toMatchObject({
      status: "deleted",
      mediaProgress: { imagesDeleted: 1, imagesTotal: 1, imagesShared: 1 },
    });
  });
});
