import { describe, expect, it } from "vitest";

import { api, components } from "@convex/_generated/api";
import {
  addMemberWithRole,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

describe("Brand onboarding", () => {
  it("creates one configured Brand, active Membership, and Owner assignment", async () => {
    const t = createConvexTest();
    const alice = await authenticatedUser(t);

    const created = await alice.client.mutation(api.organizations.create, {
      collectionFormDescription: "Tell us what changed for your business.",
      collectionFormTitle: "Share your experience",
      name: "Acme Holdings",
      primaryColor: "#6d5dfc",
      privacyContact: "privacy@acme.example",
      publicSlug: "acme-proof",
    });

    expect(created.name).toBe("Acme Holdings");
    expect(created.slug).toMatch(/^acme-holdings-[a-z0-9]{4}$/);
    expect(created.publicSlug).toBe("acme-proof");

    const organizations = await alice.client.query(
      api.organizations.listMine,
      {},
    );
    expect(organizations).toEqual([
      expect.objectContaining({
        id: created.id,
        name: "Acme Holdings",
        publicSlug: "acme-proof",
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
      publicSlug: "acme-proof",
      publicSlugCanChange: true,
      slug: created.slug,
    });
  });

  it("rejects a second Brand for the same Owner", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);

    await owner.client.mutation(api.organizations.create, {
      name: "First Brand",
      publicSlug: "first-brand",
    });

    await expect(
      owner.client.mutation(api.organizations.create, {
        name: "Second Brand",
        publicSlug: "second-brand",
      }),
    ).rejects.toMatchObject({
      data: { code: "BRAND_ALREADY_EXISTS" },
    });
  });

  it("requires a unique Public Slug before creating the Brand", async () => {
    const t = createConvexTest();
    const alice = await authenticatedUser(t);
    const bob = await authenticatedUser(t, {
      email: "bob@example.com",
      name: "Bob Owner",
    });

    await alice.client.mutation(api.organizations.create, {
      name: "Alice Studio",
      publicSlug: "shared-proof",
    });

    await expect(
      bob.client.mutation(api.organizations.create, {
        name: "Bob Studio",
        publicSlug: "shared-proof",
      }),
    ).rejects.toMatchObject({
      data: { code: "PUBLIC_SLUG_UNAVAILABLE" },
    });
  });

  it("lets the Owner change the Public Slug once and releases the former slug", async () => {
    const t = createConvexTest();
    const alice = await authenticatedUser(t);
    const bob = await authenticatedUser(t, {
      email: "bob@example.com",
      name: "Bob Owner",
    });
    const created = await alice.client.mutation(api.organizations.create, {
      name: "Alice Studio",
      publicSlug: "alice-proof",
    });

    await expect(
      alice.client.mutation(api.organizations.changePublicSlug, {
        organizationId: created.id,
        publicSlug: "alice-stories",
      }),
    ).resolves.toMatchObject({
      publicSlug: "alice-stories",
      publicSlugCanChange: false,
    });
    await expect(
      alice.client.mutation(api.organizations.changePublicSlug, {
        organizationId: created.id,
        publicSlug: "alice-again",
      }),
    ).rejects.toMatchObject({
      data: { code: "PUBLIC_SLUG_CHANGE_ALREADY_USED" },
    });

    await expect(
      alice.client.query(api.organizations.getByPublicSlug, {
        publicSlug: "alice-proof",
      }),
    ).resolves.toBeNull();
    await expect(
      bob.client.mutation(api.organizations.create, {
        name: "Bob Studio",
        publicSlug: "alice-proof",
      }),
    ).resolves.toMatchObject({ publicSlug: "alice-proof" });
  });

  it("does not let a non-Owner spend the Public Slug change", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const created = await owner.client.mutation(api.organizations.create, {
      name: "Owner Brand",
      publicSlug: "owner-brand",
    });
    const admin = await authenticatedUser(t, {
      email: "admin@example.com",
      name: "Legacy Admin",
    });
    await addMemberWithRole(t, created.id, admin.actorId, "admin");

    await expect(
      admin.client.mutation(api.organizations.changePublicSlug, {
        organizationId: created.id,
        publicSlug: "admin-change",
      }),
    ).rejects.toMatchObject({
      data: { code: "ORGANIZATION_ACCESS_DENIED" },
    });
  });

  it("returns only public Collection Form settings by Public Slug", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    await owner.client.mutation(api.organizations.create, {
      collectionFormDescription: "A short description",
      collectionFormTitle: "Share your proof",
      name: "Public Brand",
      primaryColor: "#123abc",
      privacyContact: "privacy@example.com",
      publicSlug: "public-brand",
    });

    await expect(
      t.query(api.organizations.getByPublicSlug, {
        publicSlug: "public-brand",
      }),
    ).resolves.toEqual({
      collectionFormDescription: "A short description",
      collectionFormTitle: "Share your proof",
      logoUrl: null,
      name: "Public Brand",
      primaryColor: "#123abc",
      privacyContact: "privacy@example.com",
      publicSlug: "public-brand",
    });
  });

  it("does not treat another Organization slug as access evidence", async () => {
    const t = createConvexTest();
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
      const t = createConvexTest();
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
                readBilling: true,
                manageBilling: true,
              }
            : role === "admin"
              ? {
                  updateOrganization: true,
                  createProjects: true,
                  deleteProjects: true,
                  manageMembers: true,
                  manageOwnership: false,
                  readAudit: true,
                  readBilling: true,
                  manageBilling: false,
                }
              : role === "editor"
                ? {
                    updateOrganization: false,
                    createProjects: true,
                    deleteProjects: false,
                    manageMembers: false,
                    manageOwnership: false,
                    readAudit: false,
                    readBilling: false,
                    manageBilling: false,
                  }
                : {
                    updateOrganization: false,
                    createProjects: false,
                    deleteProjects: false,
                    manageMembers: false,
                    manageOwnership: false,
                    readAudit: false,
                    readBilling: false,
                    manageBilling: false,
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
    const t = createConvexTest();
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
      inactiveAdmin.client.query(api.organizations.listMine, {}),
    ).resolves.toEqual([]);
    await expect(
      inactiveAdmin.client.query(api.organizations.getBySlug, {
        slug: created.slug,
      }),
    ).resolves.toBeNull();

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
