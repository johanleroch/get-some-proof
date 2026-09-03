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
    vi.restoreAllMocks();
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
        requestedLeaseId: "contact_lease_audit",
        requestedTransitionId: "contact_transition_audit",
      },
    );
    await owner.client.mutation(internal.billing.commitContactUpdate, {
      email: "billing-updated@example.com",
      expectedCustomerId: customerId,
      leaseId: reservation.leaseId,
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
        requestedLeaseId: "contact_lease_first",
        requestedTransitionId: "contact_transition_first",
      },
    );
    await expect(
      owner.client.mutation(internal.billing.reserveContactUpdate, {
        email: "first@example.com",
        organizationId: organization.id,
        requestedLeaseId: "contact_lease_retry",
        requestedTransitionId: "contact_transition_retry",
      }),
    ).rejects.toMatchObject({
      data: { code: "CONTACT_UPDATE_IN_PROGRESS" },
    });
    await expect(
      owner.client.mutation(internal.billing.reserveContactUpdate, {
        email: "second@example.com",
        organizationId: organization.id,
        requestedLeaseId: "contact_lease_second",
        requestedTransitionId: "contact_transition_second",
      }),
    ).rejects.toMatchObject({
      data: { code: "CONTACT_UPDATE_IN_PROGRESS" },
    });

    await owner.client.mutation(internal.billing.commitContactUpdate, {
      email: "first@example.com",
      expectedCustomerId: first.customerId,
      leaseId: first.leaseId,
      organizationId: organization.id,
      transitionId: first.transitionId,
    });
    await expect(
      owner.client.mutation(internal.billing.reserveContactUpdate, {
        email: "second@example.com",
        organizationId: organization.id,
        requestedLeaseId: "contact_lease_second",
        requestedTransitionId: "contact_transition_second",
      }),
    ).resolves.toMatchObject({
      customerId: first.customerId,
      leaseId: "contact_lease_second",
      transitionId: "contact_transition_second",
    });
  });

  it("allows a different contact after a failed provider transition is released", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Recoverable Contact Company",
    });
    await addStripeSubscription(t, organization.id, "active");

    const failed = await owner.client.mutation(
      internal.billing.reserveContactUpdate,
      {
        email: "failed@example.com",
        organizationId: organization.id,
        requestedLeaseId: "contact_lease_failed",
        requestedTransitionId: "contact_transition_failed",
      },
    );
    await owner.client.mutation(internal.billing.releaseContactUpdate, {
      expectedCustomerId: failed.customerId,
      leaseId: failed.leaseId,
      organizationId: organization.id,
      transitionId: failed.transitionId,
    });

    const sameTargetRetry = await owner.client.mutation(
      internal.billing.reserveContactUpdate,
      {
        email: "failed@example.com",
        organizationId: organization.id,
        requestedLeaseId: "contact_lease_same_target_retry",
        requestedTransitionId: "contact_transition_unused_retry",
      },
    );
    expect(sameTargetRetry).toEqual({
      customerId: failed.customerId,
      leaseId: "contact_lease_same_target_retry",
      transitionId: failed.transitionId,
    });
    await owner.client.mutation(internal.billing.releaseContactUpdate, {
      expectedCustomerId: sameTargetRetry.customerId,
      leaseId: sameTargetRetry.leaseId,
      organizationId: organization.id,
      transitionId: sameTargetRetry.transitionId,
    });

    await expect(
      owner.client.mutation(internal.billing.reserveContactUpdate, {
        email: "replacement@example.com",
        organizationId: organization.id,
        requestedLeaseId: "contact_lease_replacement",
        requestedTransitionId: "contact_transition_replacement",
      }),
    ).resolves.toEqual({
      customerId: failed.customerId,
      leaseId: "contact_lease_replacement",
      transitionId: "contact_transition_replacement",
    });
  });

  it("releases a failed transition after the initiating Owner loses access", async () => {
    const t = createConvexTest();
    const initiatingOwner = await authenticatedUser(t);
    const organization = await initiatingOwner.client.mutation(
      api.organizations.create,
      { name: "Billing Owner Handoff Company" },
    );
    const successor = await authenticatedUser(t, {
      email: "successor@example.com",
      name: "Successor Owner",
    });
    await addMemberWithRole(t, organization.id, successor.actorId, "owner");
    await addStripeSubscription(t, organization.id, "active");

    const failed = await initiatingOwner.client.mutation(
      internal.billing.reserveContactUpdate,
      {
        email: "failed-owner@example.com",
        organizationId: organization.id,
        requestedLeaseId: "contact_lease_owner_handoff",
        requestedTransitionId: "contact_transition_owner_handoff",
      },
    );
    const initiatingMembership = (
      await successor.client.query(api.members.list, {
        organizationId: organization.id,
      })
    ).find(({ userId }) => userId === initiatingOwner.actorId)!;
    await successor.client.mutation(api.members.remove, {
      membershipId: initiatingMembership.id,
      organizationId: organization.id,
    });

    await initiatingOwner.client.mutation(
      internal.billing.releaseContactUpdate,
      {
        expectedCustomerId: failed.customerId,
        leaseId: failed.leaseId,
        organizationId: organization.id,
        transitionId: failed.transitionId,
      },
    );
    await expect(
      successor.client.mutation(internal.billing.reserveContactUpdate, {
        email: "successor@example.com",
        organizationId: organization.id,
        requestedLeaseId: "contact_lease_successor",
        requestedTransitionId: "contact_transition_successor",
      }),
    ).resolves.toMatchObject({
      leaseId: "contact_lease_successor",
      transitionId: "contact_transition_successor",
    });
  });

  it("recovers an interrupted same-contact attempt without sharing its lease", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Recoverable Contact Lease Company",
    });
    await addStripeSubscription(t, organization.id, "active");

    let now = 1_800_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const interrupted = await owner.client.mutation(
      internal.billing.reserveContactUpdate,
      {
        email: "stable@example.com",
        organizationId: organization.id,
        requestedLeaseId: "contact_lease_interrupted",
        requestedTransitionId: "contact_transition_stable",
      },
    );

    now += 6 * 60 * 1000;
    const recovered = await owner.client.mutation(
      internal.billing.reserveContactUpdate,
      {
        email: "stable@example.com",
        organizationId: organization.id,
        requestedLeaseId: "contact_lease_recovered",
        requestedTransitionId: "contact_transition_unused",
      },
    );
    expect(recovered).toEqual({
      customerId: interrupted.customerId,
      leaseId: "contact_lease_recovered",
      transitionId: "contact_transition_stable",
    });

    await owner.client.mutation(internal.billing.releaseContactUpdate, {
      expectedCustomerId: interrupted.customerId,
      leaseId: interrupted.leaseId,
      organizationId: organization.id,
      transitionId: interrupted.transitionId,
    });
    await expect(
      owner.client.mutation(internal.billing.reserveContactUpdate, {
        email: "different@example.com",
        organizationId: organization.id,
        requestedLeaseId: "contact_lease_different",
        requestedTransitionId: "contact_transition_different",
      }),
    ).rejects.toMatchObject({
      data: { code: "CONTACT_UPDATE_IN_PROGRESS" },
    });

    await owner.client.mutation(internal.billing.commitContactUpdate, {
      email: "stable@example.com",
      expectedCustomerId: recovered.customerId,
      leaseId: recovered.leaseId,
      organizationId: organization.id,
      transitionId: recovered.transitionId,
    });
    await expect(
      owner.client.query(api.billing.getOverview, {
        organizationId: organization.id,
      }),
    ).resolves.toMatchObject({ billingContact: "stable@example.com" });
  });
});
