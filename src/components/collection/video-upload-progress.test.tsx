import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { VideoUploadProgress } from "./video-upload-progress";

describe("VideoUploadProgress", () => {
  afterEach(cleanup);

  it("stays hidden before an upload starts", () => {
    render(<VideoUploadProgress phase="idle" progress={0} />);

    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("keeps the percentage on the label's line while uploading", () => {
    render(
      <VideoUploadProgress
        onCancel={() => undefined}
        phase="uploading"
        progress={46.4}
      />,
    );

    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "46",
    );
    expect(screen.getByText("Uploading your video…")).toBeVisible();
    expect(screen.getByText("46%")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancel upload" })).toBeVisible();
  });

  it("makes the processing transition explicit after upload reaches 100%", () => {
    render(<VideoUploadProgress phase="processing" progress={100} />);

    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    // The space before the mark is non-breaking on purpose: the founder asked
    // for the space, and the mark must never wrap away from the word.
    // The exact character is pinned: the default matcher would collapse the
    // non-breaking space into an ordinary one and never see a regression.
    expect(
      screen.getByText("Video uploaded !", { normalizer: (text) => text }),
    ).toBeVisible();
    expect(
      screen.getByText("Processing and captions continue in the background."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Cancel upload" })).toBeNull();
  });

  it("announces the landing and plays the new label in", () => {
    const { rerender } = render(
      <VideoUploadProgress
        onCancel={() => undefined}
        phase="uploading"
        progress={99}
      />,
    );

    // The live region is mounted before the message it will carry, or screen
    // readers miss the announcement.
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    const uploadingLabel = screen.getByText("Uploading your video…");

    rerender(<VideoUploadProgress phase="processing" progress={100} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Video uploaded. Processing and captions continue in the background.",
    );
    const landedLabel = screen.getByText("Video uploaded !", {
      normalizer: (text) => text,
    });
    expect(landedLabel).toHaveClass("upload-status-label");
    // A new node, so its arrival animation replays instead of the text
    // swapping in place.
    expect(landedLabel).not.toBe(uploadingLabel);
  });
});
