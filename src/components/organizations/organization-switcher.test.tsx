import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationSwitcher } from "./organization-switcher";

const mocks = vi.hoisted(() => ({
  pathname: "/org/acme-1234/projects",
  replace: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: mocks.useQuery,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));

describe("OrganizationSwitcher", () => {
  beforeEach(() => {
    mocks.pathname = "/org/acme-1234/projects";
    mocks.replace.mockReset();
    mocks.useQuery.mockReset();
  });

  it("keeps the switcher hidden for one active Membership", () => {
    mocks.useQuery.mockReturnValue([
      { id: "organization-1", name: "Acme", slug: "acme-1234" },
    ]);

    render(<OrganizationSwitcher currentName="Acme" currentSlug="acme-1234" />);

    expect(
      screen.queryByLabelText("Switch Organization"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /create another organization/i }),
    ).toHaveAttribute("href", "/onboarding");
  });

  it("switches a multi-Organization User to the equivalent safe route", () => {
    mocks.useQuery.mockReturnValue([
      { id: "organization-1", name: "Acme", slug: "acme-1234" },
      { id: "organization-2", name: "Beta", slug: "beta-5678" },
    ]);

    render(<OrganizationSwitcher currentName="Acme" currentSlug="acme-1234" />);
    fireEvent.change(screen.getByLabelText("Switch Organization"), {
      target: { value: "beta-5678" },
    });

    expect(mocks.replace).toHaveBeenCalledWith("/org/beta-5678/projects");
  });

  it("leaves a revoked Organization route for the first active Membership", async () => {
    mocks.pathname = "/org/revoked-1234/settings";
    mocks.useQuery.mockReturnValue([
      { id: "organization-1", name: "Acme", slug: "acme-1234" },
    ]);

    render(
      <OrganizationSwitcher currentName="Revoked" currentSlug="revoked-1234" />,
    );

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/org/acme-1234/dashboard");
    });
  });
});
