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
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Video uploaded !");
    expect(status).toHaveTextContent("Processing");
    expect(
      screen.getByText("Processing and captions continue in the background."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Cancel upload" })).toBeNull();
  });
});
