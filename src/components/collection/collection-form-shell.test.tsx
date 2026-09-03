import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { CollectionFormShellView } from "./collection-form-shell";

describe("CollectionFormShellView", () => {
  beforeEach(cleanup);

  it("renders the configured public Brand identity without private workspace data", () => {
    render(
      <CollectionFormShellView
        brand={{
          collectionFormDescription: "Tell us what changed.",
          collectionFormTitle: "Share your Acme story",
          logoUrl: null,
          name: "Acme Studio",
          primaryColor: "#123abc",
          privacyContact: "privacy@acme.example",
          publicSlug: "acme-studio",
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Share your Acme story" }),
    ).toBeVisible();
    expect(screen.getByText("Tell us what changed.")).toBeVisible();
    expect(screen.getByText("Acme Studio")).toBeVisible();
    expect(screen.getByText(/privacy@acme\.example/)).toBeVisible();
    expect(screen.queryByText(/organization/i)).toBeNull();
  });
});
