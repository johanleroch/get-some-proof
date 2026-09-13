import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { sourceIcons } from "@/components/testimonials/source-icons";

import { SourceIconsShowcase } from "./source-icons-showcase";

describe("SourceIconsShowcase", () => {
  it("shows every platform the wall can stamp, each drawn through its fit", () => {
    const { container } = render(<SourceIconsShowcase />);

    for (const { label } of Object.values(sourceIcons)) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    const placed = container.querySelectorAll("svg > g[transform]");
    expect(placed.length).toBeGreaterThanOrEqual(
      Object.keys(sourceIcons).length,
    );
  }, 20000);
});
