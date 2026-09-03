import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ManagedSubmissionView } from "./managed-submission";

describe("ManagedSubmissionView", () => {
  afterEach(cleanup);

  it("renders the one Submission represented by the private link", () => {
    render(
      <ManagedSubmissionView
        submission={{
          brandName: "Acme Studio",
          company: "North Star Co",
          moderationStatus: "pending",
          role: "Founder",
          submitterEmail: "alice@example.com",
          submitterName: "Alice Martin",
          text: "This is the testimonial attached to the private link.",
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Your testimonial" }),
    ).toBeVisible();
    expect(screen.getByText(/attached to the private link/i)).toBeVisible();
    expect(screen.getByText(/alice@example.com/i)).toBeVisible();
    expect(screen.getByText(/pending/i)).toBeVisible();
  });
});
