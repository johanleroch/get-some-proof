import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TestimonialCardVideoValue } from "@convex/testimonialCardValue";

import { VideoThumbnailDialog } from "./video-thumbnail-dialog";

const testimonial: TestimonialCardVideoValue = {
  aspectRatio: "9:16",
  avatarUrl: null,
  captionsAvailable: true,
  company: "Tidewater Apps",
  id: "video-1",
  name: "Maya Chen",
  playbackId: "public-playback-id",
  posterTimeSeconds: 12,
  publishedAt: 1,
  rating: 5,
  role: "Product lead",
  type: "video",
};

function renderDialog(
  overrides: Partial<Parameters<typeof VideoThumbnailDialog>[0]> = {},
) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  const view = render(
    <VideoThumbnailDialog
      durationSeconds={40}
      onClose={onClose}
      onSave={onSave}
      submitterName="Maya Chen"
      testimonial={testimonial}
      {...overrides}
    />,
  );
  return { ...view, onClose, onSave };
}

/** The still the real card shows right now. */
function cardPoster() {
  return screen
    .getByRole("img", { name: "Video from Maya Chen" })
    .getAttribute("src");
}

describe("VideoThumbnailDialog", () => {
  // The dialog stays open on close (the fixture owns that), so each test
  // must start from an empty document or two dialogs answer every query.
  afterEach(cleanup);

  it("picks a moment and previews it on the real card, never dark", async () => {
    const { onClose, onSave } = renderDialog();

    // Eight moments, no scrubbing, and the card opens on the very URL the
    // Inbox card already loaded.
    expect(screen.getAllByRole("radio")).toHaveLength(8);
    expect(screen.queryByRole("slider")).toBeNull();
    expect(cardPoster()).toBe(
      "https://image.mux.com/public-playback-id/thumbnail.webp?width=960&time=12",
    );
    expect(screen.getByLabelText("5 out of 5 stars")).toBeInTheDocument();
    expect(screen.queryByTestId("thumbnail-preload")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Moment at 0:28" }));
    expect(
      screen.getByRole("radio", { name: "Moment at 0:28" }),
    ).toHaveAttribute("aria-checked", "true");
    // The card keeps the old still while the new one loads off screen...
    expect(cardPoster()).toContain("time=12");
    const preload = screen.getByTestId("thumbnail-preload");
    expect(preload).toHaveAttribute(
      "src",
      expect.stringContaining("time=27.5"),
    );
    // ...and swaps only once it has arrived.
    fireEvent.load(preload);
    expect(cardPoster()).toContain("time=27.5");
    expect(screen.queryByTestId("thumbnail-preload")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        kind: "frame",
        timeSeconds: 27.5,
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("previews an uploaded image on the card, refuses the wrong file, and saves the file", async () => {
    const { onSave } = renderDialog();
    const input = screen.getByTestId("thumbnail-image-file");

    fireEvent.change(input, {
      target: {
        files: [new File(["x"], "notes.pdf", { type: "application/pdf" })],
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a JPEG, PNG, WebP, or AVIF image smaller than 20 MB.",
    );

    const photo = new File(["x"], "smile.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [photo] } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("smile.jpg")).toBeInTheDocument();
    // The moments step aside and the card takes the image once it has loaded.
    for (const moment of screen.getAllByRole("radio")) {
      expect(moment).toBeDisabled();
    }
    const preload = screen.getByTestId("thumbnail-preload");
    expect(preload).toHaveAttribute("src", expect.stringMatching(/^blob:/));
    fireEvent.load(preload);
    expect(cardPoster()).toMatch(/^blob:/);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ file: photo, kind: "image" }),
    );
  });

  it("keeps the dialog open and shows why when saving fails", async () => {
    renderDialog({
      onSave: vi
        .fn()
        .mockRejectedValue(new Error("Pick a moment inside the video.")),
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Pick a moment inside the video.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
