import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationBilling } from "./organization-billing";

const mocks = vi.hoisted(() => ({
  availability: "unavailable" as "available" | "unavailable",
  canManage: true,
  organization: {
    id: "organization-1",
    name: "Acme",
    slug: "acme-1234",
  } as { id: string; name: string; slug: string } | null | undefined,
  updateContact: vi.fn(),
}));

vi.mock("convex/react", () => ({
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
}));

describe("OrganizationBilling", () => {
  beforeEach(() => {
    cleanup();
    mocks.availability = "unavailable";
    mocks.canManage = true;
    mocks.organization = {
      id: "organization-1",
      name: "Acme",
      slug: "acme-1234",
    };
    mocks.updateContact.mockReset();
    mocks.updateContact.mockResolvedValue({ email: "new@acme.example" });
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
