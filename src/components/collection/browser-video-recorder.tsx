"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from "react";
import { Camera, Check, Circle, Mic, RotateCcw, Square } from "lucide-react";

import { normalizeVideoMimeType } from "@convex/domain/video";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type RecorderDevice = Pick<MediaDeviceInfo, "deviceId" | "kind" | "label">;
type RecorderState = {
  audioLevel: number;
  cameraId: string;
  devices: RecorderDevice[];
  elapsedSeconds: number;
  error: string | null;
  microphoneId: string;
  noSoundDetected: boolean;
  previewReady: boolean;
  recordedFile: File | null;
  recording: boolean;
};
type RecorderUpdate =
  Partial<RecorderState> | ((state: RecorderState) => Partial<RecorderState>);

function initialRecorderState(visualFixture: boolean): RecorderState {
  return {
    audioLevel: visualFixture ? 0.58 : 0,
    cameraId: visualFixture ? "fixture-camera" : "",
    devices: visualFixture
      ? [
          {
            deviceId: "fixture-camera",
            kind: "videoinput",
            label: "FaceTime HD Camera",
          },
          {
            deviceId: "fixture-microphone",
            kind: "audioinput",
            label: "MacBook Microphone",
          },
        ]
      : [],
    elapsedSeconds: 0,
    error: null,
    microphoneId: visualFixture ? "fixture-microphone" : "",
    noSoundDetected: false,
    previewReady: visualFixture,
    recordedFile: null,
    recording: false,
  };
}

function updateRecorderState(state: RecorderState, update: RecorderUpdate) {
  return {
    ...state,
    ...(typeof update === "function" ? update(state) : update),
  };
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function formatElapsedTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function BrowserVideoRecorder({
  onFileChange,
  onRecordingChange,
  visualFixture = false,
}: {
  onFileChange: (file: File | undefined) => void;
  onRecordingChange: (recording: boolean) => void;
  visualFixture?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioMeterRef = useRef<{
    analyser: AnalyserNode;
    context: AudioContext;
    intervalId: number;
    source: MediaStreamAudioSourceNode;
  } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | undefined>(undefined);
  const autoStopRef = useRef<number | undefined>(undefined);
  const previewRequestRef = useRef(0);
  const mountedRef = useRef(true);
  const [state, setState] = useReducer(
    updateRecorderState,
    visualFixture,
    initialRecorderState,
  );
  const {
    audioLevel,
    cameraId,
    devices,
    elapsedSeconds,
    error,
    microphoneId,
    noSoundDetected,
    previewReady,
    recordedFile,
    recording,
  } = state;

  const stopAudioMeter = useCallback(() => {
    const meter = audioMeterRef.current;
    if (!meter) return;
    window.clearInterval(meter.intervalId);
    meter.source.disconnect();
    meter.analyser.disconnect();
    void Promise.resolve(meter.context.close()).catch(() => undefined);
    audioMeterRef.current = null;
  }, []);

  const startAudioMeter = useCallback(
    (stream: MediaStream) => {
      stopAudioMeter();
      if (typeof AudioContext === "undefined" || !stream.getAudioTracks()[0]) {
        setState({ audioLevel: 0, noSoundDetected: false });
        return;
      }
      try {
        const context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        let silenceStartedAt = Date.now();
        const sampleLevel = () => {
          analyser.getFloatTimeDomainData(samples);
          const rms = Math.sqrt(
            samples.reduce((sum, sample) => sum + sample * sample, 0) /
              samples.length,
          );
          const level = Math.min(1, rms * 6);
          const soundDetected = level >= 0.08;
          if (soundDetected) silenceStartedAt = Date.now();
          setState({
            audioLevel: level,
            noSoundDetected:
              !soundDetected && Date.now() - silenceStartedAt >= 5_000,
          });
        };
        sampleLevel();
        audioMeterRef.current = {
          analyser,
          context,
          intervalId: window.setInterval(sampleLevel, 100),
          source,
        };
      } catch {
        setState({ audioLevel: 0, noSoundDetected: false });
      }
    },
    [stopAudioMeter],
  );
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !recordedFile) return;
    const objectUrl = URL.createObjectURL(recordedFile);
    video.src = objectUrl;
    return () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
    };
  }, [recordedFile]);

  const openPreview = useCallback(
    async (selection?: { cameraId?: string; microphoneId?: string }) => {
      const requestId = ++previewRequestRef.current;
      setState({ error: null });
      let acquiredStream: MediaStream | null = null;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: selection?.microphoneId
            ? { deviceId: { exact: selection.microphoneId } }
            : true,
          video: {
            ...(selection?.cameraId
              ? { deviceId: { exact: selection.cameraId } }
              : {}),
            height: { ideal: 720, max: 1080 },
            width: { ideal: 1280, max: 1920 },
          },
        });
        acquiredStream = stream;
        const availableDevices =
          await navigator.mediaDevices.enumerateDevices();
        if (!mountedRef.current || requestId !== previewRequestRef.current) {
          stopStream(stream);
          acquiredStream = null;
          return null;
        }
        stopAudioMeter();
        stopStream(streamRef.current);
        streamRef.current = stream;
        startAudioMeter(stream);
        acquiredStream = null;
        if (videoRef.current) videoRef.current.srcObject = stream;

        setState({
          cameraId: stream.getVideoTracks()[0]?.getSettings().deviceId ?? "",
          devices: availableDevices,
          microphoneId:
            stream.getAudioTracks()[0]?.getSettings().deviceId ?? "",
          previewReady: true,
        });
        return stream;
      } catch {
        stopStream(acquiredStream);
        if (!mountedRef.current || requestId !== previewRequestRef.current) {
          return null;
        }
        stopAudioMeter();
        stopStream(streamRef.current);
        streamRef.current = null;
        setState({
          error:
            "Camera or microphone access was refused. You can still upload a video.",
          previewReady: false,
        });
        return null;
      }
    },
    [startAudioMeter, stopAudioMeter],
  );

  const stopRecording = useCallback(() => {
    window.clearInterval(timerRef.current);
    window.clearTimeout(autoStopRef.current);
    timerRef.current = undefined;
    autoStopRef.current = undefined;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const startRecording = useCallback(async () => {
    setState({ error: null });
    let stream = streamRef.current;
    if (!stream) {
      stream = await openPreview({ cameraId, microphoneId });
    }
    if (!stream) return;

    setState({ elapsedSeconds: 0, recordedFile: null });
    chunksRef.current = [];

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      setState({
        error:
          "Recording could not start. Check your camera and microphone, then try again.",
      });
      return;
    }
    const clearRecordingTimers = () => {
      window.clearInterval(timerRef.current);
      window.clearTimeout(autoStopRef.current);
      timerRef.current = undefined;
      autoStopRef.current = undefined;
    };
    const failRecording = () => {
      clearRecordingTimers();
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state === "recording") {
        try {
          recorder.stop();
        } catch {
          // The browser has already made this recorder unusable.
        }
      }
      recorderRef.current = null;
      setState({
        error:
          "Recording stopped unexpectedly. Check your camera and microphone, then try again.",
        recording: false,
      });
      onRecordingChange(false);
    };
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onerror = failRecording;
    recorder.onstop = () => {
      clearRecordingTimers();
      const type = normalizeVideoMimeType(recorder.mimeType || "video/webm");
      const file = new File(
        chunksRef.current,
        `recorded-testimonial.${type.includes("mp4") ? "mp4" : "webm"}`,
        { type },
      );
      setState({
        audioLevel: 0,
        noSoundDetected: false,
        previewReady: false,
        recordedFile: file,
        recording: false,
      });
      stopStream(stream);
      stopAudioMeter();
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      recorderRef.current = null;
      onRecordingChange(false);
    };
    try {
      recorder.start();
    } catch {
      failRecording();
      return;
    }
    setState({ recording: true });
    onRecordingChange(true);
    timerRef.current = window.setInterval(
      () =>
        setState((current) => ({
          elapsedSeconds: Math.min(current.elapsedSeconds + 1, 120),
        })),
      1_000,
    );
    autoStopRef.current = window.setTimeout(stopRecording, 120_000);
  }, [
    cameraId,
    microphoneId,
    onRecordingChange,
    openPreview,
    stopAudioMeter,
    stopRecording,
  ]);

  const recordAgain = useCallback(async () => {
    setState({ elapsedSeconds: 0, recordedFile: null });
    onFileChange(undefined);
    if (videoRef.current) videoRef.current.srcObject = null;
    await openPreview({ cameraId, microphoneId });
  }, [cameraId, microphoneId, onFileChange, openPreview]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      previewRequestRef.current += 1;
      window.clearInterval(timerRef.current);
      window.clearTimeout(autoStopRef.current);
      if (recorderRef.current) {
        recorderRef.current.ondataavailable = null;
        recorderRef.current.onstop = null;
        recorderRef.current.onerror = null;
        if (recorderRef.current.state === "recording")
          recorderRef.current.stop();
      }
      stopStream(streamRef.current);
      stopAudioMeter();
      onRecordingChange(false);
    };
  }, [onRecordingChange, stopAudioMeter]);

  const cameras = devices.filter((device) => device.kind === "videoinput");
  const microphones = devices.filter((device) => device.kind === "audioinput");

  return (
    <RecorderView
      cameraId={cameraId}
      cameras={cameras}
      elapsedSeconds={elapsedSeconds}
      audioLevel={audioLevel}
      error={error}
      microphoneId={microphoneId}
      microphones={microphones}
      noSoundDetected={noSoundDetected}
      onCameraChange={(nextCameraId) => {
        setState({ cameraId: nextCameraId });
        void openPreview({ cameraId: nextCameraId, microphoneId });
      }}
      onFileChange={onFileChange}
      onMicrophoneChange={(nextMicrophoneId) => {
        setState({ microphoneId: nextMicrophoneId });
        void openPreview({ cameraId, microphoneId: nextMicrophoneId });
      }}
      onOpenPreview={() => void openPreview()}
      onRecordAgain={() => void recordAgain()}
      onStartRecording={() => void startRecording()}
      onStopRecording={stopRecording}
      previewReady={previewReady}
      recordedFile={recordedFile}
      recording={recording}
      videoRef={videoRef}
    />
  );
}

function RecorderView({
  audioLevel,
  cameraId,
  cameras,
  elapsedSeconds,
  error,
  microphoneId,
  microphones,
  noSoundDetected,
  onCameraChange,
  onFileChange,
  onMicrophoneChange,
  onOpenPreview,
  onRecordAgain,
  onStartRecording,
  onStopRecording,
  previewReady,
  recordedFile,
  recording,
  videoRef,
}: {
  audioLevel: number;
  cameraId: string;
  cameras: RecorderDevice[];
  elapsedSeconds: number;
  error: string | null;
  microphoneId: string;
  microphones: RecorderDevice[];
  noSoundDetected: boolean;
  onCameraChange: (deviceId: string) => void;
  onFileChange: (file: File | undefined) => void;
  onMicrophoneChange: (deviceId: string) => void;
  onOpenPreview: () => void;
  onRecordAgain: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  previewReady: boolean;
  recordedFile: File | null;
  recording: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  return (
    <div className="bg-card space-y-4 rounded-2xl border p-3 shadow-sm">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-950">
        <video
          aria-label={
            recordedFile ? "Recorded video preview" : "Camera preview"
          }
          autoPlay={!recordedFile}
          className="h-full w-full object-cover"
          controls={Boolean(recordedFile)}
          muted={!recordedFile}
          playsInline
          ref={videoRef}
        />
        {!previewReady && !recordedFile ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="space-y-3">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-white/10 text-white">
                <Camera aria-hidden="true" className="size-5" />
              </div>
              <div>
                <p className="font-medium text-white">Check your framing</p>
                <p className="mt-1 text-xs leading-5 text-white/65">
                  Preview your camera and microphone before recording.
                </p>
              </div>
              <Button onClick={onOpenPreview} type="button">
                Open camera
              </Button>
            </div>
          </div>
        ) : null}
        {previewReady ? (
          <>
            <div className="absolute top-3 right-3 flex gap-2 text-white">
              <span
                aria-label="Camera on"
                className="grid size-9 place-items-center rounded-full bg-black/55"
                role="img"
                title="Camera on"
              >
                <Camera aria-hidden="true" className="size-4" />
              </span>
              <span className="flex h-9 items-center gap-2 rounded-full bg-black/55 px-2.5">
                <Mic aria-hidden="true" className="size-4" />
                <meter
                  aria-label={`Microphone level: ${audioLevel >= 0.08 ? "sound detected" : "quiet"}`}
                  className="sr-only"
                  max={100}
                  min={0}
                  value={Math.round(audioLevel * 100)}
                />
                <span
                  aria-hidden="true"
                  className="flex h-5 items-end gap-0.5"
                  title="Microphone level"
                >
                  {[0.12, 0.28, 0.44, 0.6, 0.76, 0.92].map(
                    (threshold, index) => {
                      const active = audioLevel >= threshold;
                      return (
                        <span
                          className={`w-1 rounded-full transition-colors duration-100 ${
                            active
                              ? audioLevel >= 0.85
                                ? "bg-orange-400"
                                : "bg-emerald-400"
                              : "bg-white/25"
                          }`}
                          data-active={active}
                          data-testid="microphone-level-bar"
                          key={threshold}
                          style={{ height: `${7 + index * 2}px` }}
                        />
                      );
                    },
                  )}
                </span>
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-4 pt-12 pb-4 text-white">
              <span
                aria-live="off"
                className="font-mono text-sm tabular-nums"
                role="timer"
              >
                {formatElapsedTime(elapsedSeconds)}
              </span>
              <Button
                aria-label={recording ? "Stop recording" : "Start recording"}
                className="size-14 rounded-full border-4 border-white bg-red-500 p-0 text-white hover:bg-red-600"
                onClick={recording ? onStopRecording : onStartRecording}
                size="icon-lg"
                type="button"
              >
                {recording ? (
                  <Square aria-hidden="true" className="size-5 fill-current" />
                ) : (
                  <Circle aria-hidden="true" className="size-7 fill-current" />
                )}
              </Button>
              <span className="w-11 text-right text-xs text-white/70">
                2:00 max
              </span>
            </div>
          </>
        ) : null}
      </div>

      {previewReady && noSoundDetected ? (
        <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
          No sound detected. Check your microphone.
        </p>
      ) : null}

      {previewReady && !recording ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-2" htmlFor="video-camera">
              <Camera aria-hidden="true" className="size-4" /> Camera
            </Label>
            <select
              className="border-input bg-background h-11 w-full rounded-md border px-3 text-sm"
              id="video-camera"
              onChange={(event) => onCameraChange(event.target.value)}
              value={cameraId}
            >
              {cameras.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label
              className="flex items-center gap-2"
              htmlFor="video-microphone"
            >
              <Mic aria-hidden="true" className="size-4" /> Microphone
            </Label>
            <select
              className="border-input bg-background h-11 w-full rounded-md border px-3 text-sm"
              id="video-microphone"
              onChange={(event) => onMicrophoneChange(event.target.value)}
              value={microphoneId}
            >
              {microphones.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {recordedFile ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="flex-1"
            onClick={onRecordAgain}
            type="button"
            variant="outline"
          >
            <RotateCcw aria-hidden="true" /> Record again
          </Button>
          <Button
            className="flex-1 bg-(--brand-accent) text-white hover:opacity-90"
            onClick={() => onFileChange(recordedFile)}
            type="button"
          >
            <Check aria-hidden="true" /> Use this recording
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
