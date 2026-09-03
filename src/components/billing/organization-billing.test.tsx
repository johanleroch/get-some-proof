import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  billingLifecycleCopy,
  BillingCockpit,
  OrganizationBilling,
} from "./organization-billing";

const mocks = vi.hoisted(() => ({
  availability: "unavailable" as "available" | "unavailable",
  canManage: true,
  checkoutReturn: null as string | null,
  getOffers: vi.fn(),
  getSubscriptionDetails: vi.fn(),
  openPortal: vi.fn(),
  organization: {
    id: "organization-1",
    name: "Acme",
    slug: "acme-1234",
  } as { id: string; name: string; slug: string } | null | undefined,
  updateContact: vi.fn(),
  startCheckout: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");

  return {
    useAction: (reference: Parameters<typeof getFunctionName>[0]) =>
      getFunctionName(reference) === "billingActions:getOffers"
        ? mocks.getOffers
        : getFunctionName(reference) === "billingActions:startCheckout"
          ? mocks.startCheckout
          : getFunctionName(reference) === "billingActions:openPortal"
            ? mocks.openPortal
            : getFunctionName(reference) ===
                "billingActions:getSubscriptionDetails"
              ? mocks.getSubscriptionDetails
              : mocks.updateContact,
    useQuery: (_reference: unknown, args: unknown) => {
      if (typeof args === "object" && args && "slug" in args) {
        return mocks.organization;
      }

      if (args === "skip") return undefined;

      return {
        availability: mocks.availability,
        billingContact: "accounts@acme.example",
        canManage: mocks.canManage,
        effectivePlan: "free",
        state: mocks.availability === "available" ? "missing" : "unavailable",
        subscription: null,
      };
    },
  };
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => mocks.checkoutReturn }),
}));

describe("OrganizationBilling", () => {
  beforeEach(() => {
    cleanup();
    mocks.availability = "unavailable";
    mocks.canManage = true;
    mocks.checkoutReturn = null;
    mocks.organization = {
      id: "organization-1",
      name: "Acme",
      slug: "acme-1234",
    };
    mocks.updateContact.mockReset();
    mocks.updateContact.mockResolvedValue({ email: "new@acme.example" });
    mocks.getOffers.mockReset();
    mocks.getOffers.mockResolvedValue([
      {
        amount: 2_900,
        currency: "eur",
        interval: "month",
        lookupKey: "pro_monthly",
      },
    ]);
    mocks.getSubscriptionDetails.mockReset();
    mocks.getSubscriptionDetails.mockResolvedValue({
      amount: 2_900,
      currency: "eur",
      interval: "month",
    });
    mocks.startCheckout.mockReset();
    mocks.startCheckout.mockResolvedValue({
      url: "https://checkout.stripe.example/session",
    });
    mocks.redirect.mockReset();
    mocks.openPortal.mockReset();
    mocks.openPortal.mockResolvedValue({
      url: "https://billing.stripe.example/fresh-session",
    });
  });

  it("shows an Owner the safe Free cockpit and updates the Billing Contact", async () => {
    render(<OrganizationBilling slug="acme-1234" />);

    expect(screen.getByRole("heading", { name: "Billing" })).toBeVisible();
    expect(screen.getByText("Free", { selector: "span" })).toBeVisible();
    expect(screen.getByText(/billing is not connected/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Billing Contact email")).toHaveValue(
      "accounts@acme.example",
    );

    fireEvent.change(screen.getByLabelText("Billing Contact email"), {
      target: { value: "new@acme.example" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save contact" }));

    await waitFor(() => {
      expect(mocks.updateContact).toHaveBeenCalledWith({
        organizationId: "organization-1",
        email: "new@acme.example",
      });
    });
    expect(await screen.findByText("Billing Contact updated.")).toBeVisible();
  });

  it("gives an Admin a read-only Billing cockpit", () => {
    mocks.canManage = false;

    render(<OrganizationBilling slug="acme-1234" />);

    expect(screen.getByText("accounts@acme.example")).toBeVisible();
    expect(screen.getByText(/billing is read-only for admins/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save contact" })).toBeNull();
  });

  it("renders connected Free separately from an unavailable Stripe setup", () => {
    mocks.availability = "available";

    render(<OrganizationBilling slug="acme-1234" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Billing is connected",
    );
    expect(screen.queryByText("Billing is not connected")).toBeNull();
    expect(
      screen.getByText("No Stripe subscription is active for this Workspace."),
    ).toBeVisible();
  });

  it("loads the single EUR 29 monthly Pro offer for a Free Owner", async () => {
    mocks.availability = "available";

    render(<OrganizationBilling slug="acme-1234" />);

    expect(await screen.findByText("€29")).toBeVisible();
    expect(screen.getByText("Pro monthly")).toBeVisible();
    expect(screen.queryByText(/annual/i)).toBeNull();
    expect(mocks.getOffers).toHaveBeenCalledWith({
      organizationId: "organization-1",
    });
    expect(
      screen.getByText(/payment finishes securely on stripe/i),
    ).toBeVisible();
  });

  it.each([
    ["success", /confirming your pro subscription/i],
    ["canceled", /no billing change was made/i],
  ])(
    "treats a Checkout %s return as transient copy only",
    (checkoutReturn, copy) => {
      mocks.availability = "available";
      mocks.checkoutReturn = checkoutReturn;

      render(<OrganizationBilling slug="acme-1234" />);

      expect(screen.getByRole("status")).toHaveTextContent(copy);
      expect(screen.getByText("Free", { selector: "span" })).toBeVisible();
    },
  );

  it("starts Checkout once and follows only the URL returned by the server", async () => {
    let finishCheckout!: (result: { url: string }) => void;
    const onStartCheckout = vi.fn(
      () =>
        new Promise<{ url: string }>((resolve) => {
          finishCheckout = resolve;
        }),
    );

    render(
      <BillingCockpit
        navigateToCheckout={mocks.redirect}
        offers={[
          {
            amount: 2_900,
            currency: "eur",
            interval: "month",
            lookupKey: "pro_monthly",
          },
        ]}
        onStartCheckout={onStartCheckout}
        onUpdateContact={mocks.updateContact}
        overview={{
          availability: "available",
          billingContact: "accounts@acme.example",
          canManage: true,
          effectivePlan: "free",
          state: "missing",
          subscription: null,
        }}
      />,
    );

    const checkoutButton = screen.getByRole("button", {
      name: "Continue to Stripe",
    });
    fireEvent.click(checkoutButton);
    fireEvent.click(checkoutButton);

    expect(onStartCheckout).toHaveBeenCalledTimes(1);
    expect(onStartCheckout).toHaveBeenCalledWith("pro_monthly");
    expect(checkoutButton).toBeDisabled();

    finishCheckout({ url: "https://checkout.stripe.example/server-session" });
    await waitFor(() => {
      expect(mocks.redirect).toHaveBeenCalledWith(
        "https://checkout.stripe.example/server-session",
      );
    });
  });

  it("opens one fresh Portal session on a double click", async () => {
    let finishPortal!: (result: { url: string }) => void;
    const onOpenPortal = vi.fn(
      () =>
        new Promise<{ url: string }>((resolve) => {
          finishPortal = resolve;
        }),
    );

    render(
      <BillingCockpit
        navigateToPortal={mocks.redirect}
        offers={[
          {
            amount: 2_900,
            currency: "eur",
            interval: "month",
            lookupKey: "pro_monthly",
          },
        ]}
        onOpenPortal={onOpenPortal}
        onUpdateContact={mocks.updateContact}
        overview={{
          availability: "available",
          billingContact: "accounts@acme.example",
          canManage: true,
          effectivePlan: "premium",
          state: "active",
          subscription: {
            cancelAtPeriodEnd: false,
            currentPeriodEnd: 1_799_999_999,
            priceRevision: "price-revision-test",
            status: "active",
          },
        }}
      />,
    );

    const portalButton = screen.getByRole("button", {
      name: "Manage subscription",
    });
    fireEvent.click(portalButton);
    fireEvent.click(portalButton);

    expect(onOpenPortal).toHaveBeenCalledTimes(1);
    expect(onOpenPortal).toHaveBeenCalledWith("manage");
    expect(portalButton).toBeDisabled();

    finishPortal({ url: "https://billing.stripe.example/fresh-session" });
    await waitFor(() => {
      expect(mocks.redirect).toHaveBeenCalledWith(
        "https://billing.stripe.example/fresh-session",
      );
    });
  });

  it("shows a Portal failure and allows the Owner to retry", async () => {
    const onOpenPortal = vi
      .fn()
      .mockRejectedValue(new Error("Stripe Portal is temporarily unavailable"));
    render(
      <BillingCockpit
        onOpenPortal={onOpenPortal}
        onUpdateContact={mocks.updateContact}
        overview={{
          availability: "available",
          billingContact: "accounts@acme.example",
          canManage: true,
          effectivePlan: "premium",
          state: "active",
          subscription: {
            cancelAtPeriodEnd: false,
            currentPeriodEnd: 1_799_999_999,
            priceRevision: "price-revision-test",
            status: "active",
          },
        }}
      />,
    );

    const button = screen.getByRole("button", { name: "Manage subscription" });
    fireEvent.click(button);

    expect(
      await screen.findByText("Stripe Portal is temporarily unavailable"),
    ).toBeVisible();
    expect(button).toBeEnabled();
  });

  it("keeps past_due Pro and offers Owner-only payment recovery", () => {
    const { rerender } = render(
      <BillingCockpit
        onOpenPortal={mocks.openPortal}
        onUpdateContact={mocks.updateContact}
        overview={{
          availability: "available",
          billingContact: "accounts@acme.example",
          canManage: true,
          effectivePlan: "premium",
          state: "past_due",
          subscription: {
            cancelAtPeriodEnd: false,
            currentPeriodEnd: 1_799_999_999,
            priceRevision: "price-revision-test",
            status: "past_due",
          },
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Payment needs attention",
    );
    expect(screen.getByText("Pro", { selector: "span" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Update payment method" }),
    ).toBeVisible();

    rerender(
      <BillingCockpit
        onOpenPortal={mocks.openPortal}
        onUpdateContact={mocks.updateContact}
        overview={{
          availability: "available",
          billingContact: "accounts@acme.example",
          canManage: false,
          effectivePlan: "premium",
          state: "past_due",
          subscription: {
            cancelAtPeriodEnd: false,
            currentPeriodEnd: 1_799_999_999,
            priceRevision: "price-revision-test",
            status: "past_due",
          },
        }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Update payment method" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Manage subscription" }),
    ).toBeNull();
  });

  it("shows an Admin the synchronized price, cadence, dates, state, and contact read-only", () => {
    render(
      <BillingCockpit
        offers={[
          {
            amount: 2_900,
            currency: "eur",
            interval: "month",
            lookupKey: "pro_monthly",
          },
        ]}
        onUpdateContact={mocks.updateContact}
        subscriptionDetails={{
          amount: 2_900,
          currency: "eur",
          interval: "month",
        }}
        overview={{
          availability: "available",
          billingContact: "accounts@acme.example",
          canManage: false,
          effectivePlan: "premium",
          state: "cancellation_scheduled",
          subscription: {
            cancelAtPeriodEnd: true,
            currentPeriodEnd: 1_799_999_999,
            priceRevision: "price-revision-test",
            status: "active",
          },
        }}
      />,
    );

    const exactDate = new Intl.DateTimeFormat(undefined, {
      dateStyle: "long",
    }).format(new Date(1_799_999_999_000));
    expect(screen.getByRole("status")).toHaveTextContent(
      `Pro access remains available through ${exactDate}`,
    );
    expect(screen.getByText("Monthly")).toBeVisible();
    expect(screen.getByText(/€29.*month/i)).toBeVisible();
    expect(screen.getByText("accounts@acme.example")).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(["unpaid", "canceled", "incomplete_expired"] as const)(
    "offers a new Checkout alongside Portal history for terminal %s",
    (state) => {
      render(
        <BillingCockpit
          offers={[
            {
              amount: 2_900,
              currency: "eur",
              interval: "month",
              lookupKey: "pro_monthly",
            },
          ]}
          onOpenPortal={mocks.openPortal}
          onStartCheckout={mocks.startCheckout}
          onUpdateContact={mocks.updateContact}
          overview={{
            availability: "available",
            billingContact: "accounts@acme.example",
            canManage: true,
            effectivePlan: "free",
            state,
            subscription: {
              cancelAtPeriodEnd: false,
              currentPeriodEnd: 1_799_999_999,
              priceRevision: "price-revision-test",
              status: state,
            },
          }}
        />,
      );

      expect(
        screen.getByRole("button", { name: "Manage subscription" }),
      ).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Continue to Stripe" }),
      ).toBeVisible();
    },
  );

  it("covers loading and unavailable Organization states", () => {
    mocks.organization = undefined;
    const { rerender } = render(<OrganizationBilling slug="acme-1234" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Billing…");

    mocks.organization = null;
    rerender(<OrganizationBilling slug="missing-1234" />);
    expect(
      screen.getByRole("heading", { name: "Organization unavailable" }),
    ).toBeVisible();
  });

  it.each([
    ["active", "Pro is active"],
    ["trialing", "Unsupported Stripe state"],
    ["past_due", "Payment needs attention"],
    ["cancellation_scheduled", "Cancellation scheduled"],
    ["unpaid", "Subscription is unpaid"],
    ["canceled", "Subscription canceled"],
    ["incomplete_expired", "Subscription setup expired"],
  ] as const)("describes %s with distinct lifecycle copy", (state, title) => {
    expect(
      billingLifecycleCopy({
        availability: "available",
        billingContact: "accounts@acme.example",
        canManage: false,
        effectivePlan:
          state === "active" ||
          state === "past_due" ||
          state === "cancellation_scheduled"
            ? "premium"
            : "free",
        state,
        subscription: {
          cancelAtPeriodEnd: state === "cancellation_scheduled",
          currentPeriodEnd: 1_799_999_999,
          priceRevision: "price-revision-test",
          status: state,
        },
      }).title,
    ).toBe(title);
  });
});
