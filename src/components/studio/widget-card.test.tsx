import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { initialWidgetConfig } from "./catalog";
import type { StudioWidget } from "./studio-view";
import { WidgetCard } from "./widget-card";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function widget(overrides: Partial<StudioWidget> = {}): StudioWidget {
  return {
    _id: "widget-1",
    draft: { config: initialWidgetConfig, testimonialIds: ["maya", "james"] },
    name: "Homepage proof",
    publicId: "12345678-1234-4234-8234-123456789abc",
    revision: 0,
    ...overrides,
  };
}

function renderCard(value: StudioWidget) {
  return render(
    <WidgetCard
      attributionRequired={false}
      brandName="Cedar Workshop"
      index={0}
      onDelete={vi.fn()}
      onOpen={vi.fn()}
      origin="https://getsomeproof.com"
      widget={value}
    />,
  );
}

describe("WidgetCard publication state", () => {
  afterEach(cleanup);

  it("calls a widget that was never published a Draft", () => {
    renderCard(widget({ updatedAt: Date.now() - 4 * HOUR }));
    expect(screen.getByText("Draft")).toBeVisible();
  });

  it("calls a published widget Published and dates the publication", () => {
    const published = Date.now() - 21 * DAY;
    renderCard(
      widget({
        published: { config: initialWidgetConfig, testimonialIds: ["maya"] },
        publishedAt: published,
        updatedAt: published,
      }),
    );
    expect(screen.getByText("Published")).toBeVisible();
    expect(screen.getByText(/Published 3 weeks ago/)).toBeVisible();
  });

  it("says Unpublished changes when the draft is newer than what is live", () => {
    renderCard(
      widget({
        published: { config: initialWidgetConfig, testimonialIds: ["maya"] },
        publishedAt: Date.now() - 6 * DAY,
        updatedAt: Date.now() - 3 * HOUR,
      }),
    );
    expect(screen.getByText("Unpublished changes")).toBeVisible();
    expect(screen.getByText(/Edited 3 hours ago/)).toBeVisible();
  });

  it("counts one testimonial in the singular", () => {
    renderCard(
      widget({ draft: { config: initialWidgetConfig, testimonialIds: ["a"] } }),
    );
    expect(screen.getByText(/1 testimonial ·|1 testimonial$/)).toBeVisible();
  });

  it("shows the layout sketch, not the runtime, while the widget is empty", () => {
    const { container } = renderCard(
      widget({
        cardTestimonials: [],
        draft: { config: initialWidgetConfig, testimonialIds: [] },
      }),
    );
    expect(container.querySelector("[data-widget-preview]")).toBeNull();
  });
});
