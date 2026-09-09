import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";
import { OrganizationSwitcher } from "./organization-switcher";

const mocks = vi.hoisted(() => ({
  pathname: "/org/acme-1234/projects",
  replace: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("convex/react", () => ({
  usePaginatedQuery: () => {
    const results = mocks.useQuery();
    return {
      results: results ?? [],
      status: results === undefined ? "LoadingFirstPage" : "Exhausted",
      loadMore: vi.fn(),
    };
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));

describe("OrganizationSwitcher", () => {
  beforeEach(() => {
    cleanup();
    mocks.pathname = "/org/acme-1234/projects";
    mocks.replace.mockReset();
    mocks.useQuery.mockReset();
  });

  function renderSwitcher(
    currentName = "Acme",
    currentSlug = "acme-1234",
    permissions = {
      canReadAudit: true,
      canReadBilling: true,
      canUpdateOrganization: true,
    },
  ) {
    return render(
      <SidebarProvider>
        <OrganizationSwitcher
          canReadAudit={permissions.canReadAudit}
          canReadBilling={permissions.canReadBilling}
          canUpdateOrganization={permissions.canUpdateOrganization}
          currentName={currentName}
          currentSlug={currentSlug}
        />
      </SidebarProvider>,
    );
  }

  it("shows the active Organization and creation action", () => {
    mocks.useQuery.mockReturnValue([
      { id: "organization-1", name: "Acme", slug: "acme-1234" },
    ]);

    renderSwitcher();

    const trigger = screen.getByRole("button", {
      name: "Switch project",
    });
    expect(trigger).toHaveClass("cursor-pointer");
    // The project's name is the sidebar's title and the switch itself: no
    // avatar, no initials, the name at `heading`.
    expect(trigger.querySelector(".type-heading")).toHaveTextContent("Acme");
    expect(trigger.querySelector('[data-slot="avatar-fallback"]')).toBeNull();

    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    expect(screen.getAllByText("Acme")).not.toHaveLength(0);
    expect(
      screen.getByRole("menuitem", { name: /create project/i }),
    ).toHaveAttribute("href", "/projects/new");
    expect(
      screen.getByRole("menuitem", { name: "Project settings" }),
    ).toHaveAttribute("href", "/org/acme-1234/settings");
    expect(screen.getByRole("menuitem", { name: "Audit Log" })).toHaveAttribute(
      "href",
      "/org/acme-1234/audit",
    );
    expect(screen.getByRole("menuitem", { name: "Billing" })).toHaveAttribute(
      "href",
      "/org/acme-1234/billing",
    );
    for (const item of screen.getAllByRole("menuitem")) {
      expect(item).toHaveClass("cursor-pointer");
    }
  });

  it("hides Organization administration actions without permission", () => {
    mocks.useQuery.mockReturnValue([
      { id: "organization-1", name: "Acme", slug: "acme-1234" },
    ]);

    renderSwitcher("Acme", "acme-1234", {
      canReadAudit: false,
      canReadBilling: false,
      canUpdateOrganization: false,
    });
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Switch project" }),
      { button: 0, ctrlKey: false },
    );

    expect(
      screen.queryByRole("menuitem", { name: "Project settings" }),
    ).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Audit Log" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Billing" })).toBeNull();
  });

  it("switches a multi-Organization User to the equivalent safe route", () => {
    mocks.useQuery.mockReturnValue([
      { id: "organization-1", name: "Acme", slug: "acme-1234" },
      { id: "organization-2", name: "Beta", slug: "beta-5678" },
    ]);

    renderSwitcher();
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Switch project" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Beta/ }));

    expect(mocks.replace).toHaveBeenCalledWith("/org/beta-5678/projects");
  });

  it("leaves a revoked Organization route for the first active Membership", async () => {
    mocks.pathname = "/org/revoked-1234/settings";
    mocks.useQuery.mockReturnValue([
      { id: "organization-1", name: "Acme", slug: "acme-1234" },
    ]);

    renderSwitcher("Revoked", "revoked-1234");

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/org/acme-1234/settings");
    });
  });

  it("preserves the Billing section when switching Organization", () => {
    mocks.pathname = "/org/acme-1234/billing";
    mocks.useQuery.mockReturnValue([
      { id: "organization-1", name: "Acme", slug: "acme-1234" },
      { id: "organization-2", name: "Beta", slug: "beta-5678" },
    ]);

    renderSwitcher();
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Switch project" }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Beta/ }));

    expect(mocks.replace).toHaveBeenCalledWith("/org/beta-5678/billing");
  });
});
