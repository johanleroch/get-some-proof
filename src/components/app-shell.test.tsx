import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./app-shell";

const mocks = vi.hoisted(() => ({
  pathname: "/org/acme-1234/dashboard",
  readAudit: true,
  updateOrganization: true,
}));

vi.mock("convex/react", () => ({
  useQuery: () => ({
    can: {
      readAudit: mocks.readAudit,
      updateOrganization: mocks.updateOrganization,
    },
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("@/components/organizations/organization-switcher", () => ({
  OrganizationSwitcher: () => <div>Organization switcher</div>,
}));

vi.mock("@/components/account/nav-user", () => ({
  NavUser: () => <div>User menu</div>,
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div>Theme control</div>,
}));

describe("AppShell", () => {
  beforeEach(() => {
    cleanup();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
      writable: true,
    });
    mocks.pathname = "/org/acme-1234/dashboard";
    mocks.readAudit = true;
    mocks.updateOrganization = true;
  });

  it("shows product navigation without duplicating Organization administration", () => {
    render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Acme"
        organizationSlug="acme-1234"
      >
        Dashboard content
      </AppShell>,
    );

    expect(
      screen.getAllByRole("link", { name: "Overview" })[0],
    ).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Audit Log" })).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Organization settings" }),
    ).toBeNull();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Collaboration")).toBeInTheDocument();
    expect(screen.getAllByText("User menu")).not.toHaveLength(0);
  });

  it("switches to Organization administration navigation on settings pages", () => {
    mocks.pathname = "/org/acme-1234/settings";
    render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Acme"
        organizationSlug="acme-1234"
      >
        Settings content
      </AppShell>,
    );

    expect(
      screen.getByRole("link", { name: "Organization settings" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Audit Log" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Overview" }),
    ).toHaveAttribute("href", "/org/acme-1234/dashboard");
    expect(screen.queryByRole("link", { name: "Projects" })).toBeNull();
    expect(screen.getByText("Organization")).toBeInTheDocument();
  });

  it("switches to personal Account navigation without changing the shell", () => {
    mocks.pathname = "/account/profile";
    render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Acme"
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
    expect(
      screen.getByRole("link", { name: "Back to Overview" }),
    ).toHaveAttribute("href", "/org/acme-1234/dashboard");
    expect(screen.queryByRole("link", { name: "Overview" })).toBeNull();
    expect(screen.queryByRole("link", { name: "New project" })).toBeNull();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("hides privileged destinations for lower roles", () => {
    mocks.pathname = "/org/acme-1234/settings";
    mocks.readAudit = false;
    mocks.updateOrganization = false;
    render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Acme"
        organizationSlug="acme-1234"
      >
        Dashboard content
      </AppShell>,
    );

    expect(screen.queryByRole("link", { name: "Audit Log" })).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Organization settings" }),
    ).toBeNull();
    expect(screen.getAllByText("User menu")).not.toHaveLength(0);
  });

  it("supports native sidebar collapse", () => {
    const { container } = render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Acme"
        organizationSlug="acme-1234"
      >
        Dashboard content
      </AppShell>,
    );

    const sidebar = container.querySelector('[data-slot="sidebar"]');
    expect(sidebar).toHaveAttribute("data-state", "expanded");
    fireEvent.click(
      screen.getAllByRole("button", { name: "Toggle Sidebar" })[1],
    );
    expect(sidebar).toHaveAttribute("data-state", "collapsed");
    expect(screen.getAllByRole("link", { name: "Projects" })).not.toHaveLength(
      0,
    );
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
