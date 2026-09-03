import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HostedWall } from "./hosted-wall";

describe("HostedWall", () => {
  it("renders a restrained empty state", () => {
    render(
      <HostedWall
        wall={{
          accentColor: "#123abc",
          attributionRequired: true,
          brandName: "Acme Studio",
          publicSlug: "acme-proof",
          testimonials: [],
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Acme Studio" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No public testimonials yet.")).toBeInTheDocument();
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
        }}
      />,
    );

    expect(screen.getByTestId("public-wall-grid")).toHaveClass(
      "columns-1",
      "md:columns-2",
      "xl:columns-3",
    );
    expect(screen.getByText("A clear customer outcome.")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Load more testimonials" }),
    );
    expect(onLoadMore).toHaveBeenCalledOnce();
  });
});
