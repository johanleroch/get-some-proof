import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { hashInvitationToken } from "@convex/domain/invitation";
import {
  addMemberWithRole,
  addStripeSubscription,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

async function listAudit(
  client: Awaited<ReturnType<typeof authenticatedUser>>["client"],
  organizationId: Id<"organizations">,
) {
  return client.query(api.auditEvents.list, {
    organizationId,
    paginationOpts: { cursor: null, numItems: 100 },
  });
}

describe("Organization Audit Log", () => {
  beforeEach(() => {
    process.env.EMAIL_PROVIDER = "test";
    process.env.SITE_URL = "http://localhost:3000";
    process.env.STRIPE_SECRET_KEY = "sk_test_audit";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_audit";
  });

  afterEach(() => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.SITE_URL;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("is Tenant-scoped and readable only by Owner and Admin", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Audited Company",
    });
    const admin = await authenticatedUser(t, {
      email: "audit-admin@example.com",
      name: "Audit Admin",
    });
    const editor = await authenticatedUser(t, {
      email: "audit-editor@example.com",
      name: "Audit Editor",
    });
    const viewer = await authenticatedUser(t, {
      email: "audit-viewer@example.com",
      name: "Audit Viewer",
    });
    await addMemberWithRole(t, organization.id, admin.actorId, "admin");
    await addMemberWithRole(t, organization.id, editor.actorId, "editor");
    await addMemberWithRole(t, organization.id, viewer.actorId, "viewer");

    await expect(
      listAudit(owner.client, organization.id),
    ).resolves.toMatchObject({
      page: [expect.objectContaining({ eventType: "organization.created" })],
    });
    await expect(
      listAudit(admin.client, organization.id),
    ).resolves.toMatchObject({
      page: [expect.objectContaining({ eventType: "organization.created" })],
    });
    await expect(
      listAudit(editor.client, organization.id),
    ).rejects.toMatchObject({ data: { code: "ORGANIZATION_ACCESS_DENIED" } });
    await expect(
      listAudit(viewer.client, organization.id),
    ).rejects.toMatchObject({ data: { code: "ORGANIZATION_ACCESS_DENIED" } });

    const outsider = await authenticatedUser(t, {
      email: "audit-outsider@example.com",
      name: "Outsider",
    });
    const otherOrganization = await outsider.client.mutation(
      api.organizations.create,
      { name: "Other Company" },
    );
    await expect(
      listAudit(owner.client, otherOrganization.id),
    ).rejects.toMatchObject({ data: { code: "ORGANIZATION_UNAVAILABLE" } });
  });

  it("records ordered Organization, Project, Invitation, and Membership events", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Event Company",
    });
    await addStripeSubscription(t, organization.id, "active");
    await owner.client.mutation(api.organizations.rename, {
      organizationId: organization.id,
      name: "Renamed Event Company",
    });
    const project = await owner.client.mutation(api.projects.create, {
      organizationId: organization.id,
      name: "Audited Project",
      description: "Created for the audit test.",
    });
    await owner.client.mutation(api.projects.update, {
      organizationId: organization.id,
      projectId: project.id,
      name: "Updated Audited Project",
      description: "Updated for the audit test.",
    });
    await owner.client.mutation(api.projects.archive, {
      organizationId: organization.id,
      projectId: project.id,
    });
    await owner.client.mutation(api.projects.remove, {
      organizationId: organization.id,
      projectId: project.id,
    });
    const invitation = await owner.client.action(api.invitations.create, {
      organizationId: organization.id,
      email: "audited-invitee@example.com",
      role: "viewer",
    });
    await owner.client.action(api.invitations.changeRole, {
      organizationId: organization.id,
      invitationId: invitation.invitationId,
      role: "editor",
    });
    await owner.client.action(api.invitations.resend, {
      organizationId: organization.id,
      invitationId: invitation.invitationId,
    });
    await owner.client.mutation(api.invitations.revoke, {
      organizationId: organization.id,
      invitationId: invitation.invitationId,
    });

    const audit = await listAudit(owner.client, organization.id);
    const types = audit.page.map(({ eventType }) => eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        "organization.created",
        "organization.renamed",
        "project.created",
        "project.updated",
        "project.archived",
        "project.deleted",
        "invitation.created",
        "invitation.role_changed",
        "invitation.resent",
        "invitation.revoked",
      ]),
    );
    expect(types.indexOf("project.deleted")).toBeLessThan(
      types.indexOf("project.created"),
    );
    expect(JSON.stringify(audit.page)).not.toContain("tokenHash");
    expect(JSON.stringify(audit.page)).not.toContain("deliveryIdempotencyKey");
  });

  it("retains stable actor and target snapshots after deletion and deactivation", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Stable Attribution Company",
    });
    await addStripeSubscription(t, organization.id, "active");
    const admin = await authenticatedUser(t, {
      email: "stable-admin@example.com",
      name: "Stable Admin",
    });
    await addMemberWithRole(
      t,
      organization.id,
      admin.actorId,
      "admin",
      "active",
      { displayName: "Stable Admin", email: "stable-admin@example.com" },
    );
    const project = await admin.client.mutation(api.projects.create, {
      organizationId: organization.id,
      name: "Ephemeral Project",
      description: "Will be deleted.",
    });
    await admin.client.mutation(api.projects.remove, {
      organizationId: organization.id,
      projectId: project.id,
    });
    const directory = await owner.client.query(api.members.list, {
      organizationId: organization.id,
    });
    const adminMembership = directory.find(
      ({ userId }) => userId === admin.actorId,
    )!;
    await owner.client.mutation(api.members.changeRole, {
      organizationId: organization.id,
      membershipId: adminMembership.id,
      role: "viewer",
    });
    await owner.client.mutation(api.members.remove, {
      organizationId: organization.id,
      membershipId: adminMembership.id,
    });

    const audit = await listAudit(owner.client, organization.id);
    expect(audit.page).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "project.deleted",
          actorUserId: admin.actorId,
          actorDisplayName: "Stable Admin",
          targetId: project.id,
          targetLabel: "Ephemeral Project",
        }),
        expect.objectContaining({
          eventType: "membership.removed",
          targetId: adminMembership.id,
          targetLabel: "Stable Admin",
          previousValue: "viewer",
        }),
      ]),
    );
  });

  it("records Invitation acceptance without retaining its secret", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Acceptance Audit Company",
    });
    const rawToken = "audit-acceptance-secret";
    const invitationId = await t.run(async (ctx) => {
      const now = Date.now();
      return ctx.db.insert("invitations", {
        organizationId: organization.id,
        email: "accepted-audit@example.com",
        role: "editor",
        tokenHash: await hashInvitationToken(rawToken),
        expiresAt: now + 60_000,
        status: "pending",
        deliveryStatus: "sent",
        deliveryIdempotencyKey: "audit-acceptance-delivery",
        invitedByUserId: owner.actorId,
        createdAt: now,
        updatedAt: now,
      });
    });
    const invitee = await authenticatedUser(t, {
      email: "accepted-audit@example.com",
      name: "Accepted Member",
    });
    await invitee.client.mutation(api.invitations.accept, { token: rawToken });

    const audit = await listAudit(owner.client, organization.id);
    expect(audit.page).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "invitation.accepted",
          targetId: invitationId,
          targetLabel: "accepted-audit@example.com",
        }),
        expect.objectContaining({
          eventType: "membership.activated",
          actorDisplayName: "Accepted Member",
          newValue: "editor",
        }),
      ]),
    );
    expect(JSON.stringify(audit.page)).not.toContain(rawToken);
  });
});
