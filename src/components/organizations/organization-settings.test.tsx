import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationSettingsView } from "./organization-settings";

const baseProps = {
  canChangePublicSlug: true,
  canUpdate: true,
  embedOrigin: "https://proof.example",
  logoUrl: null,
  name: "Acme Studio",
  onChangePublicSlug: vi.fn().mockResolvedValue(undefined),
  onRemoveLogo: vi.fn().mockResolvedValue(undefined),
  onRename: vi.fn().mockResolvedValue(undefined),
  onUploadLogo: vi.fn().mockResolvedValue(undefined),
  publicSlug: "acme-studio",
  publicSlugCanChange: true,
};

describe("OrganizationSettingsView", () => {
  beforeEach(() => {
    cleanup();
    baseProps.onChangePublicSlug.mockClear();
  });

  it("lets the Owner spend the one Public Slug change", async () => {
    render(<OrganizationSettingsView {...baseProps} />);

    fireEvent.change(screen.getByLabelText("Public slug"), {
      target: { value: "acme-stories" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Change public slug permanently" }),
    );

    await waitFor(() => {
      expect(baseProps.onChangePublicSlug).toHaveBeenCalledWith("acme-stories");
    });
    expect(screen.getByText("Public slug changed permanently.")).toBeVisible();
  });

  it("makes the Public Slug read-only after the change was used", () => {
    render(
      <OrganizationSettingsView
        {...baseProps}
        publicSlug="acme-stories"
        publicSlugCanChange={false}
      />,
    );

    expect(screen.getByLabelText("Public slug")).toBeDisabled();
    expect(
      screen.getByText("Your one Public Slug change has been used."),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Change public slug permanently" }),
    ).toBeNull();
  });

  it("shows the canonical slug returned by the reactive Brand query", () => {
    const view = render(<OrganizationSettingsView {...baseProps} />);

    fireEvent.change(screen.getByLabelText("Public slug"), {
      target: { value: "Acme Stories!" },
    });
    view.rerender(
      <OrganizationSettingsView
        {...baseProps}
        publicSlug="acme-stories"
        publicSlugCanChange={false}
      />,
    );

    expect(screen.getByLabelText("Public slug")).toHaveValue("acme-stories");
  });

  it("does not offer the Owner-only slug action to an Admin", () => {
    render(
      <OrganizationSettingsView {...baseProps} canChangePublicSlug={false} />,
    );

    expect(screen.queryByLabelText("Public slug")).toBeNull();
  });

  it("provides the Owner a copyable versioned Embedded Wall snippet", () => {
    render(<OrganizationSettingsView {...baseProps} />);

    expect(screen.getByLabelText("Embed snippet")).toHaveValue(
      '<div data-gsp-wall data-public-slug="acme-studio" data-theme="system"></div>\n<script async src="https://proof.example/embed/v1.js" data-api-origin="https://proof.example"></script>',
    );
    expect(
      screen.getByRole("button", { name: "Copy embed snippet" }),
    ).toBeEnabled();
  });

  it("copies the exact Embedded Wall snippet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<OrganizationSettingsView {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy embed snippet" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        '<div data-gsp-wall data-public-slug="acme-studio" data-theme="system"></div>\n<script async src="https://proof.example/embed/v1.js" data-api-origin="https://proof.example"></script>',
      );
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Embed snippet copied.",
    );
  });
});
