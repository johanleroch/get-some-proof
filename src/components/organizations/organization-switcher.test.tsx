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
  useQuery: mocks.useQuery,
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

  function renderSwitcher(currentName = "Acme", currentSlug = "acme-1234") {
    return render(
      <SidebarProvider>
        <OrganizationSwitcher
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

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Switch Organization" }),
      { button: 0, ctrlKey: false },
    );
    expect(screen.getAllByText("Acme")).not.toHaveLength(0);
    expect(
      screen.getByRole("menuitem", { name: /create organization/i }),
    ).toHaveAttribute("href", "/onboarding");
  });

  it("switches a multi-Organization User to the equivalent safe route", () => {
    mocks.useQuery.mockReturnValue([
      { id: "organization-1", name: "Acme", slug: "acme-1234" },
      { id: "organization-2", name: "Beta", slug: "beta-5678" },
    ]);

    renderSwitcher();
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Switch Organization" }),
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
});
