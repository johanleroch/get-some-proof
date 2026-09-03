import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@convex/_generated/api";
import {
  addMemberWithRole,
  addStripeSubscription,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

describe("Project Pro Entitlement", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_entitlement");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_entitlement");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["active", "past_due"])(
    "grants Project writes for %s",
    async (status) => {
      const t = createConvexTest();
      const owner = await authenticatedUser(t);
      const organization = await owner.client.mutation(
        api.organizations.create,
        { name: `${status} Pro Company` },
      );
      await addStripeSubscription(t, organization.id, status);

      await expect(
        owner.client.mutation(api.projects.create, {
          description: "Created through a synchronized Subscription.",
          name: `${status} Project`,
          organizationId: organization.id,
        }),
      ).resolves.toMatchObject({ name: `${status} Project` });
    },
  );

  it("refuses an unsupported trialing Subscription", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Unsupported Trial Company",
    });
    await addStripeSubscription(t, organization.id, "trialing");
    await expect(
      owner.client.mutation(api.projects.create, {
        description: "Trials are outside the approved MVP.",
        name: "Trial Project",
        organizationId: organization.id,
      }),
    ).rejects.toMatchObject({ data: { code: "PREMIUM_REQUIRED" } });
  });

  it.each(["missing", "unpaid", "canceled", "incomplete_expired"])(
    "refuses Project writes for %s while preserving reads",
    async (status) => {
      const t = createConvexTest();
      const owner = await authenticatedUser(t);
      const organization = await owner.client.mutation(
        api.organizations.create,
        { name: `${status} Free Company` },
      );
      if (status !== "missing") {
        await addStripeSubscription(t, organization.id, status);
      }
      const projectId = await t.run((ctx) =>
        ctx.db.insert("projects", {
          createdAt: Date.now(),
          createdByUserId: owner.actorId,
          description: "Readable historical Project.",
          name: "Historical Project",
          organizationId: organization.id,
          status: "active",
          updatedAt: Date.now(),
          updatedByUserId: owner.actorId,
        }),
      );

      await expect(
        owner.client.query(api.projects.list, {
          organizationId: organization.id,
        }),
      ).resolves.toEqual([expect.objectContaining({ id: projectId })]);
      await expect(
        owner.client.query(api.projects.get, {
          organizationId: organization.id,
          projectId,
        }),
      ).resolves.toMatchObject({ id: projectId });

      const writes = [
        owner.client.mutation(api.projects.create, {
          description: "Must be refused.",
          name: "New Project",
          organizationId: organization.id,
        }),
        owner.client.mutation(api.projects.update, {
          description: "Must be refused.",
          name: "Changed Project",
          organizationId: organization.id,
          projectId,
        }),
        owner.client.mutation(api.projects.archive, {
          organizationId: organization.id,
          projectId,
        }),
        owner.client.mutation(api.projects.remove, {
          organizationId: organization.id,
          projectId,
        }),
      ];
      for (const write of writes) {
        await expect(write).rejects.toMatchObject({
          data: { code: "PREMIUM_REQUIRED" },
        });
      }
    },
  );

  it.each([
    ["owner", "PREMIUM_REQUIRED"],
    ["admin", "PREMIUM_REQUIRED"],
    ["editor", "PREMIUM_REQUIRED"],
    ["viewer", "ORGANIZATION_ACCESS_DENIED"],
  ] as const)("keeps the Free %s role boundary", async (role, code) => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Free Role Matrix Company",
    });
    const actor =
      role === "owner"
        ? owner
        : await authenticatedUser(t, {
            email: `${role}-free@example.com`,
            name: `${role} Free Member`,
          });
    if (role !== "owner") {
      await addMemberWithRole(t, organization.id, actor.actorId, role);
    }

    await expect(
      actor.client.mutation(api.projects.create, {
        description: "Free matrix attempt.",
        name: "Free Matrix Project",
        organizationId: organization.id,
      }),
    ).rejects.toMatchObject({ data: { code } });
  });

  it("does not grant writes when Billing configuration is unavailable", async () => {
    vi.unstubAllEnvs();
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Unavailable Billing Company",
    });
    await addStripeSubscription(t, organization.id, "active");

    await expect(
      owner.client.mutation(api.projects.create, {
        description: "Must stay blocked without Billing configuration.",
        name: "Unavailable Project",
        organizationId: organization.id,
      }),
    ).rejects.toMatchObject({ data: { code: "PREMIUM_REQUIRED" } });
  });

  it.each(["editor", "viewer"] as const)(
    "lets a Free %s read the minimal Project entitlement without exposing Billing",
    async (role) => {
      const t = createConvexTest();
      const owner = await authenticatedUser(t);
      const organization = await owner.client.mutation(
        api.organizations.create,
        { name: `Free ${role} Entitlement Company` },
      );
      const actor = await authenticatedUser(t, {
        email: `${role}-entitlement@example.com`,
        name: `${role} Entitlement Member`,
      });
      await addMemberWithRole(t, organization.id, actor.actorId, role);

      await expect(
        actor.client.query(api.billing.getProjectEntitlement, {
          organizationId: organization.id,
        }),
      ).resolves.toEqual({ effectivePlan: "free" });
      await expect(
        actor.client.query(api.billing.getOverview, {
          organizationId: organization.id,
        }),
      ).rejects.toMatchObject({
        data: { code: "ORGANIZATION_ACCESS_DENIED" },
      });

      await addStripeSubscription(t, organization.id, "active");
      await expect(
        actor.client.query(api.billing.getProjectEntitlement, {
          organizationId: organization.id,
        }),
      ).resolves.toEqual({ effectivePlan: "premium" });
    },
  );
});
