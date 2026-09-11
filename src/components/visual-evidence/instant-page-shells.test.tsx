import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Id } from "@convex/_generated/dataModel";
import { OverviewRouteLoading } from "@/components/organizations/overview-route-loading";
import { ProjectShellProvider } from "@/components/organizations/project-shell-context";
import { StudioRouteLoading } from "@/components/studio/studio-route-loading";
import { InboxRouteLoading } from "@/components/testimonials/inbox-route-loading";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("?tab=archived"),
}));

const project = {
  brandName: "Atrakt",
  organizationId: "fixture-atrakt" as Id<"organizations">,
  pendingCount: 501,
  publicSlug: "atrakt",
  slug: "atrakt",
};

function renderInProject(component: ReactNode) {
  return render(
    <ProjectShellProvider value={project}>{component}</ProjectShellProvider>,
  );
}

describe("instant page route shells", () => {
  afterEach(cleanup);

  it("keeps the Overview identity, bounded queue, and relative links real", () => {
    renderInProject(<OverviewRouteLoading />);

    expect(screen.getByRole("heading", { name: "Atrakt" })).toBeVisible();
    expect(screen.getByText("500+")).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeDisabled();
    expect(
      screen.getByRole("link", { name: /Open Collection Form/ }),
    ).toHaveAttribute("href", "/c/atrakt");
    expect(screen.getByRole("link", { name: /Open Wall/ })).toHaveAttribute(
      "href",
      "/w/atrakt",
    );
  });

  it("keeps Inbox actions and the URL-selected accessible tab real", () => {
    renderInProject(<InboxRouteLoading />);

    expect(
      screen.getByRole("link", { name: "Import testimonials" }),
    ).toHaveAttribute("href", "/org/atrakt/import");
    expect(
      screen.getByRole("link", { name: /Open Public Wall/ }),
    ).toHaveAttribute("href", "/w/atrakt");
    expect(screen.getByRole("tab", { name: /Archived/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("opens Studio templates before its data resolves", () => {
    renderInProject(<StudioRouteLoading />);

    const create = screen.getByRole("button", { name: "Create widget" });
    expect(create).toBeEnabled();
    fireEvent.click(create);
    expect(
      screen.getByRole("heading", { name: "Choose a template" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Horizontal carousel/ }),
    ).toBeDisabled();
  });
});
