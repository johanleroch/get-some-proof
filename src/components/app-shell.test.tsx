import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./app-shell";

const mocks = vi.hoisted(() => ({
  pathname: "/org/acme-1234/dashboard",
  readBilling: true,
  readAudit: true,
  updateOrganization: true,
  effectivePlan: "free",
  manageOwnership: true,
  pending: 0,
}));

vi.mock("convex/react", () => ({
  useQuery: () => ({
    effectivePlan: mocks.effectivePlan,
    pending: mocks.pending,
    can: {
      manageOwnership: mocks.manageOwnership,
      readAudit: mocks.readAudit,
      readBilling: mocks.readBilling,
      updateOrganization: mocks.updateOrganization,
    },
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/account/nav-user", () => ({
  NavUser: () => <div>User menu</div>,
}));

vi.mock("@/components/organizations/organization-switcher", () => ({
  OrganizationSwitcher: ({ currentName }: { currentName: string }) => (
    <button aria-label="Switch project">{currentName}</button>
  ),
}));

describe("AppShell", () => {
  it("sells Pro above the user menu on a Free Account, without naming Free", () => {
    render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Bumpr"
        organizationPublicSlug="bumpr"
        organizationSlug="bumpr-1234"
      >
        Dashboard
      </AppShell>,
    );
    expect(screen.getByText("Collect without limits")).toBeInTheDocument();
    expect(screen.queryByText("Free plan")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Upgrade to Pro" }),
    ).toHaveAttribute("href", "/account/billing");
  });

  it("shows no plan card at all on a Pro Account", () => {
    mocks.effectivePlan = "premium";
    const { container } = render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Bumpr"
        organizationPublicSlug="bumpr"
        organizationSlug="bumpr-1234"
      >
        Dashboard
      </AppShell>,
    );
    expect(
      container.querySelector('[data-slot="sidebar-plan-card"]'),
    ).toBeNull();
    expect(screen.queryByText("Collect without limits")).toBeNull();
    expect(screen.queryByText("Pro plan")).toBeNull();
    expect(screen.queryByRole("link", { name: "Upgrade to Pro" })).toBeNull();
    expect(screen.getAllByText("User menu")).not.toHaveLength(0);
  });

  beforeEach(() => {
    cleanup();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
      writable: true,
    });
    mocks.pathname = "/org/acme-1234/dashboard";
    mocks.effectivePlan = "free";
    mocks.manageOwnership = true;
    mocks.pending = 0;
    mocks.readBilling = true;
    mocks.readAudit = true;
    mocks.updateOrganization = true;
  });

  it("counts the Inbox queue beside its name, and marks what opens elsewhere", () => {
    mocks.pending = 3;
    render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Bumpr"
        organizationPublicSlug="bumpr"
        organizationSlug="bumpr-1234"
      >
        Dashboard
      </AppShell>,
    );
    expect(
      screen.getByRole("link", { name: "Inbox, 3 to review" }),
    ).toHaveAttribute("href", "/org/bumpr-1234/inbox");
    expect(screen.getByRole("link", { name: "Public Wall" })).toHaveAttribute(
      "target",
      "_blank",
    );
  });

  it("sends the active indicator to the clicked item before the page arrives, and the route settles it", () => {
    const { container, rerender } = render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Acme"
        organizationPublicSlug="acme"
        organizationSlug="acme-1234"
      >
        Dashboard
      </AppShell>,
    );
    const indicator = () =>
      container.querySelector(
        '[data-slot="sidebar-active-indicator"]',
      ) as HTMLElement;
    expect(indicator().style.top).toBe("0px");

    fireEvent.click(screen.getByRole("link", { name: "Inbox" }));

    expect(indicator().style.top).toBe("40px");
    expect(indicator()).toHaveAttribute("data-travel", "down");
    expect(screen.getByRole("link", { name: "Inbox" })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    mocks.pathname = "/org/acme-1234/inbox";
    rerender(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Acme"
        organizationPublicSlug="acme"
        organizationSlug="acme-1234"
      >
        Inbox
      </AppShell>,
    );
    expect(indicator().style.top).toBe("40px");
    expect(screen.getByRole("link", { name: "Inbox" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("caps the Inbox count at 500+ and says so to assistive tech", () => {
    mocks.pending = 501;
    render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Acme"
        organizationPublicSlug="acme"
        organizationSlug="acme-1234"
      >
        Dashboard
      </AppShell>,
    );
    expect(
      screen.getByRole("link", { name: "Inbox, 500+ to review" }),
    ).toHaveTextContent("500+");
  });

  it("keeps the Inbox out of the navigation for accounts that cannot manage ownership", () => {
    mocks.manageOwnership = false;
    mocks.pending = 3;
    render(
      <AppShell
        organizationId={"organization-1" as never}
        organizationName="Acme"
        organizationPublicSlug="acme"
        organizationSlug="acme-1234"
      >
        Dashboard
      </AppShell>,
    );
    expect(screen.queryByRole("link", { name: /inbox/i })).toBeNull();
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
  });

  it.each(["profile", "security", "billing"])(
    "keeps a route back to Overview from Account %s",
    (page) => {
      mocks.pathname = `/account/${page}`;
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

      expect(
        screen.getByRole("link", {
          name:
            page === "profile"
              ? "Profile"
              : page === "security"
                ? "Security"
                : "Billing",
        }),
      ).toHaveAttribute("aria-current", "page");
      expect(
        screen.getByRole("link", { name: "Security" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Back to project" }),
      ).toHaveAttribute("href", "/org/acme-1234/dashboard");
      expect(
        screen.getByRole("link", { name: "Back to project" }),
      ).not.toHaveAttribute("aria-current");
      expect(screen.queryByRole("link", { name: "Overview" })).toBeNull();
      expect(screen.getByRole("link", { name: "Billing" })).toHaveAttribute(
        "href",
        "/account/billing",
      );
      expect(screen.queryByRole("link", { name: "New project" })).toBeNull();
    },
  );

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
    // No bar above the page on desktop: the menu button lives in a bar the
    // stylesheet hides from 768px, and the keyboard shortcut folds the
    // sidebar for who wants it.
    expect(
      screen.getByRole("button", { name: "Toggle Sidebar" }).closest("header"),
    ).toHaveClass("md:hidden");
    expect(screen.queryByRole("button", { name: "Theme" })).toBeNull();
    fireEvent.keyDown(window, { key: "b", metaKey: true });
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
