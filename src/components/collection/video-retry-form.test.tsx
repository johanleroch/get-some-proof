import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VideoRetryFormView } from "./video-retry-form";
import type { Id } from "@convex/_generated/dataModel";

const context = {
  brandName: "Acme Studio",
  publicSlug: "acme-studio",
  spokenLanguage: "fr" as const,
};
const reservationId = "retry-reservation" as Id<"videoReservations">;

describe("VideoRetryFormView", () => {
  beforeEach(cleanup);

  it("replaces the failed video through the one-time direct upload", async () => {
    const createRetryUpload = vi.fn().mockResolvedValue({
      provider: "fake",
      reservationId,
      uploadUrl: "https://fake-mux.invalid/replacement",
    });
    const uploadVideo = vi.fn().mockResolvedValue(undefined);
    render(
      <VideoRetryFormView
        context={context}
        createRetryUpload={createRetryUpload}
        inspectVideo={vi.fn().mockResolvedValue({ durationSeconds: 45 })}
        token="private-retry-token"
        uploadVideo={uploadVideo}
      />,
    );

    const file = new File(["video"], "replacement.mp4", {
      type: "video/mp4",
    });
    fireEvent.change(screen.getByLabelText("New video"), {
      target: { files: [file] },
    });
    expect(screen.getByLabelText("Spoken language")).toHaveValue("fr");
    fireEvent.click(screen.getByRole("button", { name: "Replace video" }));

    await waitFor(() => expect(createRetryUpload).toHaveBeenCalledTimes(1));
    expect(createRetryUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        fileSizeBytes: file.size,
        mimeType: "video/mp4",
        spokenLanguage: "fr",
        token: "private-retry-token",
      }),
    );
    expect(uploadVideo).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        provider: "fake",
        uploadUrl: "https://fake-mux.invalid/replacement",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Replacement uploaded" }),
    ).toBeVisible();
  });

  it("shows an unavailable state for an expired or consumed link", () => {
    render(
      <VideoRetryFormView
        context={null}
        createRetryUpload={vi.fn()}
        token="expired-token"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Replacement unavailable" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("New video")).toBeNull();
  });

  it("rejects an overlong replacement before claiming the link", async () => {
    const createRetryUpload = vi.fn();
    render(
      <VideoRetryFormView
        context={context}
        createRetryUpload={createRetryUpload}
        inspectVideo={vi
          .fn()
          .mockRejectedValue(
            new Error("Video must be no longer than 2 minutes."),
          )}
        token="still-valid-token"
      />,
    );

    fireEvent.change(screen.getByLabelText("New video"), {
      target: {
        files: [new File(["video"], "too-long.webm", { type: "video/webm" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Replace video" }));

    expect(
      await screen.findByText("Video must be no longer than 2 minutes."),
    ).toBeVisible();
    expect(createRetryUpload).not.toHaveBeenCalled();
  });

  it("retains the link context after the one-time token is consumed", async () => {
    let finishUpload: (() => void) | undefined;
    const uploadVideo = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishUpload = resolve;
        }),
    );
    const { rerender } = render(
      <VideoRetryFormView
        context={context}
        createRetryUpload={vi.fn().mockResolvedValue({
          provider: "fake",
          reservationId,
          uploadUrl: "https://fake-mux.invalid/replacement",
        })}
        inspectVideo={vi.fn().mockResolvedValue({ durationSeconds: 45 })}
        token="one-time-token"
        uploadVideo={uploadVideo}
      />,
    );
    fireEvent.change(screen.getByLabelText("New video"), {
      target: {
        files: [new File(["video"], "replacement.mp4", { type: "video/mp4" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Replace video" }));
    await waitFor(() => expect(uploadVideo).toHaveBeenCalledTimes(1));

    rerender(
      <VideoRetryFormView
        context={null}
        createRetryUpload={vi.fn()}
        token="one-time-token"
        uploadVideo={uploadVideo}
      />,
    );
    expect(
      screen.queryByRole("heading", { name: "Replacement unavailable" }),
    ).toBeNull();

    await act(async () => finishUpload?.());
    expect(
      await screen.findByRole("heading", { name: "Replacement uploaded" }),
    ).toBeVisible();
    expect(screen.getByText(/Acme Studio/)).toBeVisible();
  });

  it("releases the reservation when the direct upload fails", async () => {
    const cancelRetryVideo = vi.fn().mockResolvedValue(null);
    render(
      <VideoRetryFormView
        cancelRetryVideo={cancelRetryVideo}
        context={context}
        createRetryUpload={vi.fn().mockResolvedValue({
          provider: "fake",
          reservationId,
          uploadUrl: "https://fake-mux.invalid/replacement",
        })}
        inspectVideo={vi.fn().mockResolvedValue({ durationSeconds: 45 })}
        token="one-time-token"
        uploadVideo={vi.fn().mockRejectedValue(new Error("Network lost."))}
      />,
    );
    fireEvent.change(screen.getByLabelText("New video"), {
      target: {
        files: [new File(["video"], "replacement.mp4", { type: "video/mp4" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Replace video" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Network lost.");
    expect(cancelRetryVideo).toHaveBeenCalledWith({
      clientSubmissionId: expect.any(String),
      reservationId,
      token: "one-time-token",
    });
  });
});
