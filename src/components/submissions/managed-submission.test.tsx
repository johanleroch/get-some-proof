import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ManagedSubmissionView } from "./managed-submission";

describe("ManagedSubmissionView", () => {
  afterEach(cleanup);

  it("renders the one Submission represented by the private link", () => {
    render(
      <ManagedSubmissionView
        submission={{
          avatarUrl: null,
          brandName: "Acme Studio",
          company: "North Star Co",
          consentAcceptedAt: Date.UTC(2026, 8, 3),
          contentVersion: 1,
          moderationStatus: "pending",
          privacyContact: "privacy@acme.example",
          publicSlug: "acme-proof",
          role: "Founder",
          submissionType: "text",
          submitterEmail: "alice@example.com",
          submitterName: "Alice Martin",
          text: "This is the testimonial attached to the private link.",
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Manage your testimonial" }),
    ).toBeVisible();
    expect(screen.getByText(/attached to the private link/i)).toBeVisible();
    expect(screen.getByDisplayValue(/alice@example.com/i)).toBeDisabled();
    expect(screen.getByText(/pending/i)).toBeVisible();
  });
});
