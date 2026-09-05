import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "@convex/_generated/dataModel";
import {
  InboxFeedback,
  TestimonialDeleteDialog,
  TestimonialInboxView,
} from "./testimonial-inbox";

const testimonial = {
  card: {
    avatarUrl: null,
    company: "Example Studio",
    id: "testimonial-1",
    name: "Camille Test",
    publishedAt: 2,
    rating: 5,
    role: "Founder",
    text: "A real customer outcome that is ready for review.",
    type: "text" as const,
  },
  consentAcceptedAt: 1,
  createdAt: 2,
  moderationStatus: "pending" as const,
  submissionType: "text" as const,
  submitterEmail: "camille@example.invalid",
  submitterName: "Camille Test",
  testimonialId: "testimonial-1" as Id<"testimonials">,
};

describe("TestimonialInboxView", () => {
  beforeEach(cleanup);

  it("renders the shared card and exposes private actions only through options", async () => {
    const onAction = vi.fn();
    render(
      <TestimonialInboxView onAction={onAction} testimonials={[testimonial]} />,
    );

    expect(screen.getByText(testimonial.card.text)).toBeVisible();
    expect(screen.queryByText(testimonial.submitterEmail)).toBeNull();
    const options = screen.getByRole("button", {
      name: "Options for Camille Test's Testimonial",
    });
    fireEvent.pointerDown(options, { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Publish" }));
    expect(onAction).toHaveBeenCalledWith(testimonial, "publish");
  });

  it("renders a useful empty state", () => {
    render(<TestimonialInboxView onAction={vi.fn()} testimonials={[]} />);
    expect(
      screen.getByText("No Testimonials match these filters."),
    ).toBeInTheDocument();
  });

  it("asks for a concise permanent-deletion confirmation", () => {
    const onDelete = vi.fn();
    const video = {
      ...testimonial,
      card: {
        avatarUrl: null,
        captionsAvailable: true,
        id: "testimonial-1",
        name: "Camille Test",
        playbackId: "owner-playback-id",
        publishedAt: 2,
        type: "video" as const,
      },
      captionsStatus: "ready" as const,
      submissionType: "video" as const,
      videoStatus: "ready" as const,
    };
    render(
      <TestimonialDeleteDialog
        onDelete={onDelete}
        onOpenChange={vi.fn()}
        pending={false}
        target={video}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Delete Camille Test's testimonial?",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Are you sure you want to delete this testimonial? This action is permanent.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /download/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("shows reversible Spam quarantine without ordinary moderation actions", () => {
    const onUndoSpam = vi.fn();
    const spam = {
      ...testimonial,
      moderationStatus: "spam" as const,
      quarantineExpiresAt: Date.UTC(2026, 8, 10),
      spamCreditRestored: true,
    };
    render(
      <TestimonialInboxView onAction={onUndoSpam} testimonials={[spam]} />,
    );

    fireEvent.pointerDown(
      screen.getByRole("button", {
        name: "Options for Camille Test's Testimonial",
      }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Undo Spam" }));
    expect(onUndoSpam).toHaveBeenCalledWith(spam, "undo-spam");
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Delete permanently" }),
    ).toBeNull();
  });

  it("disables every moderation action while a mutation is pending", () => {
    const { container } = render(
      <TestimonialInboxView
        actionsDisabled
        onAction={vi.fn()}
        testimonials={[testimonial]}
      />,
    );
    const view = within(container);

    expect(
      view.getByRole("button", {
        name: "Options for Camille Test's Testimonial",
      }),
    ).toBeDisabled();
  });

  it("shows video readiness and blocks publication until Ready", () => {
    const onAction = vi.fn();
    const video = {
      avatarUrl: null,
      card: null,
      captionsStatus: "requested" as const,
      consentAcceptedAt: 1,
      createdAt: 2,
      moderationStatus: "pending" as const,
      submissionType: "video" as const,
      submitterEmail: "camille@example.invalid",
      submitterName: "Camille Test",
      testimonialId: "testimonial-video" as Id<"testimonials">,
      videoStatus: "processing" as const,
    };
    const { rerender } = render(
      <TestimonialInboxView onAction={onAction} testimonials={[video]} />,
    );

    expect(screen.getByText("Processing")).toBeVisible();
    fireEvent.pointerDown(
      screen.getByRole("button", {
        name: "Options for Camille Test's Testimonial",
      }),
      { button: 0, ctrlKey: false },
    );
    expect(screen.getByRole("menuitem", { name: "Publish" })).toHaveAttribute(
      "data-disabled",
    );
    expect(
      screen.queryByRole("menuitem", { name: /Download MP4/i }),
    ).toBeNull();

    rerender(
      <TestimonialInboxView
        onAction={onAction}
        testimonials={[
          {
            ...video,
            card: {
              aspectRatio: "4:3",
              avatarUrl: null,
              captionsAvailable: false,
              id: "testimonial-video",
              name: "Camille Test",
              playbackId: "owner-playback-id",
              publishedAt: 2,
              type: "video",
            },
            captionsStatus: "failed",
            videoStatus: "ready",
          },
        ]}
      />,
    );
    expect(document.querySelector(".video-shell")).toHaveAttribute(
      "data-video-aspect-ratio",
      "4:3",
    );
  });

  it("uses the Public Wall video card and loads playback only after Owner intent", async () => {
    render(
      <TestimonialInboxView
        onAction={vi.fn()}
        testimonials={[
          {
            ...testimonial,
            card: {
              aspectRatio: "4:3",
              avatarUrl: null,
              captionsAvailable: true,
              id: "testimonial-1",
              name: "Camille Test",
              playbackId: "owner-playback-id",
              publishedAt: 2,
              type: "video",
            },
            captionsStatus: "ready",
            submissionType: "video",
            videoStatus: "ready",
          },
        ]}
      />,
    );

    expect(screen.queryByTestId("mux-video-player")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Play Camille Test's testimonial",
      }),
    );

    expect(await screen.findByTestId("mux-video-player")).toHaveAttribute(
      "data-playback-id",
      "owner-playback-id",
    );
  });

  it("exposes unpublish and permanent delete after publication", async () => {
    const onAction = vi.fn();
    const published = {
      ...testimonial,
      moderationStatus: "published" as const,
    };
    render(
      <TestimonialInboxView onAction={onAction} testimonials={[published]} />,
    );

    const options = screen.getByRole("button", {
      name: "Options for Camille Test's Testimonial",
    });
    fireEvent.pointerDown(options, { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Unpublish" }));
    fireEvent.pointerDown(options, { button: 0, ctrlKey: false });
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Delete permanently" }),
    );
    expect(onAction).toHaveBeenNthCalledWith(1, published, "unpublish");
    expect(onAction).toHaveBeenNthCalledWith(2, published, "delete");
  });
});

describe("InboxFeedback", () => {
  beforeEach(cleanup);

  it("shows completed inbox actions in a success toast", () => {
    render(
      <InboxFeedback error={null} message="Testimonial permanently deleted." />,
    );

    expect(screen.getByTestId("success-toast-message")).toHaveTextContent(
      "Testimonial permanently deleted.",
    );
  });
});
