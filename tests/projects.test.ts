import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@convex/_generated/api";
import {
  addMemberWithRole,
  addStripeSubscription,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

describe("Project authorization", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_projects");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_projects");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["owner", true, true],
    ["admin", true, true],
    ["editor", true, false],
    ["viewer", false, false],
  ] as const)(
    "enforces the complete %s Project role matrix",
    async (role, canWrite, canDelete) => {
      const t = createConvexTest();
      const owner = await authenticatedUser(t);
      const organization = await owner.client.mutation(
        api.organizations.create,
        { name: "Project Matrix Company" },
      );
      await addStripeSubscription(t, organization.id, "active");
      const baseline = await owner.client.mutation(api.projects.create, {
        organizationId: organization.id,
        name: "Baseline Project",
        description: "Visible to every active Member.",
      });
      const member = await authenticatedUser(t, {
        email: `${role}-projects@example.com`,
        name: `${role} Project Member`,
      });
      await addMemberWithRole(t, organization.id, member.actorId, role);

      await expect(
        member.client.query(api.projects.list, {
          organizationId: organization.id,
        }),
      ).resolves.toEqual([expect.objectContaining({ id: baseline.id })]);
      await expect(
        member.client.query(api.projects.get, {
          organizationId: organization.id,
          projectId: baseline.id,
        }),
      ).resolves.toMatchObject({ id: baseline.id, name: "Baseline Project" });

      const createProject = member.client.mutation(api.projects.create, {
        organizationId: organization.id,
        name: `${role} Project`,
        description: "Role matrix candidate.",
      });

      if (!canWrite) {
        await expect(createProject).rejects.toMatchObject({
          data: { code: "ORGANIZATION_ACCESS_DENIED" },
        });
        return;
      }

      const created = await createProject;
      await expect(
        member.client.mutation(api.projects.update, {
          organizationId: organization.id,
          projectId: created.id,
          name: `${role} Updated Project`,
          description: "Updated through the public mutation.",
        }),
      ).resolves.toMatchObject({
        id: created.id,
        name: `${role} Updated Project`,
      });
      await expect(
        member.client.mutation(api.projects.archive, {
          organizationId: organization.id,
          projectId: created.id,
        }),
      ).resolves.toMatchObject({ id: created.id, status: "archived" });

      const removeProject = member.client.mutation(api.projects.remove, {
        organizationId: organization.id,
        projectId: created.id,
      });
      if (canDelete) {
        await expect(removeProject).resolves.toEqual({ deleted: true });
      } else {
        await expect(removeProject).rejects.toMatchObject({
          data: { code: "ORGANIZATION_ACCESS_DENIED" },
        });
      }
    },
  );

  it("does not reveal a Project selected from another Tenant", async () => {
    const t = createConvexTest();
    const alice = await authenticatedUser(t);
    const aliceOrganization = await alice.client.mutation(
      api.organizations.create,
      { name: "Alice Projects" },
    );
    await addStripeSubscription(t, aliceOrganization.id, "active");
    const privateProject = await alice.client.mutation(api.projects.create, {
      organizationId: aliceOrganization.id,
      name: "Private Roadmap",
      description: "Alice only.",
    });
    const bob = await authenticatedUser(t, {
      email: "bob-projects@example.com",
      name: "Bob Owner",
    });
    const bobOrganization = await bob.client.mutation(
      api.organizations.create,
      {
        name: "Bob Projects",
      },
    );
    await addStripeSubscription(t, bobOrganization.id, "active");

    await expect(
      bob.client.query(api.projects.get, {
        organizationId: bobOrganization.id,
        projectId: privateProject.id,
      }),
    ).resolves.toBeNull();
    await expect(
      bob.client.mutation(api.projects.update, {
        organizationId: bobOrganization.id,
        projectId: privateProject.id,
        name: "Stolen Project",
        description: "Should never be written.",
      }),
    ).rejects.toMatchObject({
      data: { code: "PROJECT_UNAVAILABLE" },
    });
  });
});
