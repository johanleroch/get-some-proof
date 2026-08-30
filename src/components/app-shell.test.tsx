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

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div>Theme control</div>,
}));

describe("AppShell", () => {
  beforeEach(() => {
    cleanup();
    mocks.pathname = "/org/acme-1234/dashboard";
    mocks.readAudit = true;
    mocks.updateOrganization = true;
  });

  it("exposes permission-aware navigation with an active-page announcement", () => {
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
    expect(screen.getAllByRole("link", { name: "Audit Log" })).not.toHaveLength(
      0,
    );
    expect(
      screen.getAllByRole("link", { name: "Organization settings" }),
    ).not.toHaveLength(0);
    expect(
      screen.getAllByRole("link", { name: "Account security" }),
    ).not.toHaveLength(0);
  });

  it("hides privileged destinations for lower roles", () => {
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
    expect(
      screen.getAllByRole("link", { name: "Account security" }),
    ).not.toHaveLength(0);
  });

  it("supports a keyboard-dismissible mobile dialog and desktop collapse", () => {
    render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Acme"
        organizationSlug="acme-1234"
      >
        Dashboard content
      </AppShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(
      screen.getByRole("dialog", { name: "Mobile navigation" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Open navigation" }),
    ).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(
      screen.getByRole("button", { name: "Expand sidebar" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Projects" })).not.toHaveLength(
      0,
    );
  });
});
