import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrandDashboardView } from "./organization-dashboard";

const base = {
  collectionUrl: "getsomeproof.com/c/acme-studio",
  name: "Acme Studio",
  publicSlug: "acme-studio",
  slug: "acme-studio-ab12",
};

describe("BrandDashboardView", () => {
  it("shows the plan and Account-wide usage separately from Project proof", () => {
    render(
      <BrandDashboardView
        copyCollectionUrl={async () => {}}
        collectionUrl="https://getsomeproof.com/c/harbor"
        slug="harbor"
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
  afterEach(cleanup);

  it("leads with the Collection Form and says the queue is empty", async () => {
    const copyCollectionUrl = vi.fn().mockResolvedValue(undefined);

    render(
      <BrandDashboardView
        {...base}
        copyCollectionUrl={copyCollectionUrl}
        pendingCount={0}
      />,
    );

    expect(screen.getByRole("heading", { name: "Acme Studio" })).toBeVisible();
    expect(screen.getByText(/Nothing waiting for review/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Inbox" })).toHaveAttribute(
      "href",
      "/org/acme-studio-ab12/inbox",
    );
    // An empty queue is a sentence, not a figure dressed up as news.
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByRole("link", { name: /Review/ })).toBeNull();
    expect(screen.getByText("getsomeproof.com/c/acme-studio")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open Collection Form" }),
    ).toHaveAttribute("href", "/c/acme-studio");

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(copyCollectionUrl).toHaveBeenCalledOnce();
    expect(
      await screen.findByTestId("success-toast-message"),
    ).toHaveTextContent("Collection link copied.");
  });

  it("puts waiting Submissions first and links them to the Inbox", () => {
    render(
      <BrandDashboardView
        {...base}
        copyCollectionUrl={vi.fn()}
        pendingCount={3}
      />,
    );

    const queue = screen.getByRole("link", { name: /waiting for review/ });
    expect(queue).toHaveAttribute("href", "/org/acme-studio-ab12/inbox");
    expect(queue).toHaveTextContent("3");
    expect(screen.queryByText(/Nothing waiting for review/)).toBeNull();

    // The queue comes before the Collection Form once there is work in it.
    const sections = screen.getByRole("region", { name: "Brand overview" });
    expect(sections.firstElementChild).toBe(queue);
  });

  it("counts one Submission in the singular", () => {
    render(
      <BrandDashboardView
        {...base}
        copyCollectionUrl={vi.fn()}
        pendingCount={1}
      />,
    );

    expect(screen.getByText("Testimonial waiting for review")).toBeVisible();
  });
});
