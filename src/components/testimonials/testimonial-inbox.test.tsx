import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  TestimonialDeleteDialog,
  TestimonialInboxView,
} from "./testimonial-inbox";

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
  beforeEach(cleanup);
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

  it("identifies the exact Testimonial and keeps download separate from deletion", () => {
    const onDelete = vi.fn();
    const onDownload = vi.fn();
    const video = {
      ...testimonial,
      captionsStatus: "ready" as const,
      canDownload: true,
      submissionType: "video" as const,
      videoStatus: "ready" as const,
    };
    render(
      <TestimonialDeleteDialog
        onDelete={onDelete}
        onDownload={onDownload}
        onOpenChange={vi.fn()}
        pending={false}
        target={video}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Permanently delete Camille Test's Testimonial?",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/Video Testimonial submitted .*testimonial-/),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Download MP4 first" }));
    expect(onDownload).toHaveBeenCalledWith(video);
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("does not offer an unauthorized MP4 download before deletion", () => {
    render(
      <TestimonialDeleteDialog
        onDelete={vi.fn()}
        onDownload={vi.fn()}
        onOpenChange={vi.fn()}
        pending={false}
        target={{
          ...testimonial,
          captionsStatus: "ready" as const,
          canDownload: false,
          submissionType: "video" as const,
          videoStatus: "ready" as const,
        }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Download MP4 first" }),
    ).toBeNull();
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
        onArchive={vi.fn()}
        onDeleteRequest={vi.fn()}
        onPublish={vi.fn()}
        onUndoSpam={onUndoSpam}
        testimonials={[spam]}
      />,
    );

    expect(screen.getByText(/Collection capacity was restored/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Undo Spam" }));
    expect(onUndoSpam).toHaveBeenCalledWith(spam);
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Delete permanently" }),
    ).toBeNull();
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

  it("shows video readiness and blocks publication until Ready", () => {
    const onPublish = vi.fn();
    const onDownload = vi.fn();
    const video = {
      avatarUrl: null,
      captionsStatus: "requested" as const,
      consentAcceptedAt: 1,
      createdAt: 2,
      moderationStatus: "pending" as const,
      canDownload: true,
      submissionType: "video" as const,
      submitterEmail: "camille@example.invalid",
      submitterName: "Camille Test",
      testimonialId: "testimonial-video",
      videoStatus: "processing" as const,
    };
    const { rerender } = render(
      <TestimonialInboxView
        onArchive={vi.fn()}
        onDeleteRequest={vi.fn()}
        onDownload={onDownload}
        onPublish={onPublish}
        testimonials={[video]}
      />,
    );

    expect(screen.getByText("Processing")).toBeVisible();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();

    rerender(
      <TestimonialInboxView
        onArchive={vi.fn()}
        onDeleteRequest={vi.fn()}
        onDownload={onDownload}
        onPublish={onPublish}
        testimonials={[
          {
            ...video,
            captionsStatus: "failed",
            durationSeconds: 42,
            playbackId: "owner-playback-id",
            videoStatus: "ready",
          },
        ]}
      />,
    );
    expect(screen.getByText("Ready")).toBeVisible();
    expect(screen.getByText("Captions unavailable")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Download MP4 (Pro)" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(onDownload).toHaveBeenCalledOnce();
    expect(onPublish).toHaveBeenCalledOnce();
  });

  it("plays a Ready video in a dialog only after Owner intent", async () => {
    render(
      <TestimonialInboxView
        onArchive={vi.fn()}
        onDeleteRequest={vi.fn()}
        onPublish={vi.fn()}
        testimonials={[
          {
            ...testimonial,
            canDownload: false,
            captionsStatus: "ready",
            durationSeconds: 42,
            playbackId: "owner-playback-id",
            submissionType: "video",
            videoStatus: "ready",
          },
        ]}
      />,
    );

    expect(screen.queryByTestId("inbox-video-player")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Play Camille Test's video testimonial",
      }),
    );

    expect(
      await screen.findByRole("dialog", {
        name: "Camille Test's video testimonial",
      }),
    ).toBeVisible();
    expect(screen.getByTestId("inbox-video-player")).toHaveAttribute(
      "data-playback-id",
      "owner-playback-id",
    );
    expect(screen.getByText("Captions ready · 42 seconds")).toBeVisible();
  });
});
