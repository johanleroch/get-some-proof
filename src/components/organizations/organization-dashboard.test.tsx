import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BrandDashboardView } from "./organization-dashboard";

describe("BrandDashboardView", () => {
  it("shows the plan and Account-wide usage separately from Project proof", () => {
    render(
      <BrandDashboardView
        copyCollectionUrl={async () => {}}
        name="Harbor Studio"
        publicSlug="harbor"
        pendingCount={0}
        billingHref="/org/harbor/billing"
        account={{
          effectivePlan: "premium",
          usage: {
            freeTextUsed: 4,
            freeVideoUsed: 1,
            readyVideos: 7,
            reservedVideos: 2,
          },
        }}
      />,
    );
    expect(screen.getByText("Pro plan")).toBeVisible();
    expect(screen.getByText("Shared across all projects")).toBeVisible();
    expect(screen.getByText("7 / 25 videos stored")).toBeVisible();
    expect(screen.getByText("2 video slots reserved")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Manage subscription" }),
    ).toHaveAttribute("href", "/org/harbor/billing");
  });
  beforeEach(cleanup);

  it("shows the Pending shell and exposes a copyable Collection Form URL", async () => {
    const copyCollectionUrl = vi.fn().mockResolvedValue(undefined);

    render(
      <BrandDashboardView
        copyCollectionUrl={copyCollectionUrl}
        name="Acme Studio"
        pendingCount={0}
        publicSlug="acme-studio"
      />,
    );

    expect(screen.getByRole("heading", { name: "Acme Studio" })).toBeVisible();
    expect(screen.getByText("0")).toBeVisible();
    expect(screen.getByText("/c/acme-studio")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open Collection Form" }),
    ).toHaveAttribute("href", "/c/acme-studio");

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(copyCollectionUrl).toHaveBeenCalledOnce();
    expect(
      await screen.findByTestId("success-toast-message"),
    ).toHaveTextContent("Collection link copied.");
  });
});
