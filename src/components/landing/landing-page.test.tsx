import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LandingPage } from "./landing-page";

vi.mock("@/components/testimonials/testimonial-card", () => ({
  TestimonialCard: ({ testimonial }: { testimonial: { name: string } }) => (
    <article className="card">Card for {testimonial.name}</article>
  ),
}));

vi.mock("@/components/studio/widget-preview", () => ({
  WidgetPreview: () => <div data-widget-preview="" />,
}));

afterEach(cleanup);

describe("LandingPage", () => {
  it("leads with published proof and repeats one call to action", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Your happy customers can help win the next ones.",
      }),
    ).toBeInTheDocument();

    const startLinks = screen.getAllByRole("link", { name: "Start for free" });
    expect(startLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of startLinks) {
      expect(link).toHaveAttribute("href", "/sign-up");
    }
    const accountNav = screen.getByRole("navigation", { name: "Account" });
    expect(
      within(accountNav).getByRole("link", { name: "Sign in" }),
    ).toHaveAttribute("href", "/sign-in");
  });

  it("keeps the approved section hierarchy", () => {
    render(<LandingPage />);

    for (const title of [
      "A happy customer. Now what?",
      "Make it easy for customers to share their experience.",
      "Answer their doubts with your customers’ words.",
      "Give customer proof a place on your website.",
      "Stay in control of your testimonials.",
      "Frequently asked questions",
      "Let the people who chose you have their say.",
    ]) {
      expect(
        screen.getByRole("heading", { level: 2, name: title }),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "From request to website in three steps.",
      }),
    ).toBeInTheDocument();
  });

  it("answers the questions a visitor asks before signing up", () => {
    render(<LandingPage />);

    expect(screen.getByText("Do my customers need an account?")).toBeVisible();
    expect(
      screen.getByText(
        "No. They can open your collection link and submit a testimonial without signing up.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Yes. The Free plan includes collection limits and a Get Some Proof promotion card on public displays.",
      ),
    ).toBeVisible();
  });

  it("says where the proof comes from, beside it and in the small print", () => {
    render(<LandingPage />);

    expect(
      screen.getByText(
        "Fernhill Studio and every testimonial on this page are invented.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "The embed a website loads, rendering invented testimonials.",
      ),
    ).toBeVisible();
    expect(screen.getByText("demo wall, nobody real yet")).toBeVisible();
    expect(
      screen.getByText(/demonstration content from a fictional studio/i),
    ).toBeVisible();
  });
});
