import { describe, expect, it } from "vitest";

import { api, internal } from "@convex/_generated/api";
import {
  addMemberWithRole,
  authenticatedUser,
  createConvexTest,
} from "./convex-test-helpers";

describe("Organization Pro Checkout boundary", () => {
  it("allows Billing readers to request offers but stays safe without Stripe configuration", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Checkout Offers Company",
    });

    await expect(
      owner.client.action(api.billingActions.getOffers, {
        organizationId: organization.id,
      }),
    ).rejects.toMatchObject({ data: { code: "BILLING_UNAVAILABLE" } });
  });

  it("refuses financial actions for Admin, lower roles, inactive Memberships, and other Tenants", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Checkout Access Company",
    });
    const members = await Promise.all(
      ["admin", "editor", "viewer", "inactive-admin", "outsider"].map((label) =>
        authenticatedUser(t, {
          email: `${label}@checkout.example`,
          name: `${label} Checkout Member`,
        }),
      ),
    );
    await addMemberWithRole(t, organization.id, members[0].actorId, "admin");
    await addMemberWithRole(t, organization.id, members[1].actorId, "editor");
    await addMemberWithRole(t, organization.id, members[2].actorId, "viewer");
    await addMemberWithRole(
      t,
      organization.id,
      members[3].actorId,
      "admin",
      "inactive",
    );

    for (const member of members.slice(0, 3)) {
      await expect(
        member.client.action(api.billingActions.startCheckout, {
          organizationId: organization.id,
          lookupKey: "pro_monthly",
        }),
      ).rejects.toMatchObject({
        data: { code: "ORGANIZATION_ACCESS_DENIED" },
      });
    }
    for (const member of members.slice(3)) {
      await expect(
        member.client.action(api.billingActions.startCheckout, {
          organizationId: organization.id,
          lookupKey: "pro_monthly",
        }),
      ).rejects.toMatchObject({
        data: { code: "ORGANIZATION_UNAVAILABLE" },
      });
    }
  });

  it("rejects every browser-supplied key outside the public lookup-key allowlist", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Allowlisted Checkout Company",
    });

    await expect(
      owner.client.action(api.billingActions.startCheckout, {
        organizationId: organization.id,
        lookupKey: "price_from_browser" as "pro_monthly",
      }),
    ).rejects.toThrow();
  });

  it("refuses Checkout for an unverified Owner identity", async () => {
    const t = createConvexTest();
    const verifiedOwner = await authenticatedUser(t);
    const organization = await verifiedOwner.client.mutation(
      api.organizations.create,
      { name: "Verified Checkout Company" },
    );
    const unverifiedOwner = await authenticatedUser(t, {
      email: "unverified-owner@checkout.example",
      emailVerified: false,
      name: "Unverified Checkout Owner",
    });
    await addMemberWithRole(
      t,
      organization.id,
      unverifiedOwner.actorId,
      "owner",
    );

    await expect(
      unverifiedOwner.client.action(api.billingActions.startCheckout, {
        organizationId: organization.id,
        lookupKey: "pro_monthly",
      }),
    ).rejects.toMatchObject({ data: { code: "EMAIL_NOT_VERIFIED" } });
  });

  it("stores the canonical Customer mapping and a sanitized Checkout Audit Event", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Audited Checkout Company",
    });

    const reservation = await owner.client.mutation(
      internal.billing.reserveCheckout,
      {
        billingEmail: "accounts@audited.example",
        lookupKey: "pro_monthly",
        organizationId: organization.id,
        requestedReservationId: "reservation_audited",
      },
    );
    await owner.client.mutation(internal.billing.saveCheckoutCustomer, {
      customerId: "cus_server_created",
      leaseId: reservation.leaseId,
      organizationId: organization.id,
      reservationId: reservation.reservationId,
    });
    await owner.client.mutation(internal.billing.saveCheckoutOffer, {
      leaseId: reservation.leaseId,
      organizationId: organization.id,
      priceId: "price_pro_monthly",
      reservationId: reservation.reservationId,
    });
    await owner.client.mutation(internal.billing.recordCheckoutStarted, {
      customerId: "cus_server_created",
      leaseId: reservation.leaseId,
      lookupKey: "pro_monthly",
      organizationId: organization.id,
      reservationId: reservation.reservationId,
      sessionId: "cs_server_created",
    });

    const profile = await t.run((ctx) =>
      ctx.db
        .query("billingProfiles")
        .withIndex("by_organization", (index) =>
          index.eq("organizationId", organization.id),
        )
        .unique(),
    );
    expect(profile).toMatchObject({
      billingEmail: "alice@example.com",
      organizationId: organization.id,
      checkoutReservationId: "reservation_audited",
      stripeCheckoutSessionId: "cs_server_created",
      stripeCustomerId: "cus_server_created",
    });

    const audit = await owner.client.query(api.auditEvents.list, {
      organizationId: organization.id,
      paginationOpts: { cursor: null, numItems: 20 },
    });
    expect(audit.page).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "billing.checkout_started",
          newValue: "Pro monthly",
          previousValue: "Free",
          targetLabel: "Audited Checkout Company",
          targetType: "billing",
        }),
      ]),
    );
    expect(JSON.stringify(audit.page)).not.toContain("cus_server_created");
    expect(JSON.stringify(audit.page)).not.toContain("checkout.stripe");
    expect(JSON.stringify(audit.page)).not.toContain(
      "accounts@audited.example",
    );
  });

  it("serializes concurrent Checkout leases for one Organization", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Concurrent Checkout Company",
    });

    const outcomes = await Promise.allSettled(
      ["reservation_first", "reservation_second"].map(
        (requestedReservationId) =>
          owner.client.mutation(internal.billing.reserveCheckout, {
            billingEmail: "alice@example.com",
            lookupKey: "pro_monthly",
            organizationId: organization.id,
            requestedReservationId,
          }),
      ),
    );

    const fulfilled = outcomes.filter(
      (outcome) => outcome.status === "fulfilled",
    );
    const rejected = outcomes.filter(
      (outcome) => outcome.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      reason: { data: { code: "CHECKOUT_IN_PROGRESS" } },
    });
  });

  it("lets a retry recover a stale Checkout lease without losing the reservation", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t);
    const organization = await owner.client.mutation(api.organizations.create, {
      name: "Retryable Checkout Company",
    });
    const first = await owner.client.mutation(
      internal.billing.reserveCheckout,
      {
        billingEmail: "alice@example.com",
        lookupKey: "pro_monthly",
        organizationId: organization.id,
        requestedReservationId: "lease_first",
      },
    );
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("billingProfiles")
        .withIndex("by_organization", (index) =>
          index.eq("organizationId", organization.id),
        )
        .unique();
      if (!profile) throw new Error("Billing Profile missing");
      await ctx.db.patch(profile._id, {
        checkoutLeaseExpiresAt: Date.now() - 1,
      });
    });

    const retry = await owner.client.mutation(
      internal.billing.reserveCheckout,
      {
        billingEmail: "alice@example.com",
        lookupKey: "pro_monthly",
        organizationId: organization.id,
        requestedReservationId: "lease_retry",
      },
    );

    expect(retry).toMatchObject({
      leaseId: "lease_retry",
      lookupKey: "pro_monthly",
      reservationId: first.reservationId,
    });
  });
});
