import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { KitPage } from "./kit-page";

vi.mock("@/components/testimonials/testimonial-card", () => ({
  TestimonialCard: ({ testimonial }: { testimonial: { name: string } }) => (
    <div>Testimonial card for {testimonial.name}</div>
  ),
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div>Theme control</div>,
}));

// Forty brand marks with their full outlines are their own review surface, and
// their grid is held by scripts/source-icons/grid.test.mjs.
vi.mock("@/components/kit/source-icons-showcase", () => ({
  SourceIconsShowcase: () => <div>Source icon review</div>,
}));

describe("KitPage", () => {
  it("lists every token group, type style and component section", () => {
    render(
      <TooltipProvider>
        <KitPage />
      </TooltipProvider>,
    );

    expect(screen.getByRole("heading", { name: "Kit" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Colors" })).toBeInTheDocument();
    expect(screen.getAllByText("--brand-text").length).toBeGreaterThan(0);
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Typography" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy CSS" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Testimonial card for Alice Martin"),
    ).toBeInTheDocument();
    expect(screen.getByText("Source icon review")).toBeInTheDocument();
    expect(screen.getAllByRole("slider").length).toBeGreaterThan(30);
  });
});
