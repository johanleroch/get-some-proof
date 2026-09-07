import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DevQuickAccess } from "./dev-quick-access";

const mocks = vi.hoisted(() => ({
  authenticated: true,
  organizations: [
    { name: "Bumper", publicSlug: "bumper", slug: "bumper-bjug" },
  ] as Array<{ name: string; publicSlug: string; slug: string }> | undefined,
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: mocks.authenticated,
    isLoading: false,
  }),
  useQuery: () => mocks.organizations,
}));

describe("DevQuickAccess", () => {
  beforeEach(() => {
    cleanup();
    mocks.authenticated = true;
    mocks.organizations = [
      { name: "Bumper", publicSlug: "bumper", slug: "bumper-bjug" },
    ];
  });

  it("opens a menu with design, workspace, public and auth links", () => {
    render(<DevQuickAccess />);
    const trigger = screen.getByRole("button", {
      name: "Designer quick access",
    });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    expect(screen.getByText("Signed in · Bumper")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Kit" })).toHaveAttribute(
      "href",
      "/kit",
    );
    expect(screen.getByRole("menuitem", { name: "Inbox" })).toHaveAttribute(
      "href",
      "/org/bumper-bjug/inbox",
    );
    expect(
      screen.getByRole("menuitem", { name: "Public Wall" }),
    ).toHaveAttribute("href", "/w/bumper");
    expect(
      screen.getByRole("menuitem", { name: "Sign in" }),
    ).toBeInTheDocument();
  });

  it("falls back to design and auth links when signed out", () => {
    mocks.authenticated = false;
    mocks.organizations = undefined;
    render(<DevQuickAccess />);
    const trigger = screen.getByRole("button", {
      name: "Designer quick access",
    });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    expect(screen.getByText("Signed out")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Screens" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Templates" })).toHaveAttribute(
      "href",
      "/kit/templates",
    );
    expect(
      screen.getByRole("menuitem", { name: "Templates gallery" }),
    ).toHaveAttribute("href", "/templates");
    expect(screen.queryByRole("menuitem", { name: "Inbox" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Public Wall" })).toBeNull();
  });
});
