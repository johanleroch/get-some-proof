import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { VideoUploadProgress } from "./video-upload-progress";

describe("VideoUploadProgress", () => {
  afterEach(cleanup);

  it("stays hidden before an upload starts", () => {
    render(<VideoUploadProgress phase="idle" progress={0} />);

    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("makes the processing transition explicit after upload reaches 100%", () => {
    render(<VideoUploadProgress phase="processing" progress={100} />);

    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    expect(screen.getByText(/video uploaded — processing/i)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Video uploaded — processing",
    );
    expect(screen.queryByRole("button", { name: "Cancel upload" })).toBeNull();
  });
});
