import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { inspectVideoFile } from "@/lib/video-file";
import { uploadDirectVideo } from "@/lib/video-upload";

import { ManagedSubmission } from "./managed-submission";

vi.mock("convex/react", () => ({
  useAction: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));
vi.mock("@/lib/video-file", () => ({ inspectVideoFile: vi.fn() }));
vi.mock("@/lib/video-upload", () => ({ uploadDirectVideo: vi.fn() }));

describe("Submission Revision upload orchestration", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it.each([false, true])(
    "releases the actual replacement reservation after transport failure (cleanup fails: %s)",
    async (cleanupFails) => {
      const reserve = vi.fn().mockResolvedValue({
        provider: "fake",
        uploadUrl: "fake://replacement",
        reservationId: "reservation",
        revisionId: "revision",
      });
      const release = cleanupFails
        ? vi.fn().mockRejectedValue(new Error("offline"))
        : vi.fn().mockResolvedValue(null);
      const confirm = vi.fn();
      vi.mocked(useAction).mockReturnValue(reserve);
      vi.mocked(useMutation).mockImplementation((ref) => {
        const name = getFunctionName(ref);
        return Object.assign(
          name === "submissionManagement:cancelVideoReplacement"
            ? release
            : confirm,
          { withOptimisticUpdate: vi.fn() },
        );
      });
      vi.mocked(useQuery).mockReturnValue({
        avatarUrl: null,
        brandName: "Acme Studio",
        consentAcceptedAt: Date.UTC(2026, 8, 3),
        contentVersion: 4,
        currentVideo: { playbackId: "original" },
        moderationStatus: "published",
        privacyContact: "privacy@acme.example",
        publicSlug: "acme-proof",
        submissionType: "video",
        submitterEmail: "alice@example.com",
        submitterName: "Alice",
        text: "",
      });
      vi.mocked(inspectVideoFile).mockResolvedValue({ durationSeconds: 10 });
      vi.mocked(uploadDirectVideo).mockRejectedValue(
        new Error("connection lost"),
      );
      render(<ManagedSubmission token="private-link" />);
      fireEvent.change(screen.getByLabelText("Replacement video"), {
        target: {
          files: [
            new File(["video"], "replacement.mp4", { type: "video/mp4" }),
          ],
        },
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Upload replacement" }),
      );
      await waitFor(() =>
        expect(release).toHaveBeenCalledExactlyOnceWith({
          token: "private-link",
          reservationId: "reservation",
          revisionId: "revision",
        }),
      );
      expect(reserve).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedContentVersion: 4,
          token: "private-link",
        }),
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        cleanupFails ? "reservation could not be released" : "connection lost",
      );
      expect(confirm).not.toHaveBeenCalled();
      expect(
        screen.getByLabelText("Your current video testimonial"),
      ).toBeVisible();
    },
  );
});
