import { expect, it } from "vitest";
import { api, internal } from "@convex/_generated/api";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";

it("keeps the customer's billing context after all projects are removed and isolates other Owners", async () => {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Invoice studio",
  });
  const account = await owner.client.query(api.accounts.getMine, {});
  await t.run(async (ctx) => {
    const profile = await ctx.db
      .query("billingProfiles")
      .withIndex("by_account", (q) => q.eq("accountId", account!.id))
      .unique();
    await ctx.db.patch(profile!._id, { stripeCustomerId: "cus_invoiceOwner" });
    await ctx.db.delete(project.id);
  });
  expect(
    await owner.client.query(internal.accounts.getBillingContext, {}),
  ).toEqual({ customerId: "cus_invoiceOwner" });
  expect(await owner.client.query(api.accounts.getMine, {})).toMatchObject({
    effectivePlan: "free",
    canManageSubscription: true,
  });
  const other = await authenticatedUser(t, {
    email: "other-invoices@example.invalid",
  });
  await other.client.mutation(api.organizations.create, {
    name: "Another studio",
  });
  expect(
    await other.client.query(internal.accounts.getBillingContext, {}),
  ).toEqual({ customerId: null });
  expect(
    await other.client.action(api.billingInvoices.listAccountInvoices, {}),
  ).toEqual({ invoices: [], nextCursor: null });
  await expect(
    t.action(api.billingInvoices.listAccountInvoices, {}),
  ).rejects.toThrow();
  await t.run((ctx) =>
    ctx.db.patch(account!.id, { deletionStartedAt: Date.now() }),
  );
  await expect(
    owner.client.query(internal.accounts.getBillingContext, {}),
  ).rejects.toMatchObject({ data: { code: "ACCOUNT_UNAVAILABLE" } });
});

it("preserves the old Checkout mapping while switching from monthly to annual", async () => {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const project = await owner.client.mutation(api.organizations.create, {
    name: "Annual studio",
  });
  const account = await owner.client.query(api.accounts.getMine, {});
  await owner.client.mutation(internal.billing.reserveCheckout, {
    organizationId: project.id,
    billingEmail: "billing@example.invalid",
    lookupKey: "pro_monthly",
    requestedReservationId: "first",
  });
  await t.run(async (ctx) => {
    const profile = await ctx.db
      .query("billingProfiles")
      .withIndex("by_account", (q) => q.eq("accountId", account!.id))
      .unique();
    expect(profile).not.toBeNull();
    await ctx.db.patch(profile!._id, {
      checkoutLeaseExpiresAt: 0,
      stripeCheckoutSessionId: "cs_monthly",
      expectedProPriceId: "price_monthly",
    });
  });
  expect(
    await owner.client.mutation(internal.billing.reserveCheckout, {
      organizationId: project.id,
      billingEmail: "billing@example.invalid",
      lookupKey: "pro_annual",
      requestedReservationId: "second",
    }),
  ).toMatchObject({
    lookupKey: "pro_monthly",
    stripeCheckoutSessionId: "cs_monthly",
    expectedProPriceId: "price_monthly",
  });
});
