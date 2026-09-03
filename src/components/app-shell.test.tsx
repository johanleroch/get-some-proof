import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./app-shell";

const mocks = vi.hoisted(() => ({
  pathname: "/org/acme-1234/dashboard",
  readBilling: true,
  readAudit: true,
  updateOrganization: true,
}));

vi.mock("convex/react", () => ({
  useQuery: () => ({
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
    expect(screen.getByRole("link", { name: "Acme" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Brand settings" }),
    ).toHaveAttribute("href", "/org/acme-1234/settings");
    expect(screen.queryByRole("link", { name: "Billing" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Projects" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Members" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Audit Log" })).toBeNull();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
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
      screen.getByRole("link", { name: "Brand settings" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Billing" })).toBeNull();
    expect(screen.getByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Projects" })).toBeNull();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
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
    expect(screen.queryByRole("link", { name: "Brand settings" })).toBeNull();
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

  it("applies the Linear background layers to the complete application frame", () => {
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
    const frameBackground = container.querySelector(
      ".dashboard-frame-background",
    );
    const sidebarEffects = container.querySelector(
      ".dashboard-sidebar-effects",
    );
    const viewEffects = container.querySelector(".dashboard-view-effects");
    const viewContent = container.querySelector(".dashboard-view-content");
    const shines = container.querySelectorAll(".dashboard-shine");
    const sidebarInner = container.querySelector('[data-slot="sidebar-inner"]');

    expect(frame).toHaveAttribute("data-slot", "sidebar-wrapper");
    expect(view).toHaveAttribute("data-slot", "sidebar-inset");
    expect(frameBackground?.parentElement).toBe(frame);
    expect(sidebarEffects?.parentElement).toBe(sidebarInner);
    expect(viewEffects?.parentElement).toBe(view);
    expect(viewContent?.parentElement).toBe(view);
    expect(shines).toHaveLength(4);
    expect([...shines].every((shine) => shine.parentElement === frame)).toBe(
      true,
    );
    expect(viewContent?.contains(viewEffects)).toBe(false);
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
