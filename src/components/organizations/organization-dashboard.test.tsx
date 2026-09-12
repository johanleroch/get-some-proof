import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrandDashboardView } from "./organization-dashboard";

const toasts = vi.hoisted(() => ({ success: vi.fn() }));

vi.mock("@/components/brand/blob-toast", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/brand/blob-toast")>();
  return {
    ...actual,
    blobToast: { ...actual.blobToast, success: toasts.success },
  };
});

/** An address is set in pieces so it wraps after slashes; read the whole line. */
const address = (text: string) =>
  screen.getByText(
    (_, element) => element?.tagName === "P" && element.textContent === text,
  );

const base = {
  collectionUrl: "getsomeproof.com/c/acme-studio",
  name: "Acme Studio",
  publicSlug: "acme-studio",
  slug: "acme-studio-ab12",
};

describe("BrandDashboardView", () => {
  afterEach(cleanup);

  it("shows the plan and Account-wide usage beside the Project's proof", () => {
    render(
      <BrandDashboardView
        copyCollectionUrl={async () => {}}
        collectionUrl="https://getsomeproof.com/c/bumpr"
        slug="bumpr"
        name="Bumpr"
        publicSlug="bumpr"
        pendingCount={0}
        billingHref="/org/bumpr/billing"
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
    expect(
      screen.getByText("Unlimited Projects, usage shared across them"),
    ).toBeVisible();
    expect(screen.getByLabelText("Videos stored")).toHaveAttribute(
      "aria-valuenow",
      "7",
    );
    expect(screen.getByText("7 / 25")).toBeVisible();
    expect(screen.getByText("2 video slots reserved")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Manage subscription" }),
    ).toHaveAttribute("href", "/org/bumpr/billing");
    // A Pro Account is offered a door, never a sale.
    expect(screen.queryByRole("link", { name: "Upgrade to Pro" })).toBeNull();
  });

  it("sells Pro to a Free Account and shows its credits as meters", () => {
    render(
      <BrandDashboardView
        {...base}
        copyCollectionUrl={vi.fn()}
        pendingCount={0}
        billingHref="/account/billing"
        account={{
          effectivePlan: "free",
          usage: {
            freeTextUsed: 4,
            freeVideoUsed: 1,
            readyVideos: 0,
            reservedVideos: 0,
          },
        }}
      />,
    );
    expect(screen.getByText("Free plan")).toBeVisible();
    expect(screen.getByLabelText("Text credits")).toHaveAttribute(
      "aria-valuenow",
      "4",
    );
    expect(screen.getByLabelText("Video credits")).toHaveAttribute(
      "aria-valuemax",
      "2",
    );
    expect(
      screen.getByRole("link", { name: "Upgrade to Pro" }),
    ).toHaveAttribute("href", "/account/billing");
    expect(screen.queryByText(/reserved/)).toBeNull();
  });

  it("keeps the plan column out of a view with no Account to show", () => {
    render(
      <BrandDashboardView
        {...base}
        copyCollectionUrl={vi.fn()}
        pendingCount={0}
      />,
    );
    expect(
      screen.queryByRole("region", { name: "Account plan and usage" }),
    ).toBeNull();
  });

  it("keeps a neutral header and leads with the Collection Form", async () => {
    const copyCollectionUrl = vi.fn().mockResolvedValue(undefined);

    render(
      <BrandDashboardView
        {...base}
        copyCollectionUrl={copyCollectionUrl}
        pendingCount={0}
      />,
    );

    expect(screen.getByRole("heading", { name: "Acme Studio" })).toBeVisible();
    expect(screen.getByRole("banner")).toHaveTextContent(
      "Share your Collection Form, read what comes in, publish what you choose.",
    );
    // An empty queue is a sentence, not a figure dressed up as news.
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByRole("link", { name: /Review/ })).toBeNull();
    expect(address("getsomeproof.com/c/acme-studio")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open Collection Form" }),
    ).toHaveAttribute("href", "/c/acme-studio");

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(copyCollectionUrl).toHaveBeenCalledOnce();
    expect(
      await screen.findByTestId("success-toast-message"),
    ).toHaveTextContent("Collection link copied.");
  });

  it("keeps the real header and relative links above address placeholders", () => {
    render(
      <BrandDashboardView
        {...base}
        accountLoading
        collectionUrl={undefined}
        copyCollectionUrl={vi.fn()}
        pendingCount={undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: "Acme Studio" })).toBeVisible();
    expect(screen.getByRole("banner")).toHaveTextContent(
      "Share your Collection Form, read what comes in, publish what you choose.",
    );
    expect(screen.getByRole("button", { name: "Copy link" })).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Open Collection Form" }),
    ).toHaveAttribute("href", "/c/acme-studio");
    expect(screen.getByRole("link", { name: "Open Wall" })).toHaveAttribute(
      "href",
      "/w/acme-studio",
    );
    expect(
      screen.getByRole("button", { name: "Embed on your site" }),
    ).toHaveAttribute("aria-haspopup", "dialog");
    expect(
      screen.getByRole("status", { name: "Loading Account plan and usage" }),
    ).toBeVisible();
    expect(
      document.querySelectorAll('[data-slot="skeleton"]'),
    ).not.toHaveLength(0);
  });

  it("opens the Public Wall and the embed from the overview", () => {
    render(
      <BrandDashboardView
        {...base}
        copyCollectionUrl={vi.fn()}
        pendingCount={0}
      />,
    );

    expect(address("getsomeproof.com/w/acme-studio")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open Wall" })).toHaveAttribute(
      "href",
      "/w/acme-studio",
    );
    expect(
      screen.getByRole("button", { name: "Embed on your site" }),
    ).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(screen.getByRole("button", { name: "Embed on your site" }));
    expect(
      screen.getByRole("dialog", { name: "Embed on your site" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Embed snippet")).toHaveValue(
      '<div data-gsp-wall data-public-slug="acme-studio" data-theme="system"></div>\n<script async src="https://getsomeproof.com/embed/v1.js" data-api-origin="https://getsomeproof.com"></script>',
    );
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
    // The queue block says it, so the title's sentence does not say it twice.
    expect(screen.getByRole("banner")).toHaveTextContent(
      "Share your Collection Form, read what comes in, publish what you choose.",
    );

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

  it("greets the Brand that was just created, once", () => {
    toasts.success.mockClear();
    sessionStorage.setItem("get-some-proof-just-created", "Brand");
    const { rerender } = render(
      <BrandDashboardView
        {...base}
        copyCollectionUrl={async () => {}}
        justCreated="Brand"
        pendingCount={0}
      />,
    );
    expect(toasts.success).toHaveBeenCalledWith("Your Brand is ready.", {
      description: "Share your Collection Form to start collecting.",
      id: "just-created",
    });
    expect(sessionStorage.getItem("get-some-proof-just-created")).toBeNull();
    rerender(
      <BrandDashboardView
        {...base}
        copyCollectionUrl={async () => {}}
        justCreated={null}
        pendingCount={0}
      />,
    );
    expect(toasts.success).toHaveBeenCalledTimes(1);
  });

  it("keeps quiet on an ordinary visit", () => {
    toasts.success.mockClear();
    render(
      <BrandDashboardView
        {...base}
        copyCollectionUrl={async () => {}}
        pendingCount={0}
      />,
    );
    expect(toasts.success).not.toHaveBeenCalled();
  });
});
