import { describe, expect, it } from "vitest";

import { api, components } from "@convex/_generated/api";
import {
  addMemberWithRole,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

describe("Membership administration", () => {
  it("lets every active Member view names and roles", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Directory Company",
    });
    const viewer = await authenticatedUser(t, {
      email: "viewer-directory@example.com",
      name: "Vera Viewer",
    });
    await addMemberWithRole(
      t,
      organization.id,
      viewer.actorId,
      "viewer",
      "active",
      { displayName: "Vera Viewer", email: "viewer-directory@example.com" },
    );

    await expect(
      viewer.client.query(api.members.list, {
        organizationId: organization.id,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        displayName: "Alice Owner",
        email: "alice@example.com",
        role: "owner",
      }),
      expect.objectContaining({
        displayName: "Vera Viewer",
        email: "viewer-directory@example.com",
        role: "viewer",
      }),
    ]);
  });

  it("lets Admin manage non-owners but never an Owner", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Admin Authority Company",
    });
    const admin = await authenticatedUser(t, {
      email: "member-admin@example.com",
      name: "Adam Admin",
    });
    const editor = await authenticatedUser(t, {
      email: "member-editor@example.com",
      name: "Ed Editor",
    });
    await addMemberWithRole(t, organization.id, admin.actorId, "admin");
    await addMemberWithRole(t, organization.id, editor.actorId, "editor");
    const directory = await owner.client.query(api.members.list, {
      organizationId: organization.id,
    });
    const ownerMembership = directory.find(({ role }) => role === "owner")!;
    const editorMembership = directory.find(
      ({ userId }) => userId === editor.actorId,
    )!;

    await expect(
      admin.client.mutation(api.members.changeRole, {
        organizationId: organization.id,
        membershipId: editorMembership.id,
        role: "viewer",
      }),
    ).resolves.toMatchObject({ role: "viewer" });
    await expect(
      admin.client.mutation(api.members.remove, {
        organizationId: organization.id,
        membershipId: editorMembership.id,
      }),
    ).resolves.toBeNull();
    await expect(
      admin.client.mutation(api.members.changeRole, {
        organizationId: organization.id,
        membershipId: ownerMembership.id,
        role: "admin",
      }),
    ).rejects.toMatchObject({
      data: { code: "ORGANIZATION_ACCESS_DENIED" },
    });
  });

  it("allows Owner governance but protects the final Owner", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Owner Governance Company",
    });
    const candidate = await authenticatedUser(t, {
      email: "owner-candidate@example.com",
      name: "Owner Candidate",
    });
    await addMemberWithRole(t, organization.id, candidate.actorId, "admin");
    let directory = await owner.client.query(api.members.list, {
      organizationId: organization.id,
    });
    const originalOwner = directory.find(
      ({ userId }) => userId === owner.actorId,
    )!;
    const candidateMembership = directory.find(
      ({ userId }) => userId === candidate.actorId,
    )!;

    await owner.client.mutation(api.members.changeRole, {
      organizationId: organization.id,
      membershipId: candidateMembership.id,
      role: "owner",
    });
    await owner.client.mutation(api.members.changeRole, {
      organizationId: organization.id,
      membershipId: originalOwner.id,
      role: "admin",
    });
    directory = await candidate.client.query(api.members.list, {
      organizationId: organization.id,
    });
    expect(directory.filter(({ role }) => role === "owner")).toHaveLength(1);

    await expect(
      candidate.client.mutation(api.members.changeRole, {
        organizationId: organization.id,
        membershipId: candidateMembership.id,
        role: "admin",
      }),
    ).rejects.toMatchObject({ data: { code: "LAST_OWNER_REQUIRED" } });
    await expect(
      candidate.client.mutation(api.members.remove, {
        organizationId: organization.id,
        membershipId: candidateMembership.id,
      }),
    ).rejects.toMatchObject({ data: { code: "LAST_OWNER_REQUIRED" } });
    await expect(
      candidate.client.mutation(api.members.leave, {
        organizationId: organization.id,
      }),
    ).rejects.toMatchObject({ data: { code: "LAST_OWNER_REQUIRED" } });
  });

  it("deactivates Membership history and revokes every Tenant role atomically", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Removal Company",
    });
    const editor = await authenticatedUser(t, {
      email: "removed-editor@example.com",
      name: "Removed Editor",
    });
    await addMemberWithRole(
      t,
      organization.id,
      editor.actorId,
      "editor",
      "active",
      { displayName: "Removed Editor", email: "removed-editor@example.com" },
    );
    const membership = (
      await owner.client.query(api.members.list, {
        organizationId: organization.id,
      })
    ).find(({ userId }) => userId === editor.actorId)!;

    await owner.client.mutation(api.members.remove, {
      organizationId: organization.id,
      membershipId: membership.id,
    });

    await expect(
      owner.client.query(api.members.list, { organizationId: organization.id }),
    ).resolves.not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: editor.actorId }),
      ]),
    );
    await expect(
      owner.client.query(api.members.listHistory, {
        organizationId: organization.id,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: membership.id,
        userId: editor.actorId,
        status: "inactive",
        role: null,
      }),
    ]);
    await expect(
      t.query(components.authz.indexed.checkPermissionFast, {
        tenantId: String(organization.id),
        userId: editor.actorId,
        permission: "projects:create",
      }),
    ).resolves.toBe(false);
  });

  it("rejects Membership selectors from another Tenant", async () => {
    const t = createConvexTest();
    const alice = await authenticatedUser(t);
    const aliceOrganization = await alice.client.mutation(
      api.organizations.create,
      { name: "Alice Members" },
    );
    const aliceMembership = (
      await alice.client.query(api.members.list, {
        organizationId: aliceOrganization.id,
      })
    )[0];
    const bob = await authenticatedUser(t, {
      email: "bob-members@example.com",
      name: "Bob Owner",
    });
    const bobOrganization = await bob.client.mutation(
      api.organizations.create,
      {
        name: "Bob Members",
      },
    );

    await expect(
      bob.client.mutation(api.members.remove, {
        organizationId: bobOrganization.id,
        membershipId: aliceMembership.id,
      }),
    ).rejects.toMatchObject({ data: { code: "MEMBERSHIP_UNAVAILABLE" } });
  });

  it("serializes concurrent attempts so one Owner always remains", async () => {
    const t = createConvexTest();
    const firstOwner = await authenticatedUser(t);
    const organization = await firstOwner.client.mutation(
      api.organizations.create,
      { name: "Concurrent Owners Company" },
    );
    const secondOwner = await authenticatedUser(t, {
      email: "second-owner@example.com",
      name: "Second Owner",
    });
    await addMemberWithRole(t, organization.id, secondOwner.actorId, "owner");
    const directory = await firstOwner.client.query(api.members.list, {
      organizationId: organization.id,
    });
    const firstMembership = directory.find(
      ({ userId }) => userId === firstOwner.actorId,
    )!;
    const secondMembership = directory.find(
      ({ userId }) => userId === secondOwner.actorId,
    )!;

    const outcomes = await Promise.allSettled([
      firstOwner.client.mutation(api.members.changeRole, {
        organizationId: organization.id,
        membershipId: firstMembership.id,
        role: "admin",
      }),
      secondOwner.client.mutation(api.members.changeRole, {
        organizationId: organization.id,
        membershipId: secondMembership.id,
        role: "admin",
      }),
    ]);

    expect(
      outcomes.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
    const finalDirectory = await firstOwner.client
      .query(api.members.list, { organizationId: organization.id })
      .catch(() =>
        secondOwner.client.query(api.members.list, {
          organizationId: organization.id,
        }),
      );
    expect(finalDirectory.filter(({ role }) => role === "owner")).toHaveLength(
      1,
    );
  });
});
