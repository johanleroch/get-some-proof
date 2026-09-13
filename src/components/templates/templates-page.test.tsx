import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { templateBySlug } from "@/lib/templates-catalog";

import { TemplatePreviewPage } from "./template-preview-page";
import { TemplatesPage } from "./templates-page";

vi.mock("@/components/testimonials/testimonial-card", () => ({
  TestimonialCard: ({ testimonial }: { testimonial: { name: string } }) => (
    <article className="card">Card for {testimonial.name}</article>
  ),
}));

beforeEach(() => {
  window.history.replaceState(null, "", "/templates");
});

afterEach(cleanup);

describe("TemplatesPage", () => {
  it("leads with the hero, the template browser and one closing action", () => {
    render(<TemplatesPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Proof, laid out your way",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Start for free" }),
    ).toHaveAttribute("href", "/sign-up");
    expect(
      screen.getByRole("navigation", { name: "Templates" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Masonry wall" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create your Brand" }),
    ).toHaveAttribute("href", "/sign-up");
    expect(screen.getByRole("navigation", { name: "Footer" })).toBeVisible();
  });
});

describe("TemplatePreviewPage", () => {
  it("renders one template with the chosen accent and theme", () => {
    const template = templateBySlug("hero-quote")!;
    render(
      <TemplatePreviewPage
        accentColor="#274690"
        template={template}
        theme="dark"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Hero quote" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All templates" })).toHaveAttribute(
      "href",
      "/templates",
    );
    expect(
      screen.getByRole("link", { name: "Start for free" }),
    ).toHaveAttribute("href", "/sign-up");
    const stage = document.querySelector<HTMLElement>("[data-template-stage]");
    expect(stage?.dataset.wallTheme).toBe("dark");
    expect(stage?.style.getPropertyValue("--wall-accent")).toBe("#274690");
  });
});
