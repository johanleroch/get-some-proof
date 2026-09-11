import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InboxImportActions } from "./testimonial-inbox";

describe("InboxImportActions", () => {
  it("keeps the standard import actions without offering assistant import", () => {
    render(
      <InboxImportActions
        slug="fernhill-studio"
        publicSlug="fernhill-studio"
      />,
    );

    expect(
      screen.queryByRole("link", { name: /Import with an assistant/ }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Import testimonials" }),
    ).toHaveAttribute("href", "/org/fernhill-studio/import");
    expect(
      screen.getByRole("link", { name: "Open Public Wall" }),
    ).toHaveAttribute("href", "/w/fernhill-studio");
  });
});
