import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticatedApplicationShell } from "./authenticated-application-shell";

const mocks = vi.hoisted(() => ({
  pathname: "/org/acme-1234/projects",
  replace: vi.fn(),
  organizations: [{ id: "organization-1", name: "Acme", slug: "acme-1234" }] as
    Array<{ id: string; name: string; slug: string }> | undefined,
}));

vi.mock("convex/react", () => ({
  useQuery: () => mocks.organizations,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/components/app-shell", () => ({
  AppShell: ({
    children,
    organizationSlug,
  }: {
    children: React.ReactNode;
    organizationSlug: string;
  }) => (
    <div data-organization={organizationSlug} data-testid="app-shell">
      {children}
    </div>
  ),
}));

describe("AuthenticatedApplicationShell", () => {
  beforeEach(() => {
    cleanup();
    mocks.pathname = "/org/acme-1234/projects";
    mocks.organizations = [
      { id: "organization-1", name: "Acme", slug: "acme-1234" },
    ];
    mocks.replace.mockReset();
  });

  it("keeps the same application shell across Organization routes", () => {
    const view = render(
      <AuthenticatedApplicationShell>Projects</AuthenticatedApplicationShell>,
    );
    const shell = screen.getByTestId("app-shell");

    mocks.pathname = "/org/acme-1234/dashboard";
    view.rerender(
      <AuthenticatedApplicationShell>Overview</AuthenticatedApplicationShell>,
    );

    expect(screen.getByTestId("app-shell")).toBe(shell);
    expect(screen.getByTestId("app-shell")).toHaveTextContent("Overview");
  });

  it("uses the same shell for personal Account routes", () => {
    mocks.pathname = "/account/profile";
    render(
      <AuthenticatedApplicationShell>Profile</AuthenticatedApplicationShell>,
    );

    expect(screen.getByTestId("app-shell")).toHaveAttribute(
      "data-organization",
      "acme-1234",
    );
  });

  it("leaves onboarding outside the application shell", () => {
    mocks.pathname = "/onboarding";
    mocks.organizations = [];
    render(
      <AuthenticatedApplicationShell>Onboarding</AuthenticatedApplicationShell>,
    );

    expect(screen.queryByTestId("app-shell")).toBeNull();
    expect(screen.getByText("Onboarding")).toBeInTheDocument();
  });

  it("redirects an existing Owner away from second-Brand onboarding", () => {
    mocks.pathname = "/onboarding";
    render(
      <AuthenticatedApplicationShell>Onboarding</AuthenticatedApplicationShell>,
    );

    expect(mocks.replace).toHaveBeenCalledWith("/org/acme-1234/dashboard");
    expect(screen.queryByText("Onboarding")).toBeNull();
  });
});
