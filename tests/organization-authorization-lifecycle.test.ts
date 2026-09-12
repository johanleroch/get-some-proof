import { expect, it } from "vitest";
import { api } from "@convex/_generated/api";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";

it.each(["deleting", "deleted", "inactive member", "closing account"])(
  "does not crash the subscribed shell: %s",
  async (state) => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Lifecycle",
    });
    const args = { organizationId: organization.id };
    expect(
      await owner.client.query(api.organizationAuthorization.getMine, args),
    ).toMatchObject({ role: "owner" });
    await t.run(async (ctx) => {
      if (state === "deleting")
        await ctx.db.patch(organization.id, { deletionStartedAt: Date.now() });
      if (state === "deleted") await ctx.db.delete(organization.id);
      if (state === "inactive member") {
        const membership = await ctx.db
          .query("memberships")
          .withIndex("by_organization_user", (q) =>
            q.eq("organizationId", organization.id).eq("userId", owner.actorId),
          )
          .unique();
        await ctx.db.patch(membership!._id, { status: "inactive" });
      }
      if (state === "closing account") {
        const project = await ctx.db.get(organization.id);
        await ctx.db.patch(project!.accountId!, {
          deletionStartedAt: Date.now(),
        });
      }
    });
    const access = await owner.client.query(
      api.organizationAuthorization.getMine,
      args,
    );
    expect(access.role).toBeNull();
    expect(Object.values(access.can)).toEqual(Array(8).fill(false));
    await expect(
      owner.client.mutation(api.organizations.rename, {
        ...args,
        name: "Must fail",
      }),
    ).rejects.toMatchObject({ data: { code: "ORGANIZATION_UNAVAILABLE" } });
  },
);
