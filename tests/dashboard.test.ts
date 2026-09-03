import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@convex/_generated/api";
import {
  addMemberWithRole,
  addStripeSubscription,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

describe("Organization overview", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dashboard");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_dashboard");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns real Tenant-scoped Project and Membership metrics", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Metrics Company",
    });
    await addStripeSubscription(t, organization.id, "active");
    const activeProject = await owner.client.mutation(api.projects.create, {
      organizationId: organization.id,
      name: "Active Project",
      description: "Still active.",
    });
    const archivedProject = await owner.client.mutation(api.projects.create, {
      organizationId: organization.id,
      name: "Archived Project",
      description: "Archived for the chart.",
    });
    await owner.client.mutation(api.projects.archive, {
      organizationId: organization.id,
      projectId: archivedProject.id,
    });
    const editor = await authenticatedUser(t, {
      email: "metrics-editor@example.com",
      name: "Metrics Editor",
    });
    await addMemberWithRole(t, organization.id, editor.actorId, "editor");
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("invitations", {
        organizationId: organization.id,
        email: "pending@example.com",
        role: "viewer",
        tokenHash: "safe-test-hash",
        expiresAt: now + 60_000,
        status: "pending",
        deliveryStatus: "pending",
        deliveryIdempotencyKey: "metrics-test",
        invitedByUserId: owner.actorId,
        createdAt: now,
        updatedAt: now,
      });
    });

    const overview = await owner.client.query(api.dashboard.overview, {
      organizationId: organization.id,
    });
    expect(overview).toMatchObject({
      totalProjects: 2,
      activeProjects: 1,
      archivedProjects: 1,
      activeMembers: 2,
      pendingInvitations: 1,
      projectStatus: [
        { label: "Active", projects: 1 },
        { label: "Archived", projects: 1 },
      ],
    });
    expect(overview.memberRoles).toEqual(
      expect.arrayContaining([
        { label: "Owner", members: 1 },
        { label: "Editor", members: 1 },
      ]),
    );
    expect(activeProject.status).toBe("active");
  });

  it("hides Invitation metrics from Viewer and rejects another Tenant", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Private Metrics Company",
    });
    const viewer = await authenticatedUser(t, {
      email: "metrics-viewer@example.com",
      name: "Metrics Viewer",
    });
    await addMemberWithRole(t, organization.id, viewer.actorId, "viewer");
    await expect(
      viewer.client.query(api.dashboard.overview, {
        organizationId: organization.id,
      }),
    ).resolves.toMatchObject({ pendingInvitations: null });

    const outsider = await authenticatedUser(t, {
      email: "metrics-outsider@example.com",
      name: "Metrics Outsider",
    });
    const otherOrganization = await outsider.client.mutation(
      api.organizations.create,
      { name: "Other Metrics Company" },
    );
    await expect(
      viewer.client.query(api.dashboard.overview, {
        organizationId: otherOrganization.id,
      }),
    ).rejects.toMatchObject({ data: { code: "ORGANIZATION_UNAVAILABLE" } });
  });
});
