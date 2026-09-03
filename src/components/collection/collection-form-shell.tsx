"use client";

import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { CheckCircle2, MessageSquareText, Star, Video } from "lucide-react";
import Image from "next/image";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { buildPublicationConsent } from "@convex/domain/submission";
import {
  normalizeVideoMimeType,
  supportedVideoMimeTypes,
} from "@convex/domain/video";
import { BrandMark } from "@/components/brand-mark";
import { TurnstileChallenge } from "@/components/collection/turnstile-challenge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadProfileImage } from "@/lib/upload-profile-image";
import { inspectVideoFile } from "@/lib/video-file";
import { uploadDirectVideo } from "@/lib/video-upload";
import { browserTurnstile } from "@/lib/turnstile-browser";

type PublicBrand = {
  collectionFormDescription: string;
  collectionFormTitle: string;
  logoUrl: string | null;
  name: string;
  primaryColor: string;
  privacyContact: string;
  publicSlug: string;
};

type TextSubmissionInput = {
  ageConfirmed: boolean;
  avatarReservationId?: Id<"submissionAvatarUploads">;
  avatarStorageId?: Id<"_storage">;
  clientSubmissionId: string;
  company?: string;
  consentAccepted: boolean;
  consentText: string;
  consentVersion: string;
  publicSlug: string;
  rating?: number;
  role?: string;
  submitterEmail: string;
  submitterName: string;
  text: string;
  turnstileToken?: string;
};

type SubmissionResult = {
  moderationStatus: "pending";
  testimonialId: Id<"testimonials"> | string;
};

type VideoDirectUploadInput = {
  clientSubmissionId: string;
  fileSizeBytes: number;
  mimeType: string;
  publicSlug: string;
  spokenLanguage: "en" | "fr";
  turnstileToken?: string;
};

type VideoDirectUploadResult = {
  expiresAt: number;
  provider: "fake" | "mux";
  reservationId: Id<"videoReservations">;
  uploadUrl: string;
};

type VideoSubmissionInput = Omit<TextSubmissionInput, "text"> & {
  durationSeconds: number;
  reservationId: Id<"videoReservations">;
};

type VideoSubmissionResult = SubmissionResult & {
  processingStatus: "awaiting_upload" | "processing" | "ready" | "failed";
};

const fieldClassName =
  "h-4 w-4 shrink-0 accent-(--brand-accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-accent)";

function ReplacementLinkRequest({
  publicSlug,
  requestReplacementLink,
}: {
  publicSlug: string;
  requestReplacementLink?: (input: {
    email: string;
    publicSlug: string;
  }) => Promise<unknown>;
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  async function requestLink() {
    if (!email || submitting) return;
    setSubmitting(true);
    try {
      if (requestReplacementLink) {
        await requestReplacementLink({ email, publicSlug });
      }
      setAccepted(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 border-t pt-5">
      <div>
        <p className="text-sm font-medium">Already submitted?</p>
        <p className="text-muted-foreground mt-1 text-xs leading-5">
          Enter the original email to receive a new private management link.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="Original submission email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
        <Button
          disabled={!email || submitting}
          onClick={() => void requestLink()}
          type="button"
          variant="outline"
        >
          {submitting ? "Requesting…" : "Email new link"}
        </Button>
      </div>
      {accepted ? (
        <p className="text-muted-foreground text-xs" role="status">
          If that email matches a submission, a new link is on its way.
        </p>
      ) : null}
    </div>
  );
}

function BrandHeader({ brand }: { brand: PublicBrand }) {
  return (
    <CardHeader className="items-center text-center">
      {brand.logoUrl ? (
        <Image
          alt={`${brand.name} logo`}
          className="size-14 rounded-2xl object-cover"
          height={56}
          src={brand.logoUrl}
          unoptimized
          width={56}
        />
      ) : (
        <BrandMark className="size-14 rounded-2xl" />
      )}
      <p className="text-muted-foreground text-sm font-medium">{brand.name}</p>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {brand.collectionFormTitle}
      </h1>
      <p className="text-muted-foreground max-w-md text-sm leading-6">
        {brand.collectionFormDescription}
      </p>
    </CardHeader>
  );
}

function StepLabel({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-3" aria-label={`Step ${step} of 4`}>
      <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
        Step {step} of 4
      </p>
      <div className="bg-muted h-1 flex-1 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full bg-(--brand-accent) transition-[width]"
          style={{ width: `${step * 25}%` }}
        />
      </div>
    </div>
  );
}

function VideoStep({
  error,
  onBack,
  onContinue,
  onFileChange,
  onLanguageChange,
  onStartRecording,
  onStopRecording,
  recording,
  recordingSupported,
  spokenLanguage,
  validating,
  videoFile,
}: {
  error: string | null;
  onBack: () => void;
  onContinue: () => void;
  onFileChange: (file: File | undefined) => void;
  onLanguageChange: (language: "en" | "fr") => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  recording: boolean;
  recordingSupported: boolean;
  spokenLanguage: "en" | "fr";
  validating: boolean;
  videoFile: File | undefined;
}) {
  return (
    <section className="space-y-5" aria-labelledby="add-video">
      <div>
        <h2 id="add-video" className="text-lg font-semibold">
          Add your video
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Import an MP4, MOV or WebM file up to 2 minutes. It uploads directly
          to our video processor after you confirm.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="testimonial-video">Import video</Label>
        <Input
          accept="video/mp4,video/quicktime,video/webm"
          id="testimonial-video"
          onChange={(event) => onFileChange(event.target.files?.[0])}
          type="file"
        />
        {videoFile ? (
          <p className="text-muted-foreground text-xs">{videoFile.name}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="spoken-language">Spoken language</Label>
        <select
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-3"
          id="spoken-language"
          onChange={(event) =>
            onLanguageChange(event.target.value as "en" | "fr")
          }
          value={spokenLanguage}
        >
          <option value="en">English</option>
          <option value="fr">French</option>
        </select>
        <p className="text-muted-foreground text-xs">
          Used to generate captions. Caption failure will not block your video.
        </p>
      </div>
      {recordingSupported ? (
        <div className="rounded-xl border p-4">
          <p className="text-sm font-medium">Record in this browser</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Camera and microphone permission are requested only after you start.
          </p>
          <Button
            className="mt-3"
            onClick={recording ? onStopRecording : onStartRecording}
            type="button"
            variant="outline"
          >
            {recording ? "Stop recording" : "Start recording"}
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
          Recording isn&apos;t supported here. You can still import a video or
          go back and send text.
        </p>
      )}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button onClick={onBack} type="button" variant="outline">
          Back
        </Button>
        <Button
          className="flex-1 bg-(--brand-accent) text-white hover:opacity-90"
          disabled={!videoFile || validating || recording}
          onClick={onContinue}
          type="button"
        >
          {validating ? "Checking video…" : "Continue"}
        </Button>
      </div>
    </section>
  );
}

function ProofTypeStep({
  onText,
  onVideo,
  textAvailable,
  videoAvailable,
}: {
  onText: () => void;
  onVideo: () => void;
  textAvailable: boolean;
  videoAvailable: boolean;
}) {
  if (!textAvailable && !videoAvailable) {
    return (
      <section className="space-y-2 text-center" aria-live="polite">
        <h2 className="text-lg font-semibold">
          Collection is temporarily closed
        </h2>
        <p className="text-muted-foreground text-sm">
          This Brand is not accepting new testimonials right now.
        </p>
      </section>
    );
  }
  return (
    <section className="space-y-4" aria-labelledby="choose-proof-type">
      <div>
        <h2 id="choose-proof-type" className="text-lg font-semibold">
          What would you like to share?
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose one format. Nothing is saved until you confirm.
        </p>
      </div>
      <button
        aria-label="Send a text testimonial"
        className="flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-accent) enabled:hover:border-(--brand-accent) disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!textAvailable}
        onClick={onText}
        type="button"
      >
        <span className="grid size-11 place-items-center rounded-xl bg-(--brand-accent) text-white">
          <MessageSquareText className="size-5" />
        </span>
        <span>
          <span className="block font-medium">Send a text testimonial</span>
          <span className="text-muted-foreground text-sm">
            {textAvailable
              ? "Write 20 to 2,000 characters"
              : "Text testimonials are currently unavailable"}
          </span>
        </span>
      </button>
      <button
        aria-label="Record or upload a video"
        className="flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-accent) enabled:hover:border-(--brand-accent) disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!videoAvailable}
        onClick={onVideo}
        type="button"
      >
        <span className="grid size-11 place-items-center rounded-xl bg-(--brand-accent) text-white">
          <Video className="size-5" />
        </span>
        <span>
          <span className="block font-medium">Record or upload a video</span>
          <span className="text-muted-foreground text-sm">
            {videoAvailable
              ? "Up to 2 minutes"
              : "Video testimonials are currently unavailable"}
          </span>
        </span>
      </button>
    </section>
  );
}

function TextStep({
  onBack,
  onChange,
  onContinue,
  text,
  textLength,
  valid,
}: {
  onBack: () => void;
  onChange: (value: string) => void;
  onContinue: () => void;
  text: string;
  textLength: number;
  valid: boolean;
}) {
  return (
    <section className="space-y-4" aria-labelledby="write-testimonial">
      <div>
        <h2 id="write-testimonial" className="text-lg font-semibold">
          Tell your story
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          A specific outcome or before-and-after is most useful.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="testimonial-text">Your testimonial</Label>
        <textarea
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-40 w-full resize-y rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          id="testimonial-text"
          maxLength={2_000}
          onChange={(event) => onChange(event.target.value)}
          placeholder="What changed for you?"
          value={text}
        />
        <div className="flex justify-between text-xs">
          <span
            className={
              textLength > 0 && textLength < 20
                ? "text-destructive"
                : "text-muted-foreground"
            }
          >
            Minimum 20 characters
          </span>
          <span className="text-muted-foreground">{textLength} / 2,000</span>
        </div>
      </div>
      <div className="flex gap-3">
        <Button onClick={onBack} type="button" variant="outline">
          Back
        </Button>
        <Button
          className="flex-1 bg-(--brand-accent) text-white hover:opacity-90"
          disabled={!valid}
          onClick={onContinue}
          type="button"
        >
          Continue
        </Button>
      </div>
    </section>
  );
}

function SuccessStep({
  brandName,
  email,
  proofType,
  videoUploaded,
}: {
  brandName: string;
  email: string;
  proofType: "text" | "video";
  videoUploaded: boolean;
}) {
  return (
    <section className="space-y-4 py-2 text-center">
      <CheckCircle2 className="mx-auto size-12 text-(--brand-accent)" />
      <div>
        <h2 className="text-xl font-semibold">Thank you for your proof</h2>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          {proofType === "video"
            ? `Your video is processing and remains Pending private review by ${brandName}.`
            : `Your testimonial is Pending private review by ${brandName}.`}{" "}
          Check {email} for your private management link. Delivery can take a
          moment.
        </p>
        {proofType === "video" && videoUploaded ? (
          <p className="text-muted-foreground mt-2 text-xs">
            Upload complete. Processing and captions continue in the background.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function IdentityStep({
  ageConfirmed,
  avatar,
  consentAccepted,
  consentText,
  email,
  error,
  identityValid,
  name,
  onAgeConfirmedChange,
  onAvatarChange,
  onBack,
  onCompanyChange,
  onConsentAcceptedChange,
  onEmailChange,
  onNameChange,
  onRatingChange,
  onRoleChange,
  onSubmit,
  rating,
  role,
  company,
  submitting,
  videoSelectionLocked,
  botChallenge,
  botVerificationReady,
}: {
  ageConfirmed: boolean;
  avatar: File | undefined;
  company: string;
  consentAccepted: boolean;
  consentText: string;
  email: string;
  error: string | null;
  identityValid: boolean;
  name: string;
  onAgeConfirmedChange: (value: boolean) => void;
  onAvatarChange: (file: File) => void;
  onBack: () => void;
  onCompanyChange: (value: string) => void;
  onConsentAcceptedChange: (value: boolean) => void;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onRatingChange: (value: number) => void;
  onRoleChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  rating: number | undefined;
  role: string;
  submitting: boolean;
  videoSelectionLocked: boolean;
  botChallenge?: ReactNode;
  botVerificationReady: boolean;
}) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div>
        <h2 className="text-lg font-semibold">About you</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Your email stays private and is used for your management link.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="submitter-name">Your name</Label>
          <Input
            autoComplete="name"
            id="submitter-name"
            onChange={(event) => onNameChange(event.target.value)}
            required
            value={name}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="submitter-email">Email address</Label>
          <Input
            autoComplete="email"
            id="submitter-email"
            onChange={(event) => onEmailChange(event.target.value)}
            required
            type="email"
            value={email}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="submitter-role">Role</Label>
          <Input
            id="submitter-role"
            maxLength={100}
            onChange={(event) => onRoleChange(event.target.value)}
            placeholder="Optional"
            value={role}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="submitter-company">Company</Label>
          <Input
            id="submitter-company"
            maxLength={100}
            onChange={(event) => onCompanyChange(event.target.value)}
            placeholder="Optional"
            value={company}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="submitter-avatar">Photo (optional)</Label>
        <Input
          accept="image/png,image/jpeg,image/webp"
          id="submitter-avatar"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file && file.size <= 5 * 1024 * 1024) onAvatarChange(file);
          }}
          type="file"
        />
        {avatar ? (
          <p className="text-muted-foreground text-xs">{avatar.name}</p>
        ) : null}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Rating (optional)</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <label className="cursor-pointer p-1" key={value}>
              <input
                checked={rating === value}
                className="sr-only"
                name="rating"
                onChange={() => onRatingChange(value)}
                type="radio"
                value={value}
              />
              <span className="sr-only">{value} stars</span>
              <Star
                aria-hidden="true"
                className={
                  rating !== undefined && value <= rating
                    ? "size-6 fill-amber-400 text-amber-400"
                    : "text-muted-foreground size-6"
                }
              />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="bg-muted/50 space-y-4 rounded-xl border p-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            checked={ageConfirmed}
            className={fieldClassName}
            onChange={(event) => onAgeConfirmedChange(event.target.checked)}
            type="checkbox"
          />
          <span>I confirm that I am at least 18 years old.</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            checked={consentAccepted}
            className={fieldClassName}
            onChange={(event) => onConsentAcceptedChange(event.target.checked)}
            type="checkbox"
          />
          <span>I give Publication Consent.</span>
        </label>
        <p className="text-muted-foreground text-xs leading-5">{consentText}</p>
      </div>
      {botChallenge}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button
          disabled={videoSelectionLocked}
          onClick={onBack}
          title={
            videoSelectionLocked
              ? "Retry submission before changing the uploaded video."
              : undefined
          }
          type="button"
          variant="outline"
        >
          Back
        </Button>
        <Button
          className="flex-1 bg-(--brand-accent) text-white hover:opacity-90"
          disabled={
            !identityValid ||
            !ageConfirmed ||
            !consentAccepted ||
            !botVerificationReady ||
            submitting
          }
          type="submit"
        >
          {submitting ? "Submitting…" : "Submit testimonial"}
        </Button>
      </div>
    </form>
  );
}

function isDefinitiveVideoUploadFailure(error: unknown) {
  const serialized =
    error instanceof Error ? `${error.message} ${JSON.stringify(error)}` : "";
  return ["VIDEO_RESERVATION_UNAVAILABLE", "VIDEO_ASSET_UNAVAILABLE"].some(
    (code) => serialized.includes(code),
  );
}

async function submitCollectionForm(input: {
  ageConfirmed: boolean;
  avatar: File | undefined;
  brand: PublicBrand;
  botToken?: string;
  cancelVideo: (input: {
    clientSubmissionId: string;
    reservationId: Id<"videoReservations">;
  }) => Promise<unknown>;
  clientSubmissionId: string;
  company: string;
  consent: ReturnType<typeof buildPublicationConsent>;
  consentAccepted: boolean;
  createDirectUpload: (
    input: VideoDirectUploadInput,
  ) => Promise<VideoDirectUploadResult>;
  event: FormEvent<HTMLFormElement>;
  identityValid: boolean;
  proofType: "text" | "video";
  rating: number | undefined;
  role: string;
  setError: (value: string | null) => void;
  setStep: (value: 1 | 2 | 3 | 4) => void;
  setSubmitting: (value: boolean) => void;
  setVideoProgress: (value: number) => void;
  setVideoReservationId: (value: Id<"videoReservations"> | undefined) => void;
  resetBotVerification?: () => void;
  spokenLanguage: "en" | "fr";
  submitText: (input: TextSubmissionInput) => Promise<SubmissionResult>;
  submitVideo: (input: VideoSubmissionInput) => Promise<VideoSubmissionResult>;
  submitterEmail: string;
  submitterName: string;
  text: string;
  textValid: boolean;
  uploadAvatar?: (
    file: File,
    clientSubmissionId: string,
  ) => Promise<{
    reservationId: Id<"submissionAvatarUploads">;
    storageId: Id<"_storage">;
  }>;
  uploadVideo: (
    file: File,
    input: {
      onProgress: (progress: number) => void;
      provider: "fake" | "mux";
      uploadUrl: string;
    },
  ) => Promise<void>;
  videoDurationSeconds: number | undefined;
  videoFile: File | undefined;
  videoReservationId: Id<"videoReservations"> | undefined;
}) {
  input.event.preventDefault();
  if (
    !input.identityValid ||
    !input.ageConfirmed ||
    !input.consentAccepted ||
    (input.proofType === "text"
      ? !input.textValid
      : !input.videoFile || !input.videoDurationSeconds)
  ) {
    return;
  }
  input.setSubmitting(true);
  input.setError(null);
  let videoReservationId = input.videoReservationId;
  let videoSubmissionAttempted = false;
  try {
    const avatarUpload =
      input.avatar && input.uploadAvatar
        ? await input.uploadAvatar(input.avatar, input.clientSubmissionId)
        : undefined;
    const identity = {
      ageConfirmed: input.ageConfirmed,
      avatarReservationId: avatarUpload?.reservationId,
      avatarStorageId: avatarUpload?.storageId,
      clientSubmissionId: input.clientSubmissionId,
      company: input.company.trim() || undefined,
      consentAccepted: input.consentAccepted,
      consentText: input.consent.text,
      consentVersion: input.consent.version,
      publicSlug: input.brand.publicSlug,
      rating: input.rating,
      role: input.role.trim() || undefined,
      submitterEmail: input.submitterEmail.trim(),
      submitterName: input.submitterName.trim(),
    };
    if (input.proofType === "text") {
      await input.submitText({
        ...identity,
        text: input.text.trim(),
        ...(input.botToken ? { turnstileToken: input.botToken } : {}),
      });
    } else if (input.videoFile && input.videoDurationSeconds) {
      if (!videoReservationId) {
        const directUpload = await input.createDirectUpload({
          clientSubmissionId: input.clientSubmissionId,
          fileSizeBytes: input.videoFile.size,
          mimeType: input.videoFile.type,
          publicSlug: input.brand.publicSlug,
          spokenLanguage: input.spokenLanguage,
          ...(input.botToken ? { turnstileToken: input.botToken } : {}),
        });
        videoReservationId = directUpload.reservationId;
        input.setVideoReservationId(videoReservationId);
        await input.uploadVideo(input.videoFile, {
          onProgress: input.setVideoProgress,
          provider: directUpload.provider,
          uploadUrl: directUpload.uploadUrl,
        });
      }
      videoSubmissionAttempted = true;
      await input.submitVideo({
        ...identity,
        durationSeconds: input.videoDurationSeconds,
        reservationId: videoReservationId,
      });
    }
    input.setStep(4);
  } catch (submissionError) {
    if (
      videoReservationId &&
      (!videoSubmissionAttempted ||
        isDefinitiveVideoUploadFailure(submissionError))
    ) {
      await input
        .cancelVideo({
          clientSubmissionId: input.clientSubmissionId,
          reservationId: videoReservationId,
        })
        .catch(() => undefined);
      input.setVideoReservationId(undefined);
    }
    input.setError(
      submissionError instanceof Error
        ? submissionError.message
        : "Your testimonial could not be submitted. Please try again.",
    );
  } finally {
    input.resetBotVerification?.();
    input.setSubmitting(false);
  }
}

async function continueWithSelectedVideo(input: {
  file: File | undefined;
  inspect: (file: File) => Promise<{ durationSeconds: number }>;
  setDuration: (duration: number) => void;
  setError: (error: string | null) => void;
  setStep: (step: 1 | 2 | 3 | 4) => void;
  setValidating: (validating: boolean) => void;
}) {
  if (!input.file) return;
  input.setValidating(true);
  input.setError(null);
  try {
    if (
      !(supportedVideoMimeTypes as readonly string[]).includes(
        normalizeVideoMimeType(input.file.type),
      )
    ) {
      throw new Error("Choose an MP4, MOV or WebM video.");
    }
    const metadata = await input.inspect(input.file);
    input.setDuration(metadata.durationSeconds);
    input.setStep(3);
  } catch (videoError) {
    input.setError(
      videoError instanceof Error
        ? videoError.message
        : "This video could not be read.",
    );
  } finally {
    input.setValidating(false);
  }
}

async function startBrowserRecording(input: {
  recorderRef: { current: MediaRecorder | null };
  recordingSupported: boolean;
  setError: (error: string | null) => void;
  setFile: (file: File) => void;
  setRecording: (recording: boolean) => void;
  streamRef: { current: MediaStream | null };
}) {
  if (!input.recordingSupported) return;
  input.setError(null);
  let stream: MediaStream | null = null;
  try {
    const acquiredStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    stream = acquiredStream;
    const recorder = new MediaRecorder(acquiredStream);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const type = normalizeVideoMimeType(recorder.mimeType || "video/webm");
      input.setFile(
        new File(
          chunks,
          `recorded-testimonial.${type.includes("mp4") ? "mp4" : "webm"}`,
          { type },
        ),
      );
      acquiredStream.getTracks().forEach((track) => track.stop());
      input.streamRef.current = null;
      input.recorderRef.current = null;
      input.setRecording(false);
    };
    input.streamRef.current = acquiredStream;
    input.recorderRef.current = recorder;
    recorder.start();
    input.setRecording(true);
  } catch {
    stream?.getTracks().forEach((track) => track.stop());
    input.streamRef.current?.getTracks().forEach((track) => track.stop());
    input.streamRef.current = null;
    input.recorderRef.current = null;
    input.setRecording(false);
    input.setError(
      "Camera or microphone access was refused. You can still import a video or send text.",
    );
  }
}

function stopBrowserRecording(recorder: MediaRecorder | null) {
  if (recorder?.state === "recording") recorder.stop();
}

function discardBrowserRecording(input: {
  recorderRef: { current: MediaRecorder | null };
  setRecording?: (recording: boolean) => void;
  streamRef: { current: MediaStream | null };
}) {
  const recorder = input.recorderRef.current;
  if (recorder) {
    recorder.ondataavailable = null;
    recorder.onstop = null;
    if (recorder.state === "recording") recorder.stop();
  }
  input.streamRef.current?.getTracks().forEach((track) => track.stop());
  input.recorderRef.current = null;
  input.streamRef.current = null;
  input.setRecording?.(false);
}

type InitialCollectionValues = Partial<{
  ageConfirmed: boolean;
  company: string;
  consentAccepted: boolean;
  rating: number;
  role: string;
  submitterEmail: string;
  submitterName: string;
  text: string;
}>;

function normalizeInitialValues(values?: InitialCollectionValues) {
  return {
    ageConfirmed: values?.ageConfirmed ?? false,
    company: values?.company ?? "",
    consentAccepted: values?.consentAccepted ?? false,
    rating: values?.rating,
    role: values?.role ?? "",
    submitterEmail: values?.submitterEmail ?? "",
    submitterName: values?.submitterName ?? "",
    text: values?.text ?? "",
  };
}

function supportsBrowserRecording() {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined"
  );
}

function hasValidIdentity(name: string, email: string) {
  return (
    name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  );
}

function buildConsentForForm(input: {
  avatar: File | undefined;
  brand: PublicBrand;
  company: string;
  name: string;
  rating: number | undefined;
  role: string;
}) {
  return buildPublicationConsent({
    brandName: input.brand.name,
    privacyContact: input.brand.privacyContact,
    suppliedIdentity: {
      avatarSupplied: input.avatar !== undefined,
      company: input.company.trim() || undefined,
      name: input.name.trim() || "your name",
      rating: input.rating,
      role: input.role.trim() || undefined,
    },
  });
}

export function CollectionFormShellView({
  availability = { textAvailable: true, videoAvailable: true },
  brand,
  cancelVideo = async () => undefined,
  createDirectUpload = async () => {
    throw new Error("Video upload is unavailable in this preview.");
  },
  initialStep = 1,
  initialProofType = "text",
  initialValues,
  requestReplacementLink,
  submitText = async () => {
    throw new Error("Submission is unavailable in this preview.");
  },
  submitVideo = async () => {
    throw new Error("Video submission is unavailable in this preview.");
  },
  uploadAvatar,
  uploadVideo = uploadDirectVideo,
  inspectVideo = inspectVideoFile,
  botChallenge,
  botToken,
  resetBotVerification,
}: {
  availability?: { textAvailable: boolean; videoAvailable: boolean };
  brand: PublicBrand;
  cancelVideo?: (input: {
    clientSubmissionId: string;
    reservationId: Id<"videoReservations">;
  }) => Promise<unknown>;
  createDirectUpload?: (
    input: VideoDirectUploadInput,
  ) => Promise<VideoDirectUploadResult>;
  initialStep?: 1 | 2 | 3 | 4;
  initialProofType?: "text" | "video";
  initialValues?: InitialCollectionValues;
  requestReplacementLink?: (input: {
    email: string;
    publicSlug: string;
  }) => Promise<unknown>;
  submitText?: (input: TextSubmissionInput) => Promise<SubmissionResult>;
  submitVideo?: (input: VideoSubmissionInput) => Promise<VideoSubmissionResult>;
  uploadAvatar?: (
    file: File,
    clientSubmissionId: string,
  ) => Promise<{
    reservationId: Id<"submissionAvatarUploads">;
    storageId: Id<"_storage">;
  }>;
  uploadVideo?: (
    file: File,
    input: {
      onProgress: (progress: number) => void;
      provider: "fake" | "mux";
      uploadUrl: string;
    },
  ) => Promise<void>;
  inspectVideo?: (file: File) => Promise<{ durationSeconds: number }>;
  botChallenge?: ReactNode;
  botToken?: string;
  resetBotVerification?: () => void;
}) {
  const normalizedInitialValues = normalizeInitialValues(initialValues);
  const [step, setStep] = useState(initialStep);
  const [proofType, setProofType] = useState<"text" | "video">(
    initialProofType,
  );
  const [clientSubmissionId] = useState(() => crypto.randomUUID());
  const [text, setText] = useState(normalizedInitialValues.text);
  const [submitterName, setSubmitterName] = useState(
    normalizedInitialValues.submitterName,
  );
  const [submitterEmail, setSubmitterEmail] = useState(
    normalizedInitialValues.submitterEmail,
  );
  const [role, setRole] = useState(normalizedInitialValues.role);
  const [company, setCompany] = useState(normalizedInitialValues.company);
  const [rating, setRating] = useState<number | undefined>(
    normalizedInitialValues.rating,
  );
  const [avatar, setAvatar] = useState<File | undefined>();
  const [videoFile, setVideoFile] = useState<File | undefined>();
  const [videoReservationId, setVideoReservationId] = useState<
    Id<"videoReservations"> | undefined
  >();
  const videoDurationSecondsRef = useRef<number | undefined>(undefined);
  const [spokenLanguage, setSpokenLanguage] = useState<"en" | "fr">("en");
  const [videoProgress, setVideoProgress] = useState(0);
  const [validatingVideo, setValidatingVideo] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  useEffect(
    () => () =>
      discardBrowserRecording({ recorderRef, streamRef: recordingStreamRef }),
    [],
  );
  const [ageConfirmed, setAgeConfirmed] = useState(
    normalizedInitialValues.ageConfirmed,
  );
  const [consentAccepted, setConsentAccepted] = useState(
    normalizedInitialValues.consentAccepted,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recordingSupported = supportsBrowserRecording();
  const textLength = Array.from(text.trim()).length;
  const textValid = textLength >= 20 && textLength <= 2_000;
  const identityValid = hasValidIdentity(submitterName, submitterEmail);
  const consent = buildConsentForForm({
    avatar,
    brand,
    company,
    name: submitterName,
    rating,
    role,
  });

  return (
    <main
      className="bg-muted/30 grid min-h-svh place-items-center px-4 py-8 sm:px-5 sm:py-12"
      style={{ "--brand-accent": brand.primaryColor } as CSSProperties}
    >
      <Card className="w-full max-w-xl overflow-hidden shadow-xl shadow-black/5">
        <div className="h-1.5 bg-(--brand-accent)" />
        <BrandHeader brand={brand} />
        <CardContent className="space-y-6">
          <StepLabel step={step} />

          {step === 1 ? (
            <ProofTypeStep
              onText={() => {
                setProofType("text");
                setStep(2);
              }}
              onVideo={() => {
                setProofType("video");
                setStep(2);
              }}
              textAvailable={availability.textAvailable}
              videoAvailable={availability.videoAvailable}
            />
          ) : null}

          {step === 2 && proofType === "text" ? (
            <TextStep
              onBack={() => setStep(1)}
              onChange={setText}
              onContinue={() => setStep(3)}
              text={text}
              textLength={textLength}
              valid={textValid}
            />
          ) : null}

          {step === 2 && proofType === "video" ? (
            <VideoStep
              error={error}
              onBack={() => {
                discardBrowserRecording({
                  recorderRef,
                  setRecording,
                  streamRef: recordingStreamRef,
                });
                setStep(1);
              }}
              onContinue={() =>
                void continueWithSelectedVideo({
                  file: videoFile,
                  inspect: inspectVideo,
                  setDuration: (duration) => {
                    videoDurationSecondsRef.current = duration;
                  },
                  setError,
                  setStep,
                  setValidating: setValidatingVideo,
                })
              }
              onFileChange={(file) => {
                setVideoFile(file);
                videoDurationSecondsRef.current = undefined;
                setError(null);
              }}
              onLanguageChange={setSpokenLanguage}
              onStartRecording={() =>
                void startBrowserRecording({
                  recorderRef,
                  recordingSupported,
                  setError,
                  setFile: setVideoFile,
                  setRecording,
                  streamRef: recordingStreamRef,
                })
              }
              onStopRecording={() => stopBrowserRecording(recorderRef.current)}
              recording={recording}
              recordingSupported={recordingSupported}
              spokenLanguage={spokenLanguage}
              validating={validatingVideo}
              videoFile={videoFile}
            />
          ) : null}

          {step === 3 ? (
            <IdentityStep
              ageConfirmed={ageConfirmed}
              botChallenge={botChallenge}
              botVerificationReady={
                botChallenge === undefined || Boolean(botToken)
              }
              avatar={avatar}
              company={company}
              consentAccepted={consentAccepted}
              consentText={consent.text}
              email={submitterEmail}
              error={error}
              identityValid={identityValid}
              name={submitterName}
              onAgeConfirmedChange={setAgeConfirmed}
              onAvatarChange={setAvatar}
              onBack={() => setStep(2)}
              onCompanyChange={setCompany}
              onConsentAcceptedChange={setConsentAccepted}
              onEmailChange={setSubmitterEmail}
              onNameChange={setSubmitterName}
              onRatingChange={setRating}
              onRoleChange={setRole}
              onSubmit={(event) =>
                void submitCollectionForm({
                  ageConfirmed,
                  avatar,
                  brand,
                  botToken,
                  cancelVideo,
                  clientSubmissionId,
                  company,
                  consent,
                  consentAccepted,
                  createDirectUpload,
                  event,
                  identityValid,
                  proofType,
                  rating,
                  role,
                  setError,
                  setStep,
                  setSubmitting,
                  setVideoProgress,
                  setVideoReservationId,
                  resetBotVerification,
                  spokenLanguage,
                  submitText,
                  submitVideo,
                  submitterEmail,
                  submitterName,
                  text,
                  textValid,
                  uploadAvatar,
                  uploadVideo,
                  videoDurationSeconds: videoDurationSecondsRef.current,
                  videoFile,
                  videoReservationId,
                })
              }
              rating={rating}
              role={role}
              submitting={submitting}
              videoSelectionLocked={
                proofType === "video" && videoReservationId !== undefined
              }
            />
          ) : null}

          {step === 4 ? (
            <SuccessStep
              brandName={brand.name}
              email={submitterEmail.trim()}
              proofType={proofType}
              videoUploaded={videoProgress > 0}
            />
          ) : null}

          <p className="text-muted-foreground text-center text-xs">
            Read the{" "}
            <a
              className="underline underline-offset-2"
              href={`/c/${encodeURIComponent(brand.publicSlug)}/privacy`}
            >
              privacy notice
            </a>
            .
          </p>
          <ReplacementLinkRequest
            publicSlug={brand.publicSlug}
            requestReplacementLink={requestReplacementLink}
          />
        </CardContent>
      </Card>
    </main>
  );
}

export function CollectionFormShell({ publicSlug }: { publicSlug: string }) {
  const brand = useQuery(api.organizations.getByPublicSlug, { publicSlug });
  const availability = useQuery(api.collectionQuotas.getPublicAvailability, {
    publicSlug,
  });
  const submitText = useAction(api.submissions.submitText);
  const createDirectUpload = useAction(api.video.createDirectUpload);
  const submitVideo = useAction(api.video.submit);
  const cancelVideo = useMutation(api.video.cancelUpload);
  const generateAvatarUploadUrl = useMutation(
    api.submissions.generateAvatarUploadUrl,
  );
  const registerAvatarUpload = useMutation(
    api.submissions.registerAvatarUpload,
  );
  const requestReplacementLink = useAction(
    api.submissionManagement.requestReplacementLink,
  );
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [turnstileWidgetId, setTurnstileWidgetId] = useState<string>();

  if (brand === undefined || availability === undefined) {
    return (
      <main className="bg-muted/30 grid min-h-svh place-items-center px-5">
        <p className="text-muted-foreground text-sm" role="status">
          Loading Collection Form…
        </p>
      </main>
    );
  }
  if (brand === null || availability === null) {
    return (
      <main className="bg-muted/30 grid min-h-svh place-items-center px-5 text-center">
        <div>
          <h1 className="text-2xl font-semibold">
            Collection Form unavailable
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Check the address with the Brand that shared it.
          </p>
        </div>
      </main>
    );
  }
  return (
    <CollectionFormShellView
      availability={availability}
      brand={brand}
      botChallenge={
        <TurnstileChallenge
          onToken={setTurnstileToken}
          onWidget={setTurnstileWidgetId}
        />
      }
      botToken={turnstileToken}
      cancelVideo={cancelVideo}
      createDirectUpload={createDirectUpload}
      requestReplacementLink={requestReplacementLink}
      resetBotVerification={() => {
        if (turnstileWidgetId) browserTurnstile()?.reset(turnstileWidgetId);
        setTurnstileToken(undefined);
      }}
      submitText={submitText}
      submitVideo={submitVideo}
      uploadAvatar={async (file, clientSubmissionId) => {
        const { reservationId, uploadUrl } = await generateAvatarUploadUrl({
          clientSubmissionId,
          publicSlug,
        });
        const storageId = await uploadProfileImage(file, uploadUrl);
        await registerAvatarUpload({ reservationId, storageId });
        return { reservationId, storageId };
      }}
    />
  );
}
