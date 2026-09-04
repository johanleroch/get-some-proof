import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ManagedSubmissionView } from "./managed-submission";

describe("ManagedSubmissionView", () => {
  afterEach(cleanup);

  it("renders the one Submission represented by the private link", () => {
    render(
      <ManagedSubmissionView
        submission={{
          avatarUrl: null,
          brandName: "Acme Studio",
          company: "North Star Co",
          consentAcceptedAt: Date.UTC(2026, 8, 3),
          contentVersion: 1,
          moderationStatus: "pending",
          privacyContact: "privacy@acme.example",
          publicSlug: "acme-proof",
          role: "Founder",
          submissionType: "text",
          submitterEmail: "alice@example.com",
          submitterName: "Alice Martin",
          text: "This is the testimonial attached to the private link.",
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Manage your testimonial" }),
    ).toBeVisible();
    expect(screen.getByText(/attached to the private link/i)).toBeVisible();
    expect(screen.getByDisplayValue(/alice@example.com/i)).toBeDisabled();
    expect(screen.getByText(/pending/i)).toBeVisible();
  });

  it("lets a video Submitter play the currently stored video", () => {
    const { container } = render(
      <ManagedSubmissionView
        submission={{
          avatarUrl: null,
          brandName: "Acme Studio",
          consentAcceptedAt: Date.UTC(2026, 8, 3),
          contentVersion: 1,
          currentVideo: {
            playbackId: "current-playback-id",
            posterTimeSeconds: 12,
          },
          moderationStatus: "published",
          privacyContact: "privacy@acme.example",
          publicSlug: "acme-proof",
          submissionType: "video",
          submitterEmail: "alice@example.com",
          submitterName: "Alice Martin",
          text: "",
        }}
      />,
    );

    expect(
      screen.getByLabelText("Your current video testimonial"),
    ).toBeVisible();
    expect(container.innerHTML).toContain("current-playback-id");
  });

  it("shows and cancels replacement upload progress", async () => {
    const onReplaceVideo = vi.fn(
      (
        _file: File,
        _language: "en" | "fr",
        input: { onProgress: (value: number) => void; signal: AbortSignal },
      ) =>
        new Promise<void>((_resolve, reject) => {
          input.onProgress(72);
          input.signal.addEventListener("abort", () =>
            reject(new Error("Video upload cancelled.")),
          );
        }),
    );
    render(
      <ManagedSubmissionView
        onReplaceVideo={onReplaceVideo}
        submission={{
          avatarUrl: null,
          brandName: "Acme Studio",
          consentAcceptedAt: Date.UTC(2026, 8, 3),
          contentVersion: 1,
          currentVideo: { playbackId: "current-playback-id" },
          moderationStatus: "published",
          privacyContact: "privacy@acme.example",
          publicSlug: "acme-proof",
          submissionType: "video",
          submitterEmail: "alice@example.com",
          submitterName: "Alice Martin",
          text: "",
        }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Replacement video"), {
      target: {
        files: [new File(["video"], "replacement.mp4", { type: "video/mp4" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload replacement" }));

    expect(await screen.findByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "72",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel upload" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Upload replacement" }),
      ).toBeEnabled(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not hide a failed reservation cleanup after cancellation", async () => {
    render(
      <ManagedSubmissionView
        onReplaceVideo={(_file, _language, input) =>
          new Promise<void>((_resolve, reject) => {
            input.signal.addEventListener("abort", () =>
              reject(
                new Error(
                  "The upload stopped, but its reservation could not be released. Refresh before trying again.",
                ),
              ),
            );
          })
        }
        submission={{
          avatarUrl: null,
          brandName: "Acme Studio",
          consentAcceptedAt: Date.UTC(2026, 8, 3),
          contentVersion: 1,
          currentVideo: { playbackId: "current-playback-id" },
          moderationStatus: "published",
          privacyContact: "privacy@acme.example",
          publicSlug: "acme-proof",
          submissionType: "video",
          submitterEmail: "alice@example.com",
          submitterName: "Alice Martin",
          text: "",
        }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Replacement video"), {
      target: {
        files: [new File(["video"], "replacement.mp4", { type: "video/mp4" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload replacement" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Cancel upload" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "reservation could not be released",
    );
  });
});
