import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrowserVideoRecorder } from "./browser-video-recorder";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("BrowserVideoRecorder", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("opens a live preview and exposes the available camera and microphone", async () => {
    const stream = {
      getTracks: () => [],
      getVideoTracks: () => [{ getSettings: () => ({ deviceId: "camera-1" }) }],
      getAudioTracks: () => [
        { getSettings: () => ({ deviceId: "microphone-1" }) },
      ],
    } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const enumerateDevices = vi.fn().mockResolvedValue([
      { deviceId: "camera-1", kind: "videoinput", label: "FaceTime HD Camera" },
      {
        deviceId: "microphone-1",
        kind: "audioinput",
        label: "MacBook Microphone",
      },
    ]);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { enumerateDevices, getUserMedia },
    });

    render(
      <BrowserVideoRecorder
        onFileChange={vi.fn()}
        onRecordingChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));

    expect(await screen.findByLabelText("Camera preview")).toBeVisible();
    expect(screen.getByLabelText("Camera")).toHaveValue("camera-1");
    expect(screen.getByLabelText("Microphone")).toHaveValue("microphone-1");
    expect(
      screen.getByRole("option", { name: "FaceTime HD Camera" }),
    ).toBeVisible();
    expect(
      screen.getByRole("option", { name: "MacBook Microphone" }),
    ).toBeVisible();
    await waitFor(() => expect(enumerateDevices).toHaveBeenCalledTimes(1));
  });

  it("shows live microphone activity without announcing every level change", async () => {
    const stream = {
      getTracks: () => [],
      getVideoTracks: () => [{ getSettings: () => ({ deviceId: "camera-1" }) }],
      getAudioTracks: () => [
        { getSettings: () => ({ deviceId: "microphone-1" }) },
      ],
    } as unknown as MediaStream;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    });
    const disconnect = vi.fn();
    vi.stubGlobal(
      "AudioContext",
      class {
        close = vi.fn();
        createAnalyser() {
          return {
            disconnect,
            fftSize: 32,
            getFloatTimeDomainData(samples: Float32Array) {
              samples.fill(0.16);
            },
          };
        }
        createMediaStreamSource() {
          return { connect: vi.fn(), disconnect };
        }
      },
    );
    vi.useFakeTimers();

    render(
      <BrowserVideoRecorder
        onFileChange={vi.fn()}
        onRecordingChange={vi.fn()}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => vi.advanceTimersByTime(100));

    expect(
      (
        screen.getByLabelText(
          "Microphone level: sound detected",
        ) as HTMLMeterElement
      ).value,
    ).toBeGreaterThan(0);
    expect(
      screen
        .getAllByTestId("microphone-level-bar")
        .some((bar) => bar.getAttribute("data-active") === "true"),
    ).toBe(true);
  });

  it("warns without blocking when the microphone stays silent", async () => {
    const stream = {
      getTracks: () => [],
      getVideoTracks: () => [{ getSettings: () => ({ deviceId: "camera-1" }) }],
      getAudioTracks: () => [
        { getSettings: () => ({ deviceId: "microphone-1" }) },
      ],
    } as unknown as MediaStream;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    });
    vi.stubGlobal(
      "AudioContext",
      class {
        close = vi.fn();
        createAnalyser() {
          return {
            disconnect: vi.fn(),
            fftSize: 32,
            getFloatTimeDomainData(samples: Float32Array) {
              samples.fill(0);
            },
          };
        }
        createMediaStreamSource() {
          return { connect: vi.fn(), disconnect: vi.fn() };
        }
      },
    );
    vi.useFakeTimers();

    render(
      <BrowserVideoRecorder
        onFileChange={vi.fn()}
        onRecordingChange={vi.fn()}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => vi.advanceTimersByTime(5_100));

    expect(screen.getByRole("status")).toHaveTextContent(
      "No sound detected. Check your microphone.",
    );
    expect(
      screen.getByRole("button", { name: "Start recording" }),
    ).toBeEnabled();
  });

  it("reopens the preview with the selected devices and releases replaced tracks", async () => {
    const stopOldTracks = vi.fn();
    const makeStream = (
      cameraId: string,
      microphoneId: string,
      stop = vi.fn(),
    ) =>
      ({
        getTracks: () => [{ stop }, { stop }],
        getVideoTracks: () => [{ getSettings: () => ({ deviceId: cameraId }) }],
        getAudioTracks: () => [
          { getSettings: () => ({ deviceId: microphoneId }) },
        ],
      }) as unknown as MediaStream;
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(
        makeStream("camera-1", "microphone-1", stopOldTracks),
      )
      .mockResolvedValueOnce(makeStream("camera-2", "microphone-1"));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([
          {
            deviceId: "camera-1",
            kind: "videoinput",
            label: "Built-in Camera",
          },
          { deviceId: "camera-2", kind: "videoinput", label: "Studio Camera" },
          {
            deviceId: "microphone-1",
            kind: "audioinput",
            label: "USB Microphone",
          },
        ]),
        getUserMedia,
      },
    });

    render(
      <BrowserVideoRecorder
        onFileChange={vi.fn()}
        onRecordingChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
    await screen.findByLabelText("Camera");
    fireEvent.change(screen.getByLabelText("Camera"), {
      target: { value: "camera-2" },
    });

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(getUserMedia).toHaveBeenLastCalledWith({
      audio: { deviceId: { exact: "microphone-1" } },
      video: {
        deviceId: { exact: "camera-2" },
        height: { ideal: 720, max: 1080 },
        width: { ideal: 1280, max: 1920 },
      },
    });
    expect(stopOldTracks).toHaveBeenCalledTimes(2);
  });

  it("discards stale and post-unmount preview requests", async () => {
    const stopStale = vi.fn();
    const stopLatest = vi.fn();
    const makeStream = (
      cameraId: string,
      microphoneId: string,
      stop = vi.fn(),
    ) =>
      ({
        getTracks: () => [{ stop }],
        getVideoTracks: () => [{ getSettings: () => ({ deviceId: cameraId }) }],
        getAudioTracks: () => [
          { getSettings: () => ({ deviceId: microphoneId }) },
        ],
      }) as unknown as MediaStream;
    const staleRequest = deferred<MediaStream>();
    const latestRequest = deferred<MediaStream>();
    const afterUnmountRequest = deferred<MediaStream>();
    const getUserMedia = vi
      .fn()
      .mockResolvedValueOnce(makeStream("camera-1", "microphone-1"))
      .mockReturnValueOnce(staleRequest.promise)
      .mockReturnValueOnce(latestRequest.promise)
      .mockReturnValueOnce(afterUnmountRequest.promise);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([
          {
            deviceId: "camera-1",
            kind: "videoinput",
            label: "Built-in Camera",
          },
          { deviceId: "camera-2", kind: "videoinput", label: "Studio Camera" },
          {
            deviceId: "microphone-1",
            kind: "audioinput",
            label: "Built-in Mic",
          },
          { deviceId: "microphone-2", kind: "audioinput", label: "Studio Mic" },
        ]),
        getUserMedia,
      },
    });

    const { unmount } = render(
      <BrowserVideoRecorder
        onFileChange={vi.fn()}
        onRecordingChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
    await screen.findByLabelText("Camera");
    fireEvent.change(screen.getByLabelText("Camera"), {
      target: { value: "camera-2" },
    });
    fireEvent.change(screen.getByLabelText("Microphone"), {
      target: { value: "microphone-2" },
    });
    const latestStream = makeStream("camera-2", "microphone-2", stopLatest);
    latestRequest.resolve(latestStream);
    await waitFor(() =>
      expect(screen.getByLabelText("Camera preview")).toHaveProperty(
        "srcObject",
        latestStream,
      ),
    );
    staleRequest.resolve(makeStream("camera-2", "microphone-1", stopStale));
    await waitFor(() => expect(stopStale).toHaveBeenCalledTimes(1));
    expect(stopLatest).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Camera preview")).toHaveProperty(
      "srcObject",
      latestStream,
    );

    fireEvent.change(screen.getByLabelText("Camera"), {
      target: { value: "camera-1" },
    });
    unmount();
    const stopAfterUnmount = vi.fn();
    afterUnmountRequest.resolve(
      makeStream("camera-1", "microphone-2", stopAfterUnmount),
    );
    await waitFor(() => expect(stopAfterUnmount).toHaveBeenCalledTimes(1));
  });

  it("stops a newly acquired stream when device enumeration fails", async () => {
    const stopTrack = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi
          .fn()
          .mockRejectedValue(new Error("device list failed")),
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    });

    render(
      <BrowserVideoRecorder
        onFileChange={vi.fn()}
        onRecordingChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Camera or microphone access was refused",
    );
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });

  it("records with a timer, then requires review before using the video", async () => {
    const stopTrack = vi.fn();
    const stream = {
      getTracks: () => [{ stop: stopTrack }],
      getVideoTracks: () => [{ getSettings: () => ({ deviceId: "camera-1" }) }],
      getAudioTracks: () => [
        { getSettings: () => ({ deviceId: "microphone-1" }) },
      ],
    } as unknown as MediaStream;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([
          { deviceId: "camera-1", kind: "videoinput", label: "Camera" },
          { deviceId: "microphone-1", kind: "audioinput", label: "Microphone" },
        ]),
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
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
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:recording"),
      revokeObjectURL: vi.fn(),
    });
    const onFileChange = vi.fn();
    const onRecordingChange = vi.fn();

    render(
      <BrowserVideoRecorder
        onFileChange={onFileChange}
        onRecordingChange={onRecordingChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
    await screen.findByRole("button", { name: "Start recording" });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));
    expect(screen.getByRole("timer")).toHaveTextContent("00:00");
    await act(async () => vi.advanceTimersByTime(2_000));
    expect(screen.getByRole("timer")).toHaveTextContent("00:02");

    fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
    expect(screen.getByLabelText("Recorded video preview")).toBeVisible();
    expect(onFileChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Use this recording" }));

    expect(onFileChange).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "recorded-testimonial.webm",
        type: "video/webm",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Record again" }));
    expect(onFileChange).toHaveBeenLastCalledWith(undefined);
    expect(onRecordingChange).toHaveBeenCalledWith(true);
    expect(onRecordingChange).toHaveBeenLastCalledWith(false);
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });

  it("stops recording automatically at the two-minute limit", async () => {
    const stream = {
      getTracks: () => [],
      getVideoTracks: () => [{ getSettings: () => ({ deviceId: "camera-1" }) }],
      getAudioTracks: () => [
        { getSettings: () => ({ deviceId: "microphone-1" }) },
      ],
    } as unknown as MediaStream;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    });
    const stopRecorder = vi.fn();
    class Recorder {
      mimeType = "video/webm";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      state: RecordingState = "inactive";
      start() {
        this.state = "recording";
      }
      stop() {
        stopRecorder();
        this.state = "inactive";
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", Recorder);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:recording"),
      revokeObjectURL: vi.fn(),
    });
    render(
      <BrowserVideoRecorder
        onFileChange={vi.fn()}
        onRecordingChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
    await screen.findByRole("button", { name: "Start recording" });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));

    await act(async () => vi.advanceTimersByTime(120_000));

    expect(stopRecorder).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Recorded video preview")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Stop recording" })).toBeNull();
  });

  it("keeps the preview usable when recording cannot start", async () => {
    const stream = {
      getTracks: () => [],
      getVideoTracks: () => [{ getSettings: () => ({ deviceId: "camera-1" }) }],
      getAudioTracks: () => [
        { getSettings: () => ({ deviceId: "microphone-1" }) },
      ],
    } as unknown as MediaStream;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    });
    vi.stubGlobal(
      "MediaRecorder",
      class {
        mimeType = "video/webm";
        ondataavailable = null;
        onerror = null;
        onstop = null;
        state: RecordingState = "inactive";
        start() {
          throw new Error("recorder unavailable");
        }
        stop() {}
      },
    );

    render(
      <BrowserVideoRecorder
        onFileChange={vi.fn()}
        onRecordingChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Start recording" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Recording stopped unexpectedly",
    );
    expect(
      screen.getByRole("button", { name: "Start recording" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Camera preview")).toHaveProperty(
      "srcObject",
      stream,
    );
  });

  it("recovers the preview after an in-progress recorder error", async () => {
    const stream = {
      getTracks: () => [],
      getVideoTracks: () => [{ getSettings: () => ({ deviceId: "camera-1" }) }],
      getAudioTracks: () => [
        { getSettings: () => ({ deviceId: "microphone-1" }) },
      ],
    } as unknown as MediaStream;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    });
    let recorderError: (() => void) | null = null;
    class Recorder {
      mimeType = "video/webm";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      state: RecordingState = "inactive";
      set onerror(handler: ((event: Event) => void) | null) {
        recorderError = handler ? () => handler(new Event("error")) : null;
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", Recorder);

    render(
      <BrowserVideoRecorder
        onFileChange={vi.fn()}
        onRecordingChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open camera" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Start recording" }),
    );
    act(() => recorderError?.());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Recording stopped unexpectedly",
    );
    expect(
      screen.getByRole("button", { name: "Start recording" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Recorded video preview")).toBeNull();
  });
});
