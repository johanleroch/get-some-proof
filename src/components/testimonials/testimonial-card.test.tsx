import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TestimonialCard } from "./testimonial-card";

describe("TestimonialCard", () => {
  it("renders the approved text anatomy without an astro-lp banner", () => {
    render(
      <TestimonialCard
        accentColor="#123abc"
        attributionRequired
        testimonial={{
          avatarUrl: null,
          company: "Example Studio",
          id: "projection-1",
          name: "Camille Test",
          publishedAt: 1,
          rating: 5,
          role: "Founder",
          text: "A specific customer outcome belongs here.",
          type: "text",
        }}
      />,
    );

    expect(screen.getByText("Camille Test")).toBeInTheDocument();
    expect(screen.getByText("Founder · Example Studio")).toBeInTheDocument();
    expect(
      screen.getByText("A specific customer outcome belongs here."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("5 out of 5 stars")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Powered by Get Some Proof" }),
    ).toHaveAttribute("rel", "sponsored nofollow");
    expect(screen.queryByTestId("testimonial-banner")).not.toBeInTheDocument();
  });
});
