import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BillingCockpit, OrganizationBilling } from "./organization-billing";

const mocks = vi.hoisted(() => ({
  availability: "unavailable" as "available" | "unavailable",
  canManage: true,
  checkoutReturn: null as string | null,
  getOffers: vi.fn(),
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
        : mocks.startCheckout,
    useMutation: () => mocks.updateContact,
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
        amount: 4_900,
        currency: "eur",
        interval: "month",
        lookupKey: "premium_monthly",
      },
      {
        amount: 49_000,
        currency: "eur",
        interval: "year",
        lookupKey: "premium_annual",
      },
    ]);
    mocks.startCheckout.mockReset();
    mocks.startCheckout.mockResolvedValue({
      url: "https://checkout.stripe.example/session",
    });
    mocks.redirect.mockReset();
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
      screen.getByText(
        "No Stripe subscription is active for this Organization.",
      ),
    ).toBeVisible();
  });

  it("loads the live monthly and annual Premium offers for a Free Owner", async () => {
    mocks.availability = "available";

    render(<OrganizationBilling slug="acme-1234" />);

    expect(
      await screen.findByRole("button", { name: /monthly.*€49/i }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /annual.*€490/i })).toBeVisible();
    expect(mocks.getOffers).toHaveBeenCalledWith({
      organizationId: "organization-1",
    });
    expect(
      screen.getByText(/payment finishes securely on stripe/i),
    ).toBeVisible();
  });

  it.each([
    ["success", /confirming your premium subscription/i],
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
            amount: 4_900,
            currency: "eur",
            interval: "month",
            lookupKey: "premium_monthly",
          },
        ]}
        onStartCheckout={onStartCheckout}
        onUpdateContact={mocks.updateContact}
        overview={{
          availability: "available",
          billingContact: "accounts@acme.example",
          canManage: true,
          effectivePlan: "free",
        }}
      />,
    );

    const checkoutButton = screen.getByRole("button", {
      name: "Continue to Stripe",
    });
    fireEvent.click(checkoutButton);
    fireEvent.click(checkoutButton);

    expect(onStartCheckout).toHaveBeenCalledTimes(1);
    expect(onStartCheckout).toHaveBeenCalledWith("premium_monthly");
    expect(checkoutButton).toBeDisabled();

    finishCheckout({ url: "https://checkout.stripe.example/server-session" });
    await waitFor(() => {
      expect(mocks.redirect).toHaveBeenCalledWith(
        "https://checkout.stripe.example/server-session",
      );
    });
  });

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
});
