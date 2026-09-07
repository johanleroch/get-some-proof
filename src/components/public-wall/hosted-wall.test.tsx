import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HostedWall } from "./hosted-wall";

describe("HostedWall", () => {
  beforeEach(cleanup);

  it("renders a restrained empty state", () => {
    render(
      <HostedWall
        wall={{
          accentColor: "#123abc",
          attributionRequired: true,
          brandName: "Acme Studio",
          publicSlug: "acme-proof",
          theme: "system",
          testimonials: [],
          transparentEmbed: false,
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Acme Studio" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No public testimonials yet.")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute(
      "data-wall-theme",
      "system",
    );
  });

  it("renders published proof in a responsive masonry container", () => {
    const onLoadMore = vi.fn();
    render(
      <HostedWall
        canLoadMore
        onLoadMore={onLoadMore}
        wall={{
          accentColor: "#123abc",
          attributionRequired: true,
          brandName: "Acme Studio",
          publicSlug: "acme-proof",
          theme: "system",
          testimonials: [
            {
              avatarUrl: null,
              id: "projection-1",
              name: "Camille Test",
              publishedAt: 1,
              text: "A clear customer outcome.",
              type: "text",
            },
          ],
          transparentEmbed: false,
        }}
      />,
    );

    const grid = screen.getByTestId("public-wall-grid");
    expect(grid).toHaveClass("columns-1", "sm:columns-2", "lg:columns-3");
    expect(grid.parentElement).toHaveClass("max-w-7xl");
    expect(screen.getByText("A clear customer outcome.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Testimonials made easy" }),
    ).toBeInTheDocument();
    const promotion = screen.getByRole("complementary", {
      name: "Get Some Proof",
    });
    expect(promotion).toHaveAttribute("data-gsp-promotion");
    expect(screen.getByText("Free, forever.", { exact: false })).toBeVisible();
    expect(screen.queryByText("Powered by Get Some Proof")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Sign up for free" }),
    ).toHaveAttribute(
      "href",
      "/sign-up?utm_source=public_wall&utm_medium=referral&utm_campaign=powered_by",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Load more testimonials" }),
    );
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it("automatically hides the promotion on Pro", () => {
    render(
      <HostedWall
        wall={{
          accentColor: "#123abc",
          attributionRequired: false,
          brandName: "Acme Studio",
          publicSlug: "acme-proof",
          theme: "system",
          testimonials: [
            {
              avatarUrl: null,
              id: "projection-1",
              name: "Camille Test",
              publishedAt: 1,
              text: "A clear customer outcome.",
              type: "text",
            },
          ],
          transparentEmbed: false,
        }}
      />,
    );

    expect(screen.queryByText("Testimonials made easy")).toBeNull();
    expect(screen.queryByRole("link", { name: "Sign up for free" })).toBeNull();
  });
});
