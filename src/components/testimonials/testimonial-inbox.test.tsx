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

  it("puts the routine work on the card and keeps the rare acts in the menu", async () => {
    const onAction = vi.fn();
    render(
      <TestimonialInboxView
        category="pending"
        onAction={onAction}
        pendingId={null}
        testimonials={[testimonial]}
      />,
    );

    expect(screen.getByText(testimonial.card.text)).toBeVisible();
    // The card carries its own category, so a mixed screen is impossible.
    expect(screen.getByText("Pending")).toBeVisible();
    // Private facts the Owner needs, never in the shared public markup.
    expect(screen.getByText(testimonial.submitterEmail)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(onAction).toHaveBeenCalledWith(testimonial, "publish");
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onAction).toHaveBeenCalledWith(testimonial, "archive");
    fireEvent.click(screen.getByRole("button", { name: "Highlight a phrase" }));
    expect(onAction).toHaveBeenCalledWith(testimonial, "highlight");

    const options = screen.getByRole("button", {
      name: "More actions for Camille Test's Testimonial",
    });
    fireEvent.pointerDown(options, { button: 0, ctrlKey: false });
    expect(
      await screen.findByRole("menuitem", { name: "Mark as Spam" }),
    ).toBeVisible();
    expect(
      screen.getByRole("menuitem", { name: "Delete permanently" }),
    ).toBeVisible();
    // Publishing left the menu entirely.
    expect(screen.queryByRole("menuitem", { name: "Publish" })).toBeNull();
  });

  it("gives each category its own empty state, and says when a filter caused it", () => {
    const { rerender } = render(
      <TestimonialInboxView
        category="pending"
        onAction={vi.fn()}
        pendingId={null}
        testimonials={[]}
      />,
    );
    expect(screen.getByText("Nothing Pending")).toBeInTheDocument();

    rerender(
      <TestimonialInboxView
        category="published"
        onAction={vi.fn()}
        pendingId={null}
        testimonials={[]}
      />,
    );
    expect(
      screen.getByText("Nothing on your Public Wall yet"),
    ).toBeInTheDocument();

    rerender(
      <TestimonialInboxView
        category="pending"
        filtered
        onAction={vi.fn()}
        pendingId={null}
        testimonials={[]}
      />,
    );
    expect(screen.getByText("Nothing here right now")).toBeInTheDocument();
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
      <TestimonialInboxView
        category="spam"
        onAction={onUndoSpam}
        pendingId={null}
        testimonials={[spam]}
      />,
    );

    // Undoing is one click, on the card, not a filter change away.
    fireEvent.click(screen.getByRole("button", { name: "Not Spam" }));
    expect(onUndoSpam).toHaveBeenCalledWith(spam, "undo-spam");
    // The seven-day clock that ends in Permanent Deletion is finally visible.
    expect(screen.getByText(/Content is deleted on/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Highlight a phrase" }),
    ).toBeNull();
  });

  it("marks the one Testimonial being acted on, not the whole screen", () => {
    const { container } = render(
      <TestimonialInboxView
        actionsDisabled
        category="pending"
        onAction={vi.fn()}
        pendingId={testimonial.testimonialId}
        testimonials={[testimonial]}
      />,
    );
    const view = within(container);

    expect(
      view.getByTestId(`inbox-testimonial-${testimonial.testimonialId}`),
    ).toHaveAttribute("aria-busy", "true");
    expect(
      view.getByRole("button", {
        name: "More actions for Camille Test's Testimonial",
      }),
    ).toBeDisabled();
  });

  it("shows video readiness and blocks publication until Ready", () => {
    const onAction = vi.fn();
    const video = {
      avatarUrl: null,
      aspectRatio: "9:16",
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
      <TestimonialInboxView
        category="pending"
        onAction={onAction}
        pendingId={null}
        testimonials={[video]}
      />,
    );

    expect(screen.getByText("Processing")).toBeVisible();
    expect(
      screen.getByText(
        "This video was just submitted. Playback will be available shortly.",
      ),
    ).toBeVisible();
    const processingCard = screen.getByTestId("processing-video-placeholder");
    expect(processingCard).toHaveAttribute("data-video-aspect-ratio", "9:16");
    expect(processingCard).toHaveStyle({ aspectRatio: "9 / 16" });
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(
      screen.getByText("Only a Ready video can be Published."),
    ).toBeVisible();

    rerender(
      <TestimonialInboxView
        category="pending"
        pendingId={null}
        onAction={onAction}
        testimonials={[
          {
            ...video,
            captionsStatus: "failed",
            videoStatus: "failed",
          },
        ]}
      />,
    );
    expect(screen.getByTestId("failed-video-placeholder")).toBeVisible();
    expect(screen.queryByTestId("processing-video-placeholder")).toBeNull();
    expect(screen.getByText("Captions unavailable")).toBeVisible();

    rerender(
      <TestimonialInboxView
        category="pending"
        pendingId={null}
        onAction={onAction}
        testimonials={[
          {
            ...video,
            captionsStatus: "ready",
            videoStatus: "ready",
          },
        ]}
      />,
    );
    expect(screen.getByTestId("ready-video-placeholder")).toBeVisible();
    expect(screen.getByText("Ready")).toBeVisible();
    expect(screen.queryByTestId("processing-video-placeholder")).toBeNull();
    expect(screen.getByText("Captions ready")).toBeVisible();

    rerender(
      <TestimonialInboxView
        category="pending"
        pendingId={null}
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
        category="pending"
        pendingId={null}
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
      <TestimonialInboxView
        category="published"
        onAction={onAction}
        pendingId={null}
        testimonials={[published]}
      />,
    );

    expect(screen.getByText("Published")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));
    const options = screen.getByRole("button", {
      name: "More actions for Camille Test's Testimonial",
    });
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
