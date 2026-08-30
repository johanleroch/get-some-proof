import authzTest from "@djpanda/convex-authz/test";
import betterAuthTest from "@convex-dev/better-auth/test";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api, components } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { authzForOrganization } from "@convex/authorization";
import schema from "@convex/schema";

const modules = import.meta.glob("../convex/**/*.*s");

async function authenticatedUser(
  t: ReturnType<typeof convexTest>,
  {
    email = "alice@example.com",
    name = "Alice Owner",
  }: { email?: string; name?: string } = {},
) {
  const now = Date.now();
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "user",
      data: {
        name,
        email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "session",
      data: {
        userId: String(user._id),
        token: `test-session-token-${email}`,
        expiresAt: now + 60_000,
        createdAt: now,
        updatedAt: now,
      },
    },
  });

  return {
    actorId: String(user._id),
    client: t.withIdentity({
      subject: String(user._id),
      sessionId: String(session._id),
      tokenIdentifier: `test|${String(user._id)}`,
      email,
      emailVerified: true,
      name,
    }),
  };
}

async function addMemberWithRole(
  t: ReturnType<typeof convexTest>,
  organizationId: Id<"organizations">,
  actorId: string,
  role: "owner" | "admin" | "editor" | "viewer",
  status: "active" | "inactive" = "active",
) {
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("memberships", {
      organizationId,
      userId: actorId,
      status,
      createdAt: now,
      updatedAt: now,
      deactivatedAt: status === "inactive" ? now : undefined,
    });
    await authzForOrganization(organizationId).assignRole(
      ctx,
      actorId,
      role,
      undefined,
      undefined,
      actorId,
    );
  });
}

describe("Organization onboarding", () => {
  it("creates an Organization, active Membership, and Owner assignment", async () => {
    const t = convexTest(schema, modules);
    betterAuthTest.register(t);
    authzTest.register(t);
    const alice = await authenticatedUser(t);

    const created = await alice.client.mutation(api.organizations.create, {
      name: "Acme Holdings",
    });

    expect(created.name).toBe("Acme Holdings");
    expect(created.slug).toMatch(/^acme-holdings-[a-z0-9]{4}$/);

    const organizations = await alice.client.query(
      api.organizations.listMine,
      {},
    );
    expect(organizations).toEqual([
      expect.objectContaining({
        id: created.id,
        name: "Acme Holdings",
        slug: created.slug,
      }),
    ]);

    const canManageOwnership = await t.query(
      components.authz.indexed.checkPermissionFast,
      {
        tenantId: String(created.id),
        userId: created.actorId,
        permission: "ownership:manage",
      },
    );
    expect(canManageOwnership).toBe(true);

    const renamed = await alice.client.mutation(api.organizations.rename, {
      organizationId: created.id,
      name: "Acme Group",
    });
    expect(renamed).toEqual({
      id: created.id,
      name: "Acme Group",
      slug: created.slug,
    });
  });

  it("does not treat another Organization slug as access evidence", async () => {
    const t = convexTest(schema, modules);
    betterAuthTest.register(t);
    authzTest.register(t);
    const alice = await authenticatedUser(t);
    const bob = await authenticatedUser(t, {
      email: "bob@example.com",
      name: "Bob Viewer",
    });
    const created = await alice.client.mutation(api.organizations.create, {
      name: "Private Company",
    });
    await bob.client.mutation(api.organizations.create, {
      name: "Bob Company",
    });

    expect(
      await bob.client.query(api.organizations.getBySlug, {
        slug: created.slug,
      }),
    ).toBeNull();
    await expect(
      bob.client.query(api.organizationAuthorization.getMine, {
        organizationId: created.id,
      }),
    ).rejects.toMatchObject({
      data: {
        code: "ORGANIZATION_UNAVAILABLE",
      },
    });
  });

  it.each([
    ["owner", true],
    ["admin", true],
    ["editor", false],
    ["viewer", false],
  ] as const)(
    "enforces the %s role at the public Organization mutation",
    async (role, canRename) => {
      const t = convexTest(schema, modules);
      betterAuthTest.register(t);
      authzTest.register(t);
      const creator = await authenticatedUser(t);
      const created = await creator.client.mutation(api.organizations.create, {
        name: "Role Matrix Company",
      });

      const member = await authenticatedUser(t, {
        email: `${role}@example.com`,
        name: `${role} Member`,
      });
      await addMemberWithRole(t, created.id, member.actorId, role);

      const access = await member.client.query(
        api.organizationAuthorization.getMine,
        { organizationId: created.id },
      );
      expect(access).toEqual({
        role,
        can:
          role === "owner"
            ? {
                updateOrganization: true,
                createProjects: true,
                deleteProjects: true,
                manageMembers: true,
                manageOwnership: true,
                readAudit: true,
              }
            : role === "admin"
              ? {
                  updateOrganization: true,
                  createProjects: true,
                  deleteProjects: true,
                  manageMembers: true,
                  manageOwnership: false,
                  readAudit: true,
                }
              : role === "editor"
                ? {
                    updateOrganization: false,
                    createProjects: true,
                    deleteProjects: false,
                    manageMembers: false,
                    manageOwnership: false,
                    readAudit: false,
                  }
                : {
                    updateOrganization: false,
                    createProjects: false,
                    deleteProjects: false,
                    manageMembers: false,
                    manageOwnership: false,
                    readAudit: false,
                  },
      });

      const rename = member.client.mutation(api.organizations.rename, {
        organizationId: created.id,
        name: `${role} Updated Company`,
      });

      if (canRename) {
        await expect(rename).resolves.toMatchObject({
          id: created.id,
          name: `${role} Updated Company`,
        });
      } else {
        await expect(rename).rejects.toMatchObject({
          data: {
            code: "ORGANIZATION_ACCESS_DENIED",
          },
        });
      }
    },
  );

  it("rejects an inactive Membership even when an authorization role remains", async () => {
    const t = convexTest(schema, modules);
    betterAuthTest.register(t);
    authzTest.register(t);
    const creator = await authenticatedUser(t);
    const created = await creator.client.mutation(api.organizations.create, {
      name: "Inactive Membership Company",
    });
    const inactiveAdmin = await authenticatedUser(t, {
      email: "inactive@example.com",
      name: "Inactive Admin",
    });
    await addMemberWithRole(
      t,
      created.id,
      inactiveAdmin.actorId,
      "admin",
      "inactive",
    );

    await expect(
      inactiveAdmin.client.mutation(api.organizations.rename, {
        organizationId: created.id,
        name: "Should Not Change",
      }),
    ).rejects.toMatchObject({
      data: {
        code: "ORGANIZATION_UNAVAILABLE",
      },
    });
  });
});
