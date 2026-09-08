import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticatedApplicationShell } from "./authenticated-application-shell";

const mocks = vi.hoisted(() => ({
  pathname: "/org/acme-1234/projects",
  replace: vi.fn(),
  isAuthenticated: true,
  isLoading: false,
  queriedWhileUnauthenticated: false,
  routeOrganization: null as { id: string; name: string; slug: string } | null,
  organizations: [{ id: "organization-1", name: "Acme", slug: "acme-1234" }] as
    Array<{ id: string; name: string; slug: string }> | undefined,
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");
  return {
    useConvexAuth: () => ({
      isAuthenticated: mocks.isAuthenticated,
      isLoading: mocks.isLoading,
    }),
    useQuery: (
      reference: Parameters<typeof getFunctionName>[0],
      args: { slug?: string } | "skip",
    ) => {
      if (args === "skip") return undefined;
      if (!mocks.isAuthenticated) mocks.queriedWhileUnauthenticated = true;
      if (getFunctionName(reference) === "accounts:getMine") return null;
      if (getFunctionName(reference) === "organizations:getBySlug")
        return (
          mocks.routeOrganization ??
          mocks.organizations?.find((project) => project.slug === args.slug) ??
          null
        );
      return mocks.organizations;
    },
  };
});

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
    mocks.isAuthenticated = true;
    mocks.isLoading = false;
    mocks.queriedWhileUnauthenticated = false;
    mocks.routeOrganization = null;
  });

  it("waits for Convex authentication before loading private data", () => {
    mocks.isAuthenticated = false;
    mocks.isLoading = true;
    const view = render(
      <AuthenticatedApplicationShell>
        Private content
      </AuthenticatedApplicationShell>,
    );
    expect(mocks.queriedWhileUnauthenticated).toBe(false);
    expect(screen.queryByText("Private content")).toBeNull();
    expect(mocks.replace).not.toHaveBeenCalled();
    mocks.isAuthenticated = true;
    mocks.isLoading = false;
    view.rerender(
      <AuthenticatedApplicationShell>
        Private content
      </AuthenticatedApplicationShell>,
    );
    expect(screen.getByText("Private content")).toBeInTheDocument();
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

  it("keeps navigation for a Project outside the initial listing page", () => {
    mocks.pathname = "/org/later-project/dashboard";
    mocks.routeOrganization = {
      id: "organization-later",
      name: "Later project",
      slug: "later-project",
    };
    render(
      <AuthenticatedApplicationShell>
        Later project
      </AuthenticatedApplicationShell>,
    );
    expect(screen.getByTestId("app-shell")).toHaveAttribute(
      "data-organization",
      "later-project",
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
