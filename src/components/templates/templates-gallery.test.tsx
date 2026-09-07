import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { publicTemplates, templates } from "@/lib/templates-catalog";

import { templateComponents } from "./template-registry";
import { TemplatesGallery } from "./templates-gallery";

vi.mock("@/components/testimonials/testimonial-card", () => ({
  TestimonialCard: ({ testimonial }: { testimonial: { name: string } }) => (
    <article className="card">Card for {testimonial.name}</article>
  ),
}));

function stage() {
  return document.querySelector<HTMLElement>("[data-template-stage]");
}

/** The rail renders twice (chips on phones, list on desktop): take the list. */
function railButton(name: string) {
  return screen.getAllByRole("button", { name: new RegExp(`^${name}`) })[1]!;
}

beforeEach(() => {
  window.history.replaceState(null, "", "/templates");
});

afterEach(cleanup);

describe("template registry", () => {
  it("has a renderer for every catalog entry", () => {
    for (const template of templates) {
      expect(templateComponents[template.slug]).toBeTypeOf("function");
    }
  });
});

describe("TemplatesGallery", () => {
  it("lists every template, drafts included, and shows the first one live in kit mode", () => {
    render(<TemplatesGallery mode="kit" templates={templates} />);

    for (const template of templates) {
      expect(railButton(template.name)).toBeInTheDocument();
    }
    expect(
      screen.getByRole("heading", { level: 2, name: "Masonry wall" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("src/components/templates/masonry-wall.tsx · public"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Card for Alice Martin").length).toBe(1);
    expect(screen.getByRole("img", { name: "Draft" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "See it on the public page" }),
    ).toHaveAttribute("href", "/templates?template=masonry-wall");
    expect(
      screen.getByRole("link", { name: "Open full page" }),
    ).toHaveAttribute(
      "href",
      "/templates/masonry-wall?accent=%230f766e&theme=light",
    );
  });

  it("switches template from the rail and keeps the choice in the URL", () => {
    render(<TemplatesGallery mode="public" templates={publicTemplates} />);

    expect(screen.queryByRole("button", { name: /^Proof strip/ })).toBeNull();
    fireEvent.click(railButton("Rating badge"));

    expect(
      screen.getByRole("heading", { level: 2, name: "Rating badge" }),
    ).toBeInTheDocument();
    expect(window.location.search).toBe("?template=rating-badge");
    expect(screen.getByRole("link", { name: "Open preview" })).toHaveAttribute(
      "href",
      "/templates/rating-badge?accent=%230f766e&theme=light",
    );
    expect(railButton("Rating badge")).toHaveAttribute("aria-current", "true");
  });

  it("opens on the template named in the URL", () => {
    window.history.replaceState(null, "", "/templates?template=hero-quote");
    render(<TemplatesGallery mode="public" templates={publicTemplates} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Hero quote" }),
    ).toBeInTheDocument();
  });

  it("moves with the arrow keys and applies accent, theme and width to the stage", () => {
    render(<TemplatesGallery mode="public" templates={publicTemplates} />);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(
      screen.getByRole("heading", { level: 2, name: "Grid wall" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(
      screen.getByRole("heading", { level: 2, name: "Masonry wall" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open full page" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Proof amber" }));
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(stage()?.dataset.wallTheme).toBe("dark");
    expect(stage()?.style.getPropertyValue("--wall-accent")).toBe("#ffbb16");

    fireEvent.click(screen.getByRole("button", { name: "Phone" }));
    expect(stage()?.style.maxWidth).toBe("390px");
  });
});
