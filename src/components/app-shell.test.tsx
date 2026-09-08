import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./app-shell";

const mocks = vi.hoisted(() => ({
  pathname: "/org/acme-1234/dashboard",
  readBilling: true,
  readAudit: true,
  updateOrganization: true,
  effectivePlan: "free",
}));

vi.mock("convex/react", () => ({
  useQuery: () => ({
    effectivePlan: mocks.effectivePlan,
    can: {
      readAudit: mocks.readAudit,
      readBilling: mocks.readBilling,
      updateOrganization: mocks.updateOrganization,
    },
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("@/components/account/nav-user", () => ({
  NavUser: () => <div>User menu</div>,
}));

vi.mock("@/components/organizations/organization-switcher", () => ({
  OrganizationSwitcher: ({ currentName }: { currentName: string }) => (
    <button aria-label="Switch project">{currentName}</button>
  ),
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div>Theme control</div>,
}));

describe("AppShell", () => {
  it("shows the Account plan and an English upgrade action beside the user menu", () => {
    render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Harbor Studio"
        organizationPublicSlug="harbor"
        organizationSlug="harbor-1234"
      >
        Dashboard
      </AppShell>,
    );
    expect(screen.getByText("Free plan")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Upgrade to Pro" }),
    ).toHaveAttribute("href", "/org/harbor-1234/billing");
  });
  beforeEach(() => {
    cleanup();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
      writable: true,
    });
    mocks.pathname = "/org/acme-1234/dashboard";
    mocks.readBilling = true;
    mocks.readAudit = true;
    mocks.updateOrganization = true;
  });

  it("shows one Brand without multi-Organization or collaboration navigation", () => {
    render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Acme"
        organizationPublicSlug="acme"
        organizationSlug="acme-1234"
      >
        Dashboard content
      </AppShell>,
    );

    expect(
      screen.getAllByRole("link", { name: "Overview" })[0],
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("button", { name: "Switch project" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Project settings" }),
    ).toHaveAttribute("href", "/org/acme-1234/settings");
    expect(screen.queryByRole("link", { name: "Billing" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Projects" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Members" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Audit Log" })).toBeNull();
    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.queryByText("Collaboration")).toBeNull();
    expect(screen.getAllByText("User menu")).not.toHaveLength(0);
  });

  it("keeps Brand navigation on settings pages", () => {
    mocks.pathname = "/org/acme-1234/settings";
    render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Acme"
        organizationPublicSlug="acme"
        organizationSlug="acme-1234"
      >
        Settings content
      </AppShell>,
    );

    expect(
      screen.getByRole("link", { name: "Project settings" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Billing" })).toBeNull();
    expect(screen.getByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Projects" })).toBeNull();
    expect(screen.getByText("Project")).toBeInTheDocument();
  });

  it("switches to personal Account navigation without changing the shell", () => {
    mocks.pathname = "/account/profile";
    render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Acme"
        organizationPublicSlug="acme"
        organizationSlug="acme-1234"
      >
        Profile content
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Security" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Overview" })).toBeNull();
    expect(screen.queryByRole("link", { name: "New project" })).toBeNull();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("hides privileged destinations for lower roles", () => {
    mocks.pathname = "/org/acme-1234/settings";
    mocks.readAudit = false;
    mocks.readBilling = false;
    mocks.updateOrganization = false;
    render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Acme"
        organizationPublicSlug="acme"
        organizationSlug="acme-1234"
      >
        Dashboard content
      </AppShell>,
    );

    expect(screen.queryByRole("link", { name: "Audit Log" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Billing" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Project settings" })).toBeNull();
    expect(screen.getAllByText("User menu")).not.toHaveLength(0);
  });

  it("supports native sidebar collapse", () => {
    const { container } = render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Acme"
        organizationPublicSlug="acme"
        organizationSlug="acme-1234"
      >
        Dashboard content
      </AppShell>,
    );

    const sidebar = container.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toHaveAttribute("data-state", "expanded");
    const triggers = screen.getAllByRole("button", {
      name: "Toggle Sidebar",
    });
    expect(triggers).toHaveLength(1);
    fireEvent.click(triggers[0]);
    expect(sidebar).toHaveAttribute("data-state", "collapsed");
    expect(screen.getAllByRole("link", { name: "Overview" })).not.toHaveLength(
      0,
    );
  });

  it("renders one flat frame without theme-only decorative layers", () => {
    const { container } = render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Acme"
        organizationPublicSlug="acme"
        organizationSlug="acme-1234"
      >
        Dashboard content
      </AppShell>,
    );

    const frame = container.querySelector(".dashboard-frame");
    const view = container.querySelector(".dashboard-view");
    const viewContent = container.querySelector(".dashboard-view-content");

    expect(frame).toHaveAttribute("data-slot", "sidebar-wrapper");
    expect(view).toHaveAttribute("data-slot", "sidebar-inset");
    expect(viewContent?.parentElement).toBe(view);
    expect(container.querySelector(".dashboard-frame-background")).toBeNull();
    expect(container.querySelector(".dashboard-sidebar-effects")).toBeNull();
    expect(container.querySelector(".dashboard-view-effects")).toBeNull();
    expect(container.querySelectorAll(".dashboard-shine")).toHaveLength(0);
  });

  it("opens and dismisses the native mobile sidebar", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 500,
      writable: true,
    });

    render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Acme"
        organizationPublicSlug="acme"
        organizationSlug="acme-1234"
      >
        Dashboard content
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
    expect(screen.getByRole("dialog", { name: "Sidebar" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Sidebar" })).toBeNull();
  });
});
