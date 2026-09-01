import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, internal } from "@convex/_generated/api";
import {
  addMemberWithRole,
  addStripeSubscription,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

describe("Organization Billing management boundaries", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_management");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_management");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("derives the Customer and dates server-side for an Owner", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Annual Premium Company",
    });
    const currentPeriodEnd = 1_799_999_999;
    await addStripeSubscription(t, organization.id, "active", {
      currentPeriodEnd,
      lookupKey: "premium_annual",
    });

    await expect(
      owner.client.query(internal.billing.getManagementContext, {
        organizationId: organization.id,
      }),
    ).resolves.toMatchObject({
      customerId: `cus_${organization.id}`,
      organizationId: organization.id,
      organizationSlug: organization.slug,
      state: "active",
    });
    await expect(
      owner.client.query(api.billing.getOverview, {
        organizationId: organization.id,
      }),
    ).resolves.toMatchObject({
      effectivePlan: "premium",
      subscription: { currentPeriodEnd },
    });
  });

  it("keeps every external management context Owner-only", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Owner Managed Billing Company",
    });
    const admin = await authenticatedUser(t, {
      email: "admin-management@example.com",
      name: "Admin Management Member",
    });
    const outsider = await authenticatedUser(t, {
      email: "outside-management@example.com",
      name: "Outside Management User",
    });
    await addMemberWithRole(t, organization.id, admin.actorId, "admin");
    await addStripeSubscription(t, organization.id, "active");

    await expect(
      admin.client.query(internal.billing.getSubscriptionPriceContext, {
        organizationId: organization.id,
      }),
    ).resolves.toEqual({ priceId: "price_premium_monthly" });

    await expect(
      admin.client.query(internal.billing.getManagementContext, {
        organizationId: organization.id,
      }),
    ).rejects.toMatchObject({
      data: { code: "ORGANIZATION_ACCESS_DENIED" },
    });
    await expect(
      admin.client.mutation(internal.billing.recordPortalOpened, {
        customerId: `cus_${organization.id}`,
        mode: "manage",
        organizationId: organization.id,
      }),
    ).rejects.toMatchObject({
      data: { code: "ORGANIZATION_ACCESS_DENIED" },
    });
    await expect(
      outsider.client.query(internal.billing.getManagementContext, {
        organizationId: organization.id,
      }),
    ).rejects.toMatchObject({
      data: { code: "ORGANIZATION_UNAVAILABLE" },
    });
  });

  it("records Portal and contact actions without Customer IDs, URLs, or email", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Sanitized Billing Audit Company",
    });
    const customerId = `cus_${organization.id}`;
    await addStripeSubscription(t, organization.id, "past_due");

    await owner.client.mutation(internal.billing.recordPortalOpened, {
      customerId,
      mode: "payment_method_update",
      organizationId: organization.id,
    });
    const reservation = await owner.client.mutation(
      internal.billing.reserveContactUpdate,
      {
        email: "billing-updated@example.com",
        organizationId: organization.id,
        requestedTransitionId: "contact_transition_audit",
      },
    );
    await owner.client.mutation(internal.billing.commitContactUpdate, {
      email: "billing-updated@example.com",
      expectedCustomerId: customerId,
      organizationId: organization.id,
      transitionId: reservation.transitionId,
    });

    const audit = await owner.client.query(api.auditEvents.list, {
      organizationId: organization.id,
      paginationOpts: { cursor: null, numItems: 20 },
    });
    expect(audit.page).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "billing.portal_opened",
          newValue: "Payment method update",
        }),
        expect.objectContaining({
          eventType: "billing.contact_updated",
          newValue: "configured",
        }),
      ]),
    );
    const serialized = JSON.stringify(audit.page);
    expect(serialized).not.toContain(customerId);
    expect(serialized).not.toContain("billing-updated@example.com");
    expect(serialized).not.toContain("https://");
  });

  it("serializes Billing Contact transitions before an external write", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Serialized Contact Company",
    });
    await addStripeSubscription(t, organization.id, "active");

    const first = await owner.client.mutation(
      internal.billing.reserveContactUpdate,
      {
        email: "first@example.com",
        organizationId: organization.id,
        requestedTransitionId: "contact_transition_first",
      },
    );
    await expect(
      owner.client.mutation(internal.billing.reserveContactUpdate, {
        email: "first@example.com",
        organizationId: organization.id,
        requestedTransitionId: "contact_transition_retry",
      }),
    ).resolves.toEqual(first);
    await expect(
      owner.client.mutation(internal.billing.reserveContactUpdate, {
        email: "second@example.com",
        organizationId: organization.id,
        requestedTransitionId: "contact_transition_second",
      }),
    ).rejects.toMatchObject({
      data: { code: "CONTACT_UPDATE_IN_PROGRESS" },
    });

    await owner.client.mutation(internal.billing.commitContactUpdate, {
      email: "first@example.com",
      expectedCustomerId: first.customerId,
      organizationId: organization.id,
      transitionId: first.transitionId,
    });
    await expect(
      owner.client.mutation(internal.billing.reserveContactUpdate, {
        email: "second@example.com",
        organizationId: organization.id,
        requestedTransitionId: "contact_transition_second",
      }),
    ).resolves.toMatchObject({
      customerId: first.customerId,
      transitionId: "contact_transition_second",
    });
  });
});
