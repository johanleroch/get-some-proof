import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CollectionFormShellView } from "./collection-form-shell";

describe("CollectionFormShellView", () => {
  beforeEach(cleanup);

  it("renders the configured public Brand identity without private workspace data", () => {
    render(
      <CollectionFormShellView
        brand={{
          collectionFormDescription: "Tell us what changed.",
          collectionFormTitle: "Share your Acme story",
          logoUrl: null,
          name: "Acme Studio",
          primaryColor: "#123abc",
          privacyContact: "privacy@acme.example",
          publicSlug: "acme-studio",
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Share your Acme story" }),
    ).toBeVisible();
    expect(screen.getByText("Tell us what changed.")).toBeVisible();
    expect(screen.getByText("Acme Studio")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "privacy notice" }),
    ).toHaveAttribute("href", "/c/acme-studio/privacy");
    expect(screen.queryByText(/organization/i)).toBeNull();
  });

  it("disables only an exhausted format and hides plan details", () => {
    render(
      <CollectionFormShellView
        availability={{ textAvailable: false, videoAvailable: true }}
        brand={{
          collectionFormDescription: "Tell us what changed.",
          collectionFormTitle: "Share your Acme story",
          logoUrl: null,
          name: "Acme Studio",
          primaryColor: "#123abc",
          privacyContact: "privacy@acme.example",
          publicSlug: "acme-studio",
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Send a text testimonial" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Record or upload a video" }),
    ).toBeEnabled();
    expect(screen.queryByText(/free|pro|credit|plan/i)).toBeNull();
  });

  it("shows a neutral closed state when both formats are exhausted", () => {
    render(
      <CollectionFormShellView
        availability={{ textAvailable: false, videoAvailable: false }}
        brand={{
          collectionFormDescription: "Tell us what changed.",
          collectionFormTitle: "Share your Acme story",
          logoUrl: null,
          name: "Acme Studio",
          primaryColor: "#123abc",
          privacyContact: "privacy@acme.example",
          publicSlug: "acme-studio",
        }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Collection is temporarily closed",
      }),
    ).toBeVisible();
    expect(screen.queryByText(/free|pro|credit|plan/i)).toBeNull();
  });

  it("completes the responsive four-stage text Submission journey", async () => {
    const submitText = vi.fn().mockResolvedValue({
      moderationStatus: "pending",
      testimonialId: "testimonial-1",
    });
    render(
      <CollectionFormShellView
        brand={{
          collectionFormDescription: "Tell us what changed.",
          collectionFormTitle: "Share your Acme story",
          logoUrl: null,
          name: "Acme Studio",
          primaryColor: "#123abc",
          privacyContact: "privacy@acme.example",
          publicSlug: "acme-studio",
        }}
        submitText={submitText}
      />,
    );

    expect(screen.getByText("Step 1 of 4")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Send a text testimonial" }),
    );
    expect(screen.getByText("Step 2 of 4")).toBeVisible();
    expect(screen.getByLabelText("Your testimonial")).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Your testimonial"), {
      target: { value: "Acme helped us turn customer proof into new work." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Step 3 of 4")).toBeVisible();
    expect(screen.getByLabelText("Your name")).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Alice Martin" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Role"), {
      target: { value: "Founder" },
    });
    fireEvent.change(screen.getByLabelText("Company"), {
      target: { value: "North Star Co" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "5 stars" }));
    expect(screen.getByText(/authorize Acme Studio to publish/i)).toBeVisible();
    fireEvent.click(screen.getByLabelText(/at least 18 years old/i));
    fireEvent.click(screen.getByLabelText(/I give Publication Consent/i));
    fireEvent.click(screen.getByRole("button", { name: "Submit testimonial" }));

    await waitFor(() => expect(submitText).toHaveBeenCalledTimes(1));
    expect(submitText).toHaveBeenCalledWith(
      expect.objectContaining({
        ageConfirmed: true,
        company: "North Star Co",
        consentAccepted: true,
        consentText: expect.stringContaining(
          "I authorize Acme Studio to publish",
        ),
        consentVersion: "2026-09-03.v1",
        publicSlug: "acme-studio",
        rating: 5,
        role: "Founder",
        submitterEmail: "alice@example.com",
        submitterName: "Alice Martin",
        text: "Acme helped us turn customer proof into new work.",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Thank you for your proof" }),
    ).toHaveFocus();
    expect(screen.getByText("Step 4 of 4")).toBeVisible();
    expect(screen.getAllByText(/management link/i)).not.toHaveLength(0);
  });

  it("keeps work in the browser and submits nothing before final confirmation", () => {
    const submitText = vi.fn();
    render(
      <CollectionFormShellView
        brand={{
          collectionFormDescription: "Tell us what changed.",
          collectionFormTitle: "Share your Acme story",
          logoUrl: null,
          name: "Acme Studio",
          primaryColor: "#123abc",
          privacyContact: "privacy@acme.example",
          publicSlug: "acme-studio",
        }}
        submitText={submitText}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Send a text testimonial" }),
    );
    fireEvent.change(screen.getByLabelText("Your testimonial"), {
      target: { value: "This text is long enough but has not been confirmed." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(submitText).not.toHaveBeenCalled();
  });

  it("keeps imported video and text available when recording is unsupported", () => {
    render(
      <CollectionFormShellView
        brand={{
          collectionFormDescription: "Tell us what changed.",
          collectionFormTitle: "Share your Acme story",
          logoUrl: null,
          name: "Acme Studio",
          primaryColor: "#123abc",
          privacyContact: "privacy@acme.example",
          publicSlug: "acme-studio",
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Record or upload a video" }),
    );

    expect(screen.getByLabelText("Import video")).toBeVisible();
    expect(screen.getByText(/recording isn't supported/i)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.getByRole("button", { name: "Send a text testimonial" }),
    ).toBeVisible();
  });

  it("uploads a validated video directly and submits its private metadata", async () => {
    const createDirectUpload = vi.fn().mockResolvedValue({
      expiresAt: Date.now() + 60_000,
      provider: "fake",
      reservationId: "reservation-1",
      uploadUrl: "https://fake-mux.invalid/upload-1",
    });
    const uploadVideo = vi.fn().mockResolvedValue(undefined);
    const submitVideo = vi.fn().mockResolvedValue({
      moderationStatus: "pending",
      processingStatus: "processing",
      testimonialId: "testimonial-video-1",
    });
    render(
      <CollectionFormShellView
        brand={{
          collectionFormDescription: "Tell us what changed.",
          collectionFormTitle: "Share your Acme story",
          logoUrl: null,
          name: "Acme Studio",
          primaryColor: "#123abc",
          privacyContact: "privacy@acme.example",
          publicSlug: "acme-studio",
        }}
        createDirectUpload={createDirectUpload}
        inspectVideo={vi.fn().mockResolvedValue({ durationSeconds: 72 })}
        submitVideo={submitVideo}
        uploadVideo={uploadVideo}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Record or upload a video" }),
    );
    const file = new File(["video"], "customer-story.mp4", {
      type: "video/mp4",
    });
    fireEvent.change(screen.getByLabelText("Import video"), {
      target: { files: [file] },
    });
    fireEvent.change(screen.getByLabelText("Spoken language"), {
      target: { value: "fr" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("About you")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Alice Martin" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.click(screen.getByLabelText(/at least 18 years old/i));
    fireEvent.click(screen.getByLabelText(/I give Publication Consent/i));
    fireEvent.click(screen.getByRole("button", { name: "Submit testimonial" }));

    await waitFor(() => expect(submitVideo).toHaveBeenCalledTimes(1));
    expect(createDirectUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        fileSizeBytes: file.size,
        mimeType: "video/mp4",
        spokenLanguage: "fr",
      }),
    );
    expect(uploadVideo).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        provider: "fake",
        uploadUrl: "https://fake-mux.invalid/upload-1",
      }),
    );
    expect(submitVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        durationSeconds: 72,
        reservationId: "reservation-1",
        submitterEmail: "alice@example.com",
      }),
    );
  });

  it("reuses uncertain uploads but restarts after a definitive expiry", async () => {
    const cancelVideo = vi.fn().mockResolvedValue(null);
    const createDirectUpload = vi.fn().mockResolvedValue({
      expiresAt: Date.now() + 60_000,
      provider: "mux",
      reservationId: "reservation-uncertain",
      uploadUrl: "https://mux.example/upload",
    });
    const uploadVideo = vi.fn().mockResolvedValue(undefined);
    const submitVideo = vi
      .fn()
      .mockRejectedValueOnce(new Error("Connection lost after submission."))
      .mockRejectedValueOnce(
        new Error("VIDEO_RESERVATION_UNAVAILABLE: Upload expired."),
      )
      .mockResolvedValueOnce({
        moderationStatus: "pending",
        processingStatus: "processing",
        testimonialId: "testimonial-video-uncertain",
      });
    render(
      <CollectionFormShellView
        brand={{
          collectionFormDescription: "Tell us what changed.",
          collectionFormTitle: "Share your Acme story",
          logoUrl: null,
          name: "Acme Studio",
          primaryColor: "#123abc",
          privacyContact: "privacy@acme.example",
          publicSlug: "acme-studio",
        }}
        cancelVideo={cancelVideo}
        createDirectUpload={createDirectUpload}
        inspectVideo={vi.fn().mockResolvedValue({ durationSeconds: 72 })}
        submitVideo={submitVideo}
        uploadVideo={uploadVideo}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Record or upload a video" }),
    );
    fireEvent.change(screen.getByLabelText("Import video"), {
      target: {
        files: [new File(["video"], "story.mp4", { type: "video/mp4" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("About you")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Alice Martin" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "alice@example.com" },
    });
    fireEvent.click(screen.getByLabelText(/at least 18 years old/i));
    fireEvent.click(screen.getByLabelText(/I give Publication Consent/i));
    fireEvent.click(screen.getByRole("button", { name: "Submit testimonial" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connection lost after submission.",
    );
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Submit testimonial" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "VIDEO_RESERVATION_UNAVAILABLE",
    );
    await waitFor(() => expect(cancelVideo).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Submit testimonial" }));
    expect(await screen.findByText("Thank you for your proof")).toBeVisible();
    expect(createDirectUpload).toHaveBeenCalledTimes(2);
    expect(uploadVideo).toHaveBeenCalledTimes(2);
    expect(submitVideo).toHaveBeenCalledTimes(3);
  });

  it("preserves upload and text choices when camera permission is refused", async () => {
    const originalMediaDevices = Object.getOwnPropertyDescriptor(
      navigator,
      "mediaDevices",
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    vi.stubGlobal("MediaRecorder", class {});
    try {
      render(
        <CollectionFormShellView
          brand={{
            collectionFormDescription: "Tell us what changed.",
            collectionFormTitle: "Share your Acme story",
            logoUrl: null,
            name: "Acme Studio",
            primaryColor: "#123abc",
            privacyContact: "privacy@acme.example",
            publicSlug: "acme-studio",
          }}
        />,
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Record or upload a video" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Start recording" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /still import a video or send text/i,
      );
      expect(screen.getByLabelText("Import video")).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      expect(
        screen.getByRole("button", { name: "Send a text testimonial" }),
      ).toBeVisible();
    } finally {
      vi.unstubAllGlobals();
      if (originalMediaDevices) {
        Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
      } else {
        delete (navigator as { mediaDevices?: unknown }).mediaDevices;
      }
    }
  });

  it("normalizes browser recording codec parameters and stops camera tracks", async () => {
    const stopTrack = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream;
    const originalMediaDevices = Object.getOwnPropertyDescriptor(
      navigator,
      "mediaDevices",
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    class Recorder {
      mimeType = "video/webm;codecs=vp8,opus";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      state: RecordingState = "inactive";
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["video"]) } as BlobEvent);
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", Recorder);
    try {
      render(
        <CollectionFormShellView
          brand={{
            collectionFormDescription: "Tell us what changed.",
            collectionFormTitle: "Share your Acme story",
            logoUrl: null,
            name: "Acme Studio",
            primaryColor: "#123abc",
            privacyContact: "privacy@acme.example",
            publicSlug: "acme-studio",
          }}
          inspectVideo={vi.fn().mockResolvedValue({ durationSeconds: 30 })}
        />,
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Record or upload a video" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
      fireEvent.click(
        await screen.findByRole("button", { name: "Stop recording" }),
      );

      expect(screen.getByText("recorded-testimonial.webm")).toBeVisible();
      expect(stopTrack).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      expect(await screen.findByText("About you")).toBeVisible();
    } finally {
      vi.unstubAllGlobals();
      if (originalMediaDevices) {
        Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
      } else {
        delete (navigator as { mediaDevices?: unknown }).mediaDevices;
      }
    }
  });

  it("stops active camera and microphone tracks when leaving the video step", async () => {
    const stopTrack = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream;
    const originalMediaDevices = Object.getOwnPropertyDescriptor(
      navigator,
      "mediaDevices",
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    class Recorder {
      mimeType = "video/webm";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      state: RecordingState = "inactive";
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", Recorder);
    try {
      render(
        <CollectionFormShellView
          brand={{
            collectionFormDescription: "Tell us what changed.",
            collectionFormTitle: "Share your Acme story",
            logoUrl: null,
            name: "Acme Studio",
            primaryColor: "#123abc",
            privacyContact: "privacy@acme.example",
            publicSlug: "acme-studio",
          }}
        />,
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Record or upload a video" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
      await screen.findByRole("button", { name: "Stop recording" });
      fireEvent.click(screen.getByRole("button", { name: "Back" }));

      expect(stopTrack).toHaveBeenCalledTimes(1);
      expect(
        screen.getByRole("button", { name: "Send a text testimonial" }),
      ).toBeVisible();
    } finally {
      vi.unstubAllGlobals();
      if (originalMediaDevices) {
        Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
      } else {
        delete (navigator as { mediaDevices?: unknown }).mediaDevices;
      }
    }
  });
});
