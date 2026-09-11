import { describe, expect, it } from "vitest";

import { api } from "@convex/_generated/api";
import {
  addMemberWithRole,
  authenticatedUser,
  createConvexTest,
  testImageMetadata,
} from "./convex-test-helpers";

async function storeImage(
  t: ReturnType<typeof createConvexTest>,
  body = "image bytes",
  options: {
    contentType?: string;
    kind?: "ownerPhoto" | "brandLogo";
    size?: number;
  } = {},
) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob([body]));
    const size = options.size ?? new Blob([body]).size;
    await ctx.db.patch(storageId, {
      contentType: options.contentType ?? "image/webp",
      size,
    });
    return {
      storageId,
      metadata: testImageMetadata(options.kind ?? "ownerPhoto", size),
    };
  });
}

describe("profile image storage", () => {
  it("lets an authenticated user set, replace, and remove their own avatar", async () => {
    const t = createConvexTest();
    const alice = await authenticatedUser(t);
    const first = await storeImage(t, "first");
    const second = await storeImage(t, "second");

    await alice.client.mutation(api.profileImages.setMyAvatar, {
      ...first,
    });
    await alice.client.mutation(api.profileImages.setMyAvatar, {
      ...second,
    });

    const current = await alice.client.query(api.auth.getCurrentUser, {});
    expect(current?.image).toMatch(/^https:\/\//);
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("userProfiles")
          .withIndex("by_user_id", (index) => index.eq("userId", alice.actorId))
          .unique(),
      ),
    ).toMatchObject({ avatarStorageId: second.storageId });
    expect(
      await t.run((ctx) => ctx.db.system.get("_storage", first.storageId)),
    ).toBeNull();

    await alice.client.mutation(api.profileImages.removeMyAvatar, {});
    expect(
      (await alice.client.query(api.auth.getCurrentUser, {}))?.image,
    ).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.system.get("_storage", second.storageId)),
    ).toBeNull();
  });

  it("rejects non-image files", async () => {
    const t = createConvexTest();
    const alice = await authenticatedUser(t);
    const textFile = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(new Blob(["hello"]));
      await ctx.db.patch(storageId, { contentType: "text/plain" });
      return storageId;
    });

    await expect(
      alice.client.mutation(api.profileImages.setMyAvatar, {
        storageId: textFile,
        metadata: testImageMetadata("ownerPhoto", 5),
      }),
    ).rejects.toMatchObject({
      data: { code: "INVALID_STORED_IMAGE" },
    });
  });

  it("rejects images larger than 5 MB", async () => {
    const t = createConvexTest();
    const alice = await authenticatedUser(t);
    const oversized = await storeImage(t, "oversized", {
      size: 5 * 1024 * 1024 + 1,
    });

    await expect(
      alice.client.mutation(api.profileImages.setMyAvatar, {
        ...oversized,
      }),
    ).rejects.toMatchObject({
      data: { code: "INVALID_STORED_IMAGE" },
    });
  });

  it("does not let another user claim or delete an avatar already in use", async () => {
    const t = createConvexTest();
    const alice = await authenticatedUser(t);
    const bob = await authenticatedUser(t, {
      email: "bob@example.com",
      name: "Bob Member",
    });
    const image = await storeImage(t, "alice-avatar");

    await alice.client.mutation(api.profileImages.setMyAvatar, {
      ...image,
    });
    await expect(
      bob.client.mutation(api.profileImages.setMyAvatar, image),
    ).rejects.toMatchObject({
      data: { code: "STORED_IMAGE_UNAVAILABLE" },
    });

    expect(
      await t.run((ctx) => ctx.db.system.get("_storage", image.storageId)),
    ).not.toBeNull();
    expect(
      await t.run((ctx) =>
        ctx.db
          .query("userProfiles")
          .withIndex("by_user_id", (index) => index.eq("userId", alice.actorId))
          .unique(),
      ),
    ).toMatchObject({ avatarStorageId: image.storageId });
  });

  it("replaces and removes an Organization logo without leaving old files", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Logo Lifecycle Company",
    });
    const first = await storeImage(t, "first-logo", { kind: "brandLogo" });
    const second = await storeImage(t, "second-logo", {
      kind: "brandLogo",
    });

    await owner.client.mutation(api.organizations.setLogo, {
      organizationId: organization.id,
      ...first,
    });
    await owner.client.mutation(api.organizations.setLogo, {
      organizationId: organization.id,
      ...second,
    });

    expect(
      await t.run((ctx) => ctx.db.system.get("_storage", first.storageId)),
    ).toBeNull();
    await owner.client.mutation(api.organizations.removeLogo, {
      organizationId: organization.id,
    });
    expect(
      await t.run((ctx) => ctx.db.system.get("_storage", second.storageId)),
    ).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.get(organization.id)),
    ).not.toHaveProperty("logoStorageId");
    expect(
      await owner.client.query(api.organizations.getBySlug, {
        slug: organization.slug,
      }),
    ).toMatchObject({ logoUrl: null });
  });

  it.each([
    ["owner", true],
    ["admin", true],
    ["editor", false],
    ["viewer", false],
  ] as const)(
    "enforces %s access for Organization logos",
    async (role, allowed) => {
      const t = createConvexTest();
      const owner = await authenticatedUser(t);
      const organization = await owner.client.mutation(
        api.organizations.create,
        {
          name: "Image Access Company",
        },
      );
      const member = await authenticatedUser(t, {
        email: `${role}@example.com`,
        name: `${role} Member`,
      });
      await addMemberWithRole(t, organization.id, member.actorId, role);
      const image = await storeImage(t, role, { kind: "brandLogo" });

      const update = member.client.mutation(api.organizations.setLogo, {
        organizationId: organization.id,
        ...image,
      });

      if (allowed) {
        await expect(update).resolves.toBeNull();
        const visible = await member.client.query(api.organizations.getBySlug, {
          slug: organization.slug,
        });
        expect(visible?.logoUrl).toMatch(/^https:\/\//);
        expect(await t.run((ctx) => ctx.db.get(organization.id))).toMatchObject(
          {
            logoStorageId: image.storageId,
          },
        );
      } else {
        await expect(update).rejects.toMatchObject({
          data: { code: "ORGANIZATION_ACCESS_DENIED" },
        });
      }
    },
  );

  it.each([
    ["owner", true],
    ["admin", true],
    ["editor", false],
    ["viewer", false],
  ] as const)(
    "enforces %s access for Organization logo upload URLs and removal",
    async (role, allowed) => {
      const t = createConvexTest();
      const originalOwner = await authenticatedUser(t);
      const organization = await originalOwner.client.mutation(
        api.organizations.create,
        { name: "Logo Permission Company" },
      );
      const member = await authenticatedUser(t, {
        email: `${role}-logo@example.com`,
        name: `${role} Logo Member`,
      });
      await addMemberWithRole(t, organization.id, member.actorId, role);
      const image = await storeImage(t, `${role}-logo`, {
        kind: "brandLogo",
      });
      await originalOwner.client.mutation(api.organizations.setLogo, {
        organizationId: organization.id,
        ...image,
      });

      const uploadUrl = member.client.mutation(
        api.organizations.generateLogoUploadUrl,
        { organizationId: organization.id },
      );
      const removal = member.client.mutation(api.organizations.removeLogo, {
        organizationId: organization.id,
      });

      if (allowed) {
        await expect(uploadUrl).resolves.toMatch(/^https:\/\//);
        await expect(removal).resolves.toBeNull();
        expect(
          await t.run((ctx) => ctx.db.system.get("_storage", image.storageId)),
        ).toBeNull();
      } else {
        await expect(uploadUrl).rejects.toMatchObject({
          data: { code: "ORGANIZATION_ACCESS_DENIED" },
        });
        await expect(removal).rejects.toMatchObject({
          data: { code: "ORGANIZATION_ACCESS_DENIED" },
        });
        expect(
          await t.run((ctx) => ctx.db.system.get("_storage", image.storageId)),
        ).not.toBeNull();
      }
    },
  );
});
