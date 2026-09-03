import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BrandPrivacyNoticeView } from "./brand-privacy-notice";

describe("BrandPrivacyNoticeView", () => {
  afterEach(cleanup);

  it("covers Brand-specific collection, publication, private email, providers, and withdrawal", () => {
    render(
      <BrandPrivacyNoticeView
        brand={{
          name: "Acme Studio",
          privacyContact: "privacy@acme.example",
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Testimonial privacy notice" }),
    ).toBeVisible();
    expect(screen.getByText(/Acme Studio collects/i)).toBeVisible();
    expect(screen.getByText(/email address stays private/i)).toBeVisible();
    expect(screen.getByText(/transactional email providers/i)).toBeVisible();
    expect(screen.getByText(/withdraw your publication/i)).toBeVisible();
    expect(
      screen.getByRole("link", { name: "privacy@acme.example" }),
    ).toHaveAttribute("href", "mailto:privacy@acme.example");
  });
});
