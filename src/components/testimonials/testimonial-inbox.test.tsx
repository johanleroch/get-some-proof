import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TestimonialInboxView } from "./testimonial-inbox";

const testimonial = {
  avatarUrl: null,
  company: "Example Studio",
  consentAcceptedAt: 1,
  createdAt: 2,
  moderationStatus: "pending" as const,
  rating: 5,
  role: "Founder",
  submissionType: "text" as const,
  submitterEmail: "camille@example.invalid",
  submitterName: "Camille Test",
  testimonialId: "testimonial-1",
  text: "A real customer outcome that is ready for review.",
};

describe("TestimonialInboxView", () => {
  it("previews private data and exposes publish, archive, and permanent delete", () => {
    const onPublish = vi.fn();
    const onArchive = vi.fn();
    const onDeleteRequest = vi.fn();
    render(
      <TestimonialInboxView
        onArchive={onArchive}
        onDeleteRequest={onDeleteRequest}
        onPublish={onPublish}
        testimonials={[testimonial]}
      />,
    );

    expect(screen.getByText("camille@example.invalid")).toBeInTheDocument();
    expect(screen.getByText("Consent recorded")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    expect(onPublish).toHaveBeenCalledWith(testimonial);
    expect(onArchive).toHaveBeenCalledWith(testimonial);
    expect(onDeleteRequest).toHaveBeenCalledWith(testimonial);
  });

  it("renders a useful empty state", () => {
    render(
      <TestimonialInboxView
        onArchive={vi.fn()}
        onDeleteRequest={vi.fn()}
        onPublish={vi.fn()}
        testimonials={[]}
      />,
    );
    expect(
      screen.getByText("No Testimonials match these filters."),
    ).toBeInTheDocument();
  });

  it("disables every moderation action while a mutation is pending", () => {
    const { container } = render(
      <TestimonialInboxView
        actionsDisabled
        onArchive={vi.fn()}
        onDeleteRequest={vi.fn()}
        onPublish={vi.fn()}
        testimonials={[testimonial]}
      />,
    );
    const view = within(container);

    expect(view.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(view.getByRole("button", { name: "Archive" })).toBeDisabled();
    expect(
      view.getByRole("button", { name: "Delete permanently" }),
    ).toBeDisabled();
  });
});
