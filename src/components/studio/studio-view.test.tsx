import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StudioView, type StudioViewProps } from "./studio-view";

const base: StudioViewProps = {
  active: null,
  accentColor: "#ffbb16",
  attributionRequired: false,
  brandName: "Cedar Workshop",
  candidates: [],
  hasMore: false,
  inboxHref: "/org/cedar/inbox",
  loadingMore: false,
  onCreate: vi.fn(),
  onLoadMore: vi.fn(),
  onOpen: vi.fn(),
  onRemove: vi.fn(),
  onSave: vi.fn(),
  onUnpublish: vi.fn(),
  origin: "https://getsomeproof.com",
  widgets: [],
};

describe("StudioView loading shells", () => {
  afterEach(cleanup);

  it("keeps the real Studio header and an interactive template entry point", () => {
    render(<StudioView {...base} loading />);

    expect(screen.getByRole("heading", { name: "Studio" })).toBeVisible();
    expect(
      screen.getByText("Your best proof, ready for every page."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Create widget" })).toBeEnabled();
    expect(
      screen.getByRole("status", { name: "Loading widgets" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Create widget" }));
    expect(
      screen.getByRole("heading", { name: "Choose a template" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Horizontal carousel/ }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /Avatar stack/ })).toBeDisabled();
  });

  it("uses an editor-shaped skeleton while a widget opens", () => {
    render(<StudioView {...base} loadingActive />);

    expect(
      screen.getByRole("status", { name: "Opening widget" }),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Studio" })).toBeNull();
  });
});
