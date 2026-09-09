import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Id } from "@convex/_generated/dataModel";
import {
  InboxCategoryTabs,
  InboxFeedback,
  TestimonialDeleteDialog,
  TestimonialInboxView,
} from "./testimonial-inbox";
import { WallDisplayDialog } from "./wall-display-dialog";

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

function openMenu(name = "Camille Test") {
  const options = screen.getByRole("button", {
    name: `More actions for ${name}'s Testimonial`,
  });
  fireEvent.pointerDown(options, { button: 0, ctrlKey: false });
  return options;
}

describe("TestimonialInboxView", () => {
  beforeEach(cleanup);

  it("keeps the decision on the row and the tools in the menu", async () => {
    const onAction = vi.fn();
    render(
      <TestimonialInboxView
        category="pending"
        onAction={onAction}
        pendingId={null}
        testimonials={[testimonial]}
      />,
    );

    // The words in full: the Owner reads everything before deciding.
    expect(screen.getByText(testimonial.card.text)).toBeVisible();
    // Private facts the Owner needs, never in the shared public markup.
    expect(screen.getByText(testimonial.submitterEmail)).toBeVisible();
    expect(screen.getByText("Founder · Example Studio")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(onAction).toHaveBeenCalledWith(testimonial, "publish");
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onAction).toHaveBeenCalledWith(testimonial, "archive");
    // Nothing to reorder outside Published.
    expect(screen.queryByRole("button", { name: /Move Camille/ })).toBeNull();

    openMenu();
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Highlight a phrase" }),
    );
    expect(onAction).toHaveBeenCalledWith(testimonial, "highlight");

    openMenu();
    expect(
      await screen.findByRole("menuitem", { name: "Mark as Spam" }),
    ).toBeVisible();
    expect(
      screen.getByRole("menuitem", { name: "Delete permanently" }),
    ).toBeVisible();
    // The decision never hides in the menu, and Wall details wait for
    // publication.
    expect(screen.queryByRole("menuitem", { name: "Publish" })).toBeNull();
    expect(
      screen.queryByRole("menuitem", { name: "Show or hide details" }),
    ).toBeNull();
  });

  it("gives each category its own empty state", () => {
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
        category="spam"
        onAction={vi.fn()}
        pendingId={null}
        testimonials={[]}
      />,
    );
    expect(screen.getByText("No Spam quarantined")).toBeInTheDocument();
  });

  it("asks for a concise permanent-deletion confirmation", () => {
    const onDelete = vi.fn();
    render(
      <TestimonialDeleteDialog
        onDelete={onDelete}
        onOpenChange={vi.fn()}
        pending={false}
        target={testimonial}
      />,
    );

    expect(
      screen.getByRole("alertdialog", {
        name: "Delete Camille Test's Testimonial?",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "This permanently removes the Testimonial and its media. There is no undo.",
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("shows reversible Spam quarantine without ordinary moderation actions", async () => {
    const onAction = vi.fn();
    const spam = {
      ...testimonial,
      moderationStatus: "spam" as const,
      quarantineExpiresAt: Date.UTC(2026, 8, 10),
      spamCreditRestored: true,
    };
    render(
      <TestimonialInboxView
        category="spam"
        onAction={onAction}
        pendingId={null}
        testimonials={[spam]}
      />,
    );

    // Undoing is one click, on the row, not a filter change away.
    fireEvent.click(screen.getByRole("button", { name: "Not Spam" }));
    expect(onAction).toHaveBeenCalledWith(spam, "undo-spam");
    // The seven-day clock that ends in Permanent Deletion is visible.
    expect(screen.getByText(/Deleted on/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();

    openMenu();
    expect(
      await screen.findByRole("menuitem", { name: "Delete permanently" }),
    ).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: "Mark as Spam" })).toBeNull();
    expect(
      screen.queryByRole("menuitem", { name: "Highlight a phrase" }),
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

  it("says why a video cannot be Published yet, and opens the card once Ready", () => {
    const onAction = vi.fn();
    const video = {
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

    expect(screen.getByTestId("processing-video-placeholder")).toBeVisible();
    expect(screen.getByText("Processing")).toBeVisible();
    expect(screen.getByText("Publish once the video is Ready.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Archive" })).toBeEnabled();

    rerender(
      <TestimonialInboxView
        category="pending"
        onAction={onAction}
        pendingId={null}
        testimonials={[
          { ...video, captionsStatus: "failed", videoStatus: "failed" },
        ]}
      />,
    );
    expect(screen.getByTestId("failed-video-placeholder")).toBeVisible();
    expect(screen.queryByTestId("processing-video-placeholder")).toBeNull();
    expect(screen.getByText("Failed")).toBeVisible();
    expect(screen.getByText(/link to replace the video/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();

    // Imported proof has no Submitter email or replacement-link delivery.
    // The distinction remains after publication permission was recorded.
    for (const requiresImportAttestation of [true, false]) {
      rerender(
        <TestimonialInboxView
          category="pending"
          onAction={onAction}
          pendingId={null}
          testimonials={[
            {
              ...video,
              consentAcceptedAt: undefined,
              submitterEmail: undefined,
              requiresImportAttestation,
              captionsStatus: "failed",
              videoStatus: "failed",
            },
          ]}
        />,
      );
      expect(
        screen.getByText("The imported video could not be copied."),
      ).toBeVisible();
      expect(screen.queryByText(/link to replace the video/)).toBeNull();
      expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    }

    const ready = {
      ...video,
      card: {
        aspectRatio: "4:3",
        avatarUrl: null,
        captionsAvailable: true,
        id: "testimonial-video",
        name: "Camille Test",
        playbackId: "owner-playback-id",
        publishedAt: 2,
        rating: 4,
        type: "video" as const,
      },
      captionsStatus: "ready" as const,
      videoDurationSeconds: 42,
      videoStatus: "ready" as const,
    };
    rerender(
      <TestimonialInboxView
        category="pending"
        onAction={onAction}
        pendingId={null}
        testimonials={[ready]}
      />,
    );
    // Ready: no status line; the still carries the duration in a corner.
    expect(screen.queryByText("Processing")).toBeNull();
    expect(screen.getByText("0:42")).toBeVisible();
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
    // The list never loads a player; the still opens the real card.
    expect(screen.queryByTestId("mux-video-player")).toBeNull();
    const still = screen.getByRole("button", {
      name: "Preview Camille Test's video",
    });
    expect(still).toHaveStyle({ aspectRatio: "9 / 16", width: "48px" });
    fireEvent.click(still);
    expect(onAction).toHaveBeenCalledWith(ready, "preview");
  });

  it("lists Published rows in Wall order, movable by arrows and by drag", async () => {
    const onAction = vi.fn();
    const onMove = vi.fn().mockResolvedValue(null);
    const first = {
      ...testimonial,
      moderationStatus: "published" as const,
    };
    const second = {
      ...testimonial,
      card: { ...testimonial.card, id: "testimonial-2", name: "Second Person" },
      moderationStatus: "published" as const,
      submitterName: "Second Person",
      testimonialId: "testimonial-2" as Id<"testimonials">,
    };
    render(
      <TestimonialInboxView
        category="published"
        onAction={onAction}
        onMove={onMove}
        pendingId={null}
        testimonials={[first, second]}
      />,
    );

    expect(screen.getByText(/Visitors see your Public Wall/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Move Camille Test up" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Move Camille Test down" }),
    );
    expect(onMove).toHaveBeenCalledWith(
      "testimonial-1",
      "testimonial-2",
      undefined,
    );

    const rows = screen.getAllByRole("listitem");
    fireEvent.dragStart(rows[1]!);
    fireEvent.dragOver(rows[0]!);
    fireEvent.drop(rows[0]!);
    expect(onMove).toHaveBeenLastCalledWith(
      "testimonial-2",
      undefined,
      "testimonial-1",
    );

    fireEvent.click(
      within(rows[0]!).getByRole("button", { name: "Unpublish" }),
    );
    expect(onAction).toHaveBeenCalledWith(first, "unpublish");

    openMenu();
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Show or hide details" }),
    );
    expect(onAction).toHaveBeenCalledWith(first, "wall-display");
  });
});

describe("InboxCategoryTabs", () => {
  beforeEach(cleanup);

  it("names each category with how many Testimonials wait in it", () => {
    render(
      <InboxCategoryTabs
        counts={{ archived: 0, pending: 3, published: 2, spam: 1 }}
        moderationStatus="pending"
        onModerationStatusChange={vi.fn()}
      >
        <p>panel</p>
      </InboxCategoryTabs>,
    );

    expect(screen.getByRole("tab", { name: "Pending 3" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Published 2" })).toBeVisible();
    // An empty category stays quiet.
    expect(screen.getByRole("tab", { name: "Archived" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Spam 1" })).toBeVisible();
  });
});

describe("WallDisplayDialog", () => {
  beforeEach(cleanup);

  it("shows the Wall default beside each detail and saves only the exceptions", async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(null);
    render(
      <WallDisplayDialog
        onClose={onClose}
        onSave={onSave}
        overrides={{ company: false }}
        submitterName="Camille Test"
        testimonial={testimonial.card}
        wallVisibility={{
          avatar: true,
          company: true,
          rating: false,
          role: true,
        }}
      />,
    );

    // No photo was sent, so there is nothing to decide about one.
    expect(screen.queryByRole("group", { name: "Photo" })).toBeNull();
    const company = screen.getByRole("group", { name: "Company" });
    expect(
      within(company).getByRole("button", { name: "Hide" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("hidden by default")).toBeVisible();

    fireEvent.click(
      within(screen.getByRole("group", { name: "Stars" })).getByRole("button", {
        name: "Show",
      }),
    );
    fireEvent.click(
      within(company).getByRole("button", { name: "Wall default" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ rating: true }));
    expect(onClose).toHaveBeenCalled();
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
