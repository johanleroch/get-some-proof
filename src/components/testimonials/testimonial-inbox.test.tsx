import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "@convex/_generated/dataModel";
import {
  TestimonialDeleteDialog,
  TestimonialInbox,
  TestimonialInboxView,
} from "./testimonial-inbox";
import { videoDownloadFeedback } from "./video-download-feedback";

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

const inboxMocks = vi.hoisted(() => ({
  requestDownload: vi.fn(),
}));

vi.mock("convex/react", async () => {
  const { getFunctionName } = await import("convex/server");

  return {
    useAction: (reference: Parameters<typeof getFunctionName>[0]) =>
      getFunctionName(reference) === "videoMedia:requestDownload"
        ? inboxMocks.requestDownload
        : vi.fn(),
    useMutation: () => vi.fn(),
    usePaginatedQuery: () => ({
      loadMore: vi.fn(),
      results: [
        {
          card: {
            avatarUrl: null,
            captionsAvailable: true,
            id: "testimonial-video",
            name: "Camille Test",
            playbackId: "owner-playback-id",
            publishedAt: 2,
            type: "video",
          },
          canDownload: true,
          captionsStatus: "ready",
          consentAcceptedAt: 1,
          createdAt: 2,
          moderationStatus: "pending",
          submissionType: "video",
          submitterEmail: "camille@example.invalid",
          submitterName: "Camille Test",
          testimonialId: "testimonial-video",
          videoStatus: "ready",
        },
      ],
      status: "Exhausted",
    }),
    useQuery: (
      _reference: Parameters<typeof getFunctionName>[0],
      args: unknown,
    ) =>
      typeof args === "object" && args && "slug" in args
        ? {
            id: "organization-1",
            name: "Acme",
            publicSlug: "acme-public",
            slug: "acme",
          }
        : { accentColor: "#6d5dfc" },
  };
});

describe("TestimonialInboxView", () => {
  beforeEach(() => {
    cleanup();
    vi.useRealTimers();
    inboxMocks.requestDownload.mockReset();
  });

  it("starts the MP4 download automatically when Mux finishes processing", async () => {
    vi.useFakeTimers();
    inboxMocks.requestDownload
      .mockResolvedValueOnce({ status: "processing" })
      .mockResolvedValueOnce({
        status: "ready",
        url: "https://stream.mux.com/playback/high.mp4",
      });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(<TestimonialInbox slug="acme" />);
    fireEvent.pointerDown(
      screen.getByRole("button", {
        name: "Options for Camille Test's Testimonial",
      }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Download MP4" }));

    await vi.waitFor(() =>
      expect(inboxMocks.requestDownload).toHaveBeenCalledOnce(),
    );
    await act(async () => undefined);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Preparing your MP4. The download will start automatically.",
    );
    expect(screen.getByRole("status")).toHaveClass("bg-sky-50");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    await vi.waitFor(() =>
      expect(inboxMocks.requestDownload).toHaveBeenCalledTimes(2),
    );
    expect(click).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your MP4 download is ready.",
    );
    click.mockRestore();
    vi.useRealTimers();
  });

  it("uses a retryable message while an MP4 download is processing", () => {
    expect(videoDownloadFeedback("processing")).toBe(
      "Preparing your MP4. The download will start automatically.",
    );
    expect(videoDownloadFeedback("ready")).toBe("Your MP4 download is ready.");
  });

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

  it("identifies the exact Testimonial and keeps download separate from deletion", () => {
    const onDelete = vi.fn();
    const onDownload = vi.fn();
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
      canDownload: true,
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
            canDownload: false,
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
