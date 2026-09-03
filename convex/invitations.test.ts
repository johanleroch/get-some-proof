import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { hashInvitationToken, type InvitationRole } from "./domain/invitation";
import {
  addMemberWithRole,
  authenticatedUser,
  createConvexTest,
} from "../tests/convex-test-helpers";

async function seedInvitation(
  t: ReturnType<typeof createConvexTest>,
  {
    organizationId,
    invitedByUserId,
    email,
    rawToken,
    role = "viewer",
    status = "pending",
    expiresAt = Date.now() + 60_000,
  }: {
    organizationId: Id<"organizations">;
    invitedByUserId: string;
    email: string;
    rawToken: string;
    role?: InvitationRole;
    status?: "pending" | "accepted" | "revoked";
    expiresAt?: number;
  },
) {
  const tokenHash = await hashInvitationToken(rawToken);
  return t.run(async (ctx) => {
    const now = Date.now();
    return ctx.db.insert("invitations", {
      organizationId,
      email: email.trim().toLowerCase(),
      role,
      tokenHash,
      expiresAt,
      status,
      deliveryStatus: "sent",
      deliveryIdempotencyKey: `seed-${rawToken}`,
      deliveryProvider: "test",
      providerMessageId: `test-${rawToken}`,
      invitedByUserId,
      revokedAt: status === "revoked" ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });
  });
}

describe("Member Invitations", () => {
  beforeEach(() => {
    process.env.EMAIL_PROVIDER = "test";
    process.env.SITE_URL = "http://localhost:3000";
  });

  afterEach(() => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.SITE_URL;
  });

  it("lets Owner and Admin invite non-owner roles without exposing tokens", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Invitation Company",
    });
    const admin = await authenticatedUser(t, {
      email: "admin@example.com",
      name: "Admin",
    });
    await addMemberWithRole(t, organization.id, admin.actorId, "admin");

    const created = await admin.client.action(api.invitations.create, {
      organizationId: organization.id,
      email: "  NEW.MEMBER@example.com ",
      role: "editor",
    });
    expect(created).toEqual({ invitationId: expect.any(String) });

    const magicLinks = await t.query(components.betterAuth.adapter.findMany, {
      model: "verification",
      paginationOpts: { cursor: null, numItems: 10 },
      where: [
        {
          field: "value",
          operator: "contains",
          value: "new.member@example.com",
        },
      ],
    });
    expect(magicLinks.page).toEqual([
      expect.objectContaining({
        value: expect.stringContaining('"email":"new.member@example.com"'),
      }),
    ]);

    const pending = await admin.client.query(api.invitations.listPending, {
      organizationId: organization.id,
    });
    expect(pending).toEqual([
      expect.objectContaining({
        id: created.invitationId,
        email: "new.member@example.com",
        role: "editor",
        status: "pending",
        deliveryStatus: "sent",
      }),
    ]);
    expect(pending[0]).not.toHaveProperty("token");
    expect(pending[0]).not.toHaveProperty("tokenHash");

    await expect(
      admin.client.action(api.invitations.create, {
        organizationId: organization.id,
        email: "new.member@example.com",
        role: "viewer",
      }),
    ).rejects.toMatchObject({
      data: { code: "INVITATION_ALREADY_PENDING" },
    });
  });

  it("rejects Viewer management and the Owner role at the public boundary", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Role Guard Company",
    });
    const viewer = await authenticatedUser(t, {
      email: "viewer@example.com",
      name: "Viewer",
    });
    await addMemberWithRole(t, organization.id, viewer.actorId, "viewer");

    await expect(
      viewer.client.action(api.invitations.create, {
        organizationId: organization.id,
        email: "candidate@example.com",
        role: "viewer",
      }),
    ).rejects.toMatchObject({
      data: { code: "ORGANIZATION_ACCESS_DENIED" },
    });
    await expect(
      owner.client.action(api.invitations.create, {
        organizationId: organization.id,
        email: "owner-candidate@example.com",
        role: "owner",
      } as never),
    ).rejects.toThrow();
  });

  it("binds magic-link delivery to the active Invitation email and token", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Magic Link Company",
    });
    const rawToken = "magic-link-invitation-token";
    await seedInvitation(t, {
      organizationId: organization.id,
      invitedByUserId: owner.actorId,
      email: "invitee@example.com",
      rawToken,
    });
    const args = {
      tokenHash: await hashInvitationToken(rawToken),
      email: "invitee@example.com",
      deliveryIdempotencyKey: `seed-${rawToken}`,
      now: Date.now(),
    };

    await expect(
      t.query(internal.invitationRecords.getMagicLinkDelivery, args),
    ).resolves.toEqual(
      expect.objectContaining({
        organizationName: "Magic Link Company",
        role: "viewer",
      }),
    );
    await expect(
      t.query(internal.invitationRecords.getMagicLinkDelivery, {
        ...args,
        email: "forwarded@example.com",
      }),
    ).resolves.toBeNull();
  });

  it("accepts once for the verified matching email and assigns the intended role", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Acceptance Company",
    });
    const rawToken = "matching-invitation-token";
    await seedInvitation(t, {
      organizationId: organization.id,
      invitedByUserId: owner.actorId,
      email: "invitee@example.com",
      rawToken,
      role: "editor",
    });
    const invitee = await authenticatedUser(t, {
      email: "INVITEE@example.com",
      name: "Invitee",
    });

    await expect(
      invitee.client.mutation(api.invitations.accept, { token: rawToken }),
    ).resolves.toEqual({ organizationSlug: organization.slug });
    await expect(
      invitee.client.query(api.organizations.listMine, {}),
    ).resolves.toEqual([
      expect.objectContaining({ id: organization.id, slug: organization.slug }),
    ]);
    await expect(
      t.query(components.authz.indexed.checkPermissionFast, {
        tenantId: String(organization.id),
        userId: invitee.actorId,
        permission: "projects:create",
      }),
    ).resolves.toBe(true);
    await expect(
      invitee.client.mutation(api.invitations.accept, { token: rawToken }),
    ).rejects.toMatchObject({ data: { code: "INVITATION_UNAVAILABLE" } });
  });

  it("serializes concurrent acceptance so exactly one request succeeds", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Concurrent Acceptance Company",
    });
    const rawToken = "concurrent-acceptance-token";
    await seedInvitation(t, {
      organizationId: organization.id,
      invitedByUserId: owner.actorId,
      email: "concurrent@example.com",
      rawToken,
      role: "editor",
    });
    const invitee = await authenticatedUser(t, {
      email: "concurrent@example.com",
      name: "Concurrent Invitee",
    });

    const outcomes = await Promise.allSettled([
      invitee.client.mutation(api.invitations.accept, { token: rawToken }),
      invitee.client.mutation(api.invitations.accept, { token: rawToken }),
    ]);

    expect(
      outcomes.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
    const memberships = await t.run((ctx) =>
      ctx.db
        .query("memberships")
        .withIndex("by_organization_user", (index) =>
          index
            .eq("organizationId", organization.id)
            .eq("userId", invitee.actorId),
        )
        .collect(),
    );
    expect(memberships).toHaveLength(1);
    expect(memberships[0].status).toBe("active");
  });

  it("reactivates an inactive Membership during acceptance", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Reactivation Company",
    });
    const returning = await authenticatedUser(t, {
      email: "returning@example.com",
      name: "Returning Member",
    });
    await addMemberWithRole(
      t,
      organization.id,
      returning.actorId,
      "viewer",
      "inactive",
    );
    const rawToken = "reactivation-token";
    await seedInvitation(t, {
      organizationId: organization.id,
      invitedByUserId: owner.actorId,
      email: "returning@example.com",
      rawToken,
      role: "editor",
    });

    await returning.client.mutation(api.invitations.accept, {
      token: rawToken,
    });

    await expect(
      returning.client.query(api.organizations.listMine, {}),
    ).resolves.toEqual([expect.objectContaining({ id: organization.id })]);
    const memberships = await t.run((ctx) =>
      ctx.db
        .query("memberships")
        .withIndex("by_organization_user", (index) =>
          index
            .eq("organizationId", organization.id)
            .eq("userId", returning.actorId),
        )
        .collect(),
    );
    expect(memberships).toHaveLength(1);
    expect(memberships[0].status).toBe("active");
  });

  it("rejects mismatched, unverified, expired, and revoked acceptance", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Invalid Links Company",
    });
    const cases = [
      { rawToken: "expired-token", expiresAt: Date.now() - 1 },
      { rawToken: "revoked-token", status: "revoked" as const },
    ];
    for (const candidate of cases) {
      await seedInvitation(t, {
        organizationId: organization.id,
        invitedByUserId: owner.actorId,
        email: "target@example.com",
        ...candidate,
      });
    }
    const wrongUser = await authenticatedUser(t, {
      email: "wrong@example.com",
      name: "Wrong User",
    });
    const mismatchToken = "mismatch-token";
    await seedInvitation(t, {
      organizationId: organization.id,
      invitedByUserId: owner.actorId,
      email: "target@example.com",
      rawToken: mismatchToken,
    });

    await expect(
      wrongUser.client.mutation(api.invitations.accept, {
        token: mismatchToken,
      }),
    ).rejects.toMatchObject({
      data: { code: "INVITATION_EMAIL_MISMATCH" },
    });
    for (const { rawToken } of cases) {
      await expect(
        wrongUser.client.mutation(api.invitations.accept, { token: rawToken }),
      ).rejects.toMatchObject({ data: { code: "INVITATION_UNAVAILABLE" } });
    }

    const unverified = await authenticatedUser(t, {
      email: "target@example.com",
      emailVerified: false,
      name: "Unverified User",
    });
    await expect(
      unverified.client.mutation(api.invitations.accept, {
        token: mismatchToken,
      }),
    ).rejects.toMatchObject({ data: { code: "EMAIL_NOT_VERIFIED" } });
  });

  it("rotates old links on resend or role change", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Rotation Company",
    });
    const oldToken = "old-known-token";
    const invitationId = await seedInvitation(t, {
      organizationId: organization.id,
      invitedByUserId: owner.actorId,
      email: "rotate@example.com",
      rawToken: oldToken,
    });

    await owner.client.action(api.invitations.changeRole, {
      organizationId: organization.id,
      invitationId,
      role: "admin",
    });
    const recipient = await authenticatedUser(t, {
      email: "rotate@example.com",
      name: "Rotated Recipient",
    });
    await expect(
      recipient.client.mutation(api.invitations.accept, { token: oldToken }),
    ).rejects.toMatchObject({ data: { code: "INVITATION_UNAVAILABLE" } });
    await expect(
      owner.client.query(api.invitations.listPending, {
        organizationId: organization.id,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: invitationId, role: "admin" }),
    ]);
  });

  it("resends with a fresh expiry and invalidates the previous link", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Resend Company",
    });
    const oldToken = "resend-old-token";
    const invitationId = await seedInvitation(t, {
      organizationId: organization.id,
      invitedByUserId: owner.actorId,
      email: "resend@example.com",
      rawToken: oldToken,
      expiresAt: Date.now() - 1,
    });
    const before = await t.run((ctx) => ctx.db.get(invitationId));

    await expect(
      owner.client.action(api.invitations.resend, {
        organizationId: organization.id,
        invitationId,
      }),
    ).resolves.toBeNull();

    const recipient = await authenticatedUser(t, {
      email: "resend@example.com",
      name: "Resent Recipient",
    });
    await expect(
      recipient.client.mutation(api.invitations.accept, { token: oldToken }),
    ).rejects.toMatchObject({ data: { code: "INVITATION_UNAVAILABLE" } });
    const after = await t.run((ctx) => ctx.db.get(invitationId));
    expect(after?.expiresAt).toBeGreaterThan(before?.expiresAt ?? 0);
    expect(after?.updatedAt).toBeGreaterThanOrEqual(before?.updatedAt ?? 0);
    expect(after?.deliveryStatus).toBe("sent");
  });

  it("keeps a failed delivery observable without exposing provider internals", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Delivery State Company",
    });
    delete process.env.EMAIL_PROVIDER;

    await expect(
      owner.client.action(api.invitations.create, {
        organizationId: organization.id,
        email: "delivery-failure@example.com",
        role: "viewer",
      }),
    ).rejects.toThrow("EMAIL_PROVIDER");
    await expect(
      owner.client.query(api.invitations.listPending, {
        organizationId: organization.id,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        email: "delivery-failure@example.com",
        deliveryStatus: "failed",
      }),
    ]);
  });

  it("rejects cross-Tenant Invitation selectors", async () => {
    const t = createConvexTest();
    const alice = await authenticatedUser(t);
    const aliceOrganization = await alice.client.mutation(
      api.organizations.create,
      { name: "Alice Invitations" },
    );
    const invitationId = await seedInvitation(t, {
      organizationId: aliceOrganization.id,
      invitedByUserId: alice.actorId,
      email: "private@example.com",
      rawToken: "private-token",
    });
    const bob = await authenticatedUser(t, {
      email: "bob-invitations@example.com",
      name: "Bob Owner",
    });
    const bobOrganization = await bob.client.mutation(
      api.organizations.create,
      {
        name: "Bob Invitations",
      },
    );

    await expect(
      bob.client.mutation(api.invitations.revoke, {
        organizationId: bobOrganization.id,
        invitationId,
      }),
    ).rejects.toMatchObject({ data: { code: "INVITATION_UNAVAILABLE" } });
    await expect(
      bob.client.action(api.invitations.create, {
        organizationId: aliceOrganization.id,
        email: "cross-tenant@example.com",
        role: "viewer",
      }),
    ).rejects.toMatchObject({ data: { code: "ORGANIZATION_UNAVAILABLE" } });
  });
});
