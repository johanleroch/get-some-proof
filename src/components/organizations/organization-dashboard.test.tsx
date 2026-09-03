import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BrandDashboardView } from "./organization-dashboard";

describe("BrandDashboardView", () => {
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
    expect(await screen.findByText("Copied")).toBeVisible();
  });
});
