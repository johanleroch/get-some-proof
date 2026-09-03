import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    expect(
      screen.getByRole("link", { name: "privacy notice" }),
    ).toHaveAttribute("href", "/c/acme-studio/privacy");
    expect(screen.queryByText(/organization/i)).toBeNull();
  });

  it("completes the responsive four-stage text Submission journey", async () => {
    const submitText = vi.fn().mockResolvedValue({
      moderationStatus: "pending",
      testimonialId: "testimonial-1",
    });
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
        submitText={submitText}
      />,
    );

    expect(screen.getByText("Step 1 of 4")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Send a text testimonial" }),
    );
    expect(screen.getByText("Step 2 of 4")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Your testimonial"), {
      target: { value: "Acme helped us turn customer proof into new work." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Step 3 of 4")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Alice Martin" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Role"), {
      target: { value: "Founder" },
    });
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: "North Star Co" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "5 stars" }));
    expect(screen.getByText(/authorize Acme Studio to publish/i)).toBeVisible();
    fireEvent.click(screen.getByLabelText(/at least 18 years old/i));
    fireEvent.click(screen.getByLabelText(/I give Publication Consent/i));
    fireEvent.click(screen.getByRole("button", { name: "Submit testimonial" }));

    await waitFor(() => expect(submitText).toHaveBeenCalledTimes(1));
    expect(submitText).toHaveBeenCalledWith(
      expect.objectContaining({
        ageConfirmed: true,
        company: "North Star Co",
        consentAccepted: true,
        consentText: expect.stringContaining(
          "I authorize Acme Studio to publish",
        ),
        consentVersion: "2026-09-03.v1",
        publicSlug: "acme-studio",
        rating: 5,
        role: "Founder",
        submitterEmail: "alice@example.com",
        submitterName: "Alice Martin",
        text: "Acme helped us turn customer proof into new work.",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Thank you for your proof" }),
    ).toBeVisible();
    expect(screen.getByText("Step 4 of 4")).toBeVisible();
    expect(screen.getByText(/management link/i)).toBeVisible();
  });

  it("keeps work in the browser and submits nothing before final confirmation", () => {
    const submitText = vi.fn();
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
        submitText={submitText}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Send a text testimonial" }),
    );
    fireEvent.change(screen.getByLabelText("Your testimonial"), {
      target: { value: "This text is long enough but has not been confirmed." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(submitText).not.toHaveBeenCalled();
  });
});
