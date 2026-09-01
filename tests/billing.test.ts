import { describe, expect, it } from "vitest";

import { api } from "@convex/_generated/api";
import {
  addMemberWithRole,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

describe("Organization Billing", () => {
  it("shows an Owner a safe Free overview when Stripe is unavailable", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Free Company",
    });

    await expect(
      owner.client.query(api.billing.getOverview, {
        organizationId: organization.id,
      }),
    ).resolves.toEqual({
      availability: "unavailable",
      billingContact: "alice@example.com",
      canManage: true,
      effectivePlan: "free",
      state: "unavailable",
      subscription: null,
    });
  });

  it.each([
    ["owner", true, true],
    ["admin", true, false],
    ["editor", false, false],
    ["viewer", false, false],
  ] as const)(
    "exposes explicit Billing capabilities for the %s role",
    async (role, readBilling, manageBilling) => {
      const t = createConvexTest();
      const owner = await authenticatedUser(t);
      const organization = await owner.client.mutation(
        api.organizations.create,
        { name: "Billing Roles Company" },
      );
      const member =
        role === "owner"
          ? owner
          : await authenticatedUser(t, {
              email: `${role}-billing@example.com`,
              name: `${role} Billing Member`,
            });
      if (role !== "owner") {
        await addMemberWithRole(t, organization.id, member.actorId, role);
      }

      const access = await member.client.query(
        api.organizationAuthorization.getMine,
        { organizationId: organization.id },
      );

      expect(access.can).toMatchObject({ readBilling, manageBilling });
    },
  );

  it("lets an Owner update the Billing Contact without copying it into Audit Events", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Accounts Payable Company",
    });

    await expect(
      owner.client.mutation(api.billing.updateContact, {
        organizationId: organization.id,
        email: "  BILLING@EXAMPLE.COM ",
      }),
    ).resolves.toEqual({ email: "billing@example.com" });

    await expect(
      owner.client.query(api.billing.getOverview, {
        organizationId: organization.id,
      }),
    ).resolves.toMatchObject({ billingContact: "billing@example.com" });

    const audit = await owner.client.query(api.auditEvents.list, {
      organizationId: organization.id,
      paginationOpts: { cursor: null, numItems: 20 },
    });
    expect(audit.page).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "billing.contact_updated",
          newValue: "configured",
          previousValue: "configured",
          targetLabel: "Accounts Payable Company",
          targetType: "billing",
        }),
      ]),
    );
    expect(JSON.stringify(audit.page)).not.toContain("billing@example.com");
  });

  it("rejects an invalid Billing Contact before persisting it", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Invalid Billing Contact Company",
    });

    await expect(
      owner.client.mutation(api.billing.updateContact, {
        organizationId: organization.id,
        email: "not-an-email",
      }),
    ).rejects.toMatchObject({
      data: { code: "INVALID_BILLING_CONTACT" },
    });

    await expect(
      owner.client.query(api.billing.getOverview, {
        organizationId: organization.id,
      }),
    ).resolves.toMatchObject({ billingContact: "alice@example.com" });
  });

  it("keeps Billing management Owner-only and hides other Tenants", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Private Billing Company",
    });
    const admin = await authenticatedUser(t, {
      email: "admin-billing@example.com",
      name: "Admin Billing Member",
    });
    const editor = await authenticatedUser(t, {
      email: "editor-billing@example.com",
      name: "Editor Billing Member",
    });
    const viewer = await authenticatedUser(t, {
      email: "viewer-billing@example.com",
      name: "Viewer Billing Member",
    });
    const outsider = await authenticatedUser(t, {
      email: "outsider-billing@example.com",
      name: "Outside Billing Member",
    });
    await addMemberWithRole(t, organization.id, admin.actorId, "admin");
    await addMemberWithRole(t, organization.id, editor.actorId, "editor");
    await addMemberWithRole(t, organization.id, viewer.actorId, "viewer");

    await expect(
      admin.client.query(api.billing.getOverview, {
        organizationId: organization.id,
      }),
    ).resolves.toMatchObject({ canManage: false, effectivePlan: "free" });

    await expect(
      admin.client.mutation(api.billing.updateContact, {
        organizationId: organization.id,
        email: "accounts@example.com",
      }),
    ).rejects.toMatchObject({
      data: { code: "ORGANIZATION_ACCESS_DENIED" },
    });
    await expect(
      editor.client.query(api.billing.getOverview, {
        organizationId: organization.id,
      }),
    ).rejects.toMatchObject({
      data: { code: "ORGANIZATION_ACCESS_DENIED" },
    });
    await expect(
      viewer.client.query(api.billing.getOverview, {
        organizationId: organization.id,
      }),
    ).rejects.toMatchObject({
      data: { code: "ORGANIZATION_ACCESS_DENIED" },
    });
    await expect(
      outsider.client.query(api.billing.getOverview, {
        organizationId: organization.id,
      }),
    ).rejects.toMatchObject({
      data: { code: "ORGANIZATION_UNAVAILABLE" },
    });

    await t.run(async (ctx) => ctx.db.delete(organization.id));
    await expect(
      owner.client.query(api.billing.getOverview, {
        organizationId: organization.id,
      }),
    ).rejects.toMatchObject({
      data: { code: "ORGANIZATION_UNAVAILABLE" },
    });
  });

  it("refuses inactive Memberships and unverified identities", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Verified Billing Company",
    });
    const inactiveAdmin = await authenticatedUser(t, {
      email: "inactive-billing@example.com",
      name: "Inactive Billing Admin",
    });
    const unverifiedAdmin = await authenticatedUser(t, {
      email: "unverified-billing@example.com",
      emailVerified: false,
      name: "Unverified Billing Admin",
    });
    await addMemberWithRole(
      t,
      organization.id,
      inactiveAdmin.actorId,
      "admin",
      "inactive",
    );
    await addMemberWithRole(
      t,
      organization.id,
      unverifiedAdmin.actorId,
      "admin",
    );

    await expect(
      inactiveAdmin.client.query(api.billing.getOverview, {
        organizationId: organization.id,
      }),
    ).rejects.toMatchObject({
      data: { code: "ORGANIZATION_UNAVAILABLE" },
    });
    await expect(
      unverifiedAdmin.client.query(api.billing.getOverview, {
        organizationId: organization.id,
      }),
    ).rejects.toMatchObject({ data: { code: "EMAIL_NOT_VERIFIED" } });
  });
});
