"use client";

import { useEffect, useRef, useState } from "react";

import { uploadDirectVideo } from "@/lib/video-upload";

export type VideoUploadPhase = "idle" | "uploading" | "processing";

export type VideoUploadReservation = {
  provider: "fake" | "mux";
  uploadUrl: string;
  release: () => Promise<unknown>;
};

type UploadRequest<R extends VideoUploadReservation> = {
  file: File;
  reserve: () => Promise<R>;
  upload?: typeof uploadDirectVideo;
  confirm?: (reservation: R) => Promise<unknown>;
  retainOnConfirmationError?: (error: unknown) => boolean;
};

const cancelledMessage = "Video upload cancelled.";
const cleanupFailureMessage =
  "The upload stopped, but its reservation could not be released. Refresh before trying again.";

/** Owns one upload attempt, including a reservation retained after uncertain confirmation. */
export function useVideoUpload<R extends VideoUploadReservation>() {
  const [phase, setPhase] = useState<VideoUploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [hasReservation, setHasReservation] = useState(false);
  const active = useRef<AbortController | null>(null);
  const retained = useRef<R | null>(null);

  useEffect(() => {
    if (phase === "idle") return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [phase]);

  useEffect(() => () => active.current?.abort(), []);

  async function run(request: UploadRequest<R>): Promise<boolean> {
    if (active.current) return false;
    const controller = new AbortController();
    active.current = controller;
    let reservation = retained.current;
    let confirming = false;
    setPhase(reservation ? "processing" : "uploading");
    try {
      if (!reservation) {
        setProgress(0);
        reservation = await request.reserve();
        setHasReservation(true);
        if (controller.signal.aborted) throw new Error(cancelledMessage);
        await (request.upload ?? uploadDirectVideo)(request.file, {
          onProgress: (value) => {
            if (!controller.signal.aborted && active.current === controller) {
              setProgress(value);
            }
          },
          provider: reservation.provider,
          uploadUrl: reservation.uploadUrl,
          signal: controller.signal,
        });
        if (controller.signal.aborted) throw new Error(cancelledMessage);
        setProgress(100);
      }
      setPhase("processing");
      confirming = true;
      await request.confirm?.(reservation);
      retained.current = null;
      setHasReservation(false);
      return true;
    } catch (error) {
      if (reservation) {
        if (confirming && request.retainOnConfirmationError?.(error)) {
          retained.current = reservation;
        } else {
          retained.current = null;
          setHasReservation(false);
          try {
            await reservation.release();
          } catch {
            throw new Error(cleanupFailureMessage);
          }
        }
      }
      if (
        controller.signal.aborted &&
        error instanceof Error &&
        error.message === cancelledMessage
      ) {
        return false;
      }
      throw error;
    } finally {
      active.current = null;
      setPhase("idle");
    }
  }

  return {
    run,
    cancel: () => active.current?.abort(),
    phase,
    progress,
    hasReservation,
    uploading: phase !== "idle",
  };
}
