"use client";

import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  IconCheck,
  IconMessage2,
  IconStar,
  IconVideo,
} from "@tabler/icons-react";
import Image from "next/image";

import { uploadTestimonialImages } from "@/lib/upload-testimonial-images";
import { TestimonialImagesInput } from "@/components/testimonials/testimonial-images-input";
import type { TestimonialImage } from "@convex/domain/testimonialImage";
import { TestimonialEditor } from "@/components/testimonials/testimonial-editor";
import type { TestimonialRichText } from "@convex/domain/testimonialRichText";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { buildPublicationConsent } from "@convex/domain/submission";
import {
  normalizeVideoMimeType,
  supportedVideoMimeTypes,
} from "@convex/domain/video";
import { BrowserVideoRecorder } from "@/components/collection/browser-video-recorder";
import { TurnstileChallenge } from "@/components/collection/turnstile-challenge";
import { VideoUploadProgress } from "@/components/collection/video-upload-progress";
import { Sparkle, WallFrames } from "@/components/doodles";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorToast, SuccessToast } from "@/components/ui/error-toast";
import { Field, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClientSubmissionId } from "@/lib/client-submission-id";
import { accentInk } from "@/lib/color-contrast";
import { cn } from "@/lib/utils";
import { uploadProfileImage } from "@/lib/upload-profile-image";
import { inspectVideoFile } from "@/lib/video-file";
import {
  useVideoUpload,
  type VideoUploadReservation,
  type VideoUploadPhase,
} from "@/hooks/use-video-upload";
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

type SubmissionIdentityInput = {
  ageConfirmed: boolean;
  avatarReservationId?: Id<"submissionAvatarUploads">;
  avatarStorageId?: Id<"_storage">;
  clientSubmissionId: string;
  company?: string;
  consentAccepted: boolean;
  consentText: string;
  consentVersion: string;
  rating?: number;
  role?: string;
  submitterEmail: string;
  submitterName: string;
};

type TextSubmissionInput = SubmissionIdentityInput & {
  imageIds?: Id<"testimonialImages">[];
  publicSlug: string;
  text: string;
  richText?: TestimonialRichText;
  turnstileToken?: string;
};

type SubmissionResult = {
  moderationStatus: "pending";
  testimonialId: Id<"testimonials"> | string;
};

type VideoDirectUploadInput = {
  clientSubmissionId: string;
  dimensions?: { height: number; width: number };
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

type VideoSubmissionInput = SubmissionIdentityInput & {
  durationSeconds: number;
  reservationId: Id<"videoReservations">;
};

type VideoSubmissionResult = SubmissionResult & {
  processingStatus: "awaiting_upload" | "processing" | "ready" | "failed";
};

const accentButtonClassName =
  "flex-1 bg-(--brand-accent) text-(--brand-accent-ink) hover:opacity-90";

const stepTitles = ["Choose a format", "Your story", "About you", "Done"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function subscribeToBrowserCapabilities() {
  return () => undefined;
}

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
  const [error, setError] = useState<string | null>(null);

  async function requestLink() {
    if (!email || submitting) return;
    setSubmitting(true);
    setAccepted(false);
    setError(null);
    try {
      if (requestReplacementLink) {
        await requestReplacementLink({ email, publicSlug });
      }
      setAccepted(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to request a new management link.",
      );
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
      {error ? <ErrorToast message={error} /> : null}
      {accepted ? (
        <SuccessToast message="If that email matches a submission, a new link is on its way." />
      ) : null}
    </div>
  );
}

function BrandPanel({ brand, step }: { brand: PublicBrand; step: number }) {
  return (
    <aside
      className="px-5 py-8 sm:px-8 lg:flex lg:min-h-svh lg:flex-col lg:justify-between lg:px-12 lg:py-12 xl:px-16"
      style={{
        background: "color-mix(in srgb, var(--brand-accent) 8%, var(--paper))",
      }}
    >
      <div className="flex items-center gap-3">
        {brand.logoUrl ? (
          <Image
            alt={`${brand.name} logo`}
            className="size-12 rounded-xl object-cover"
            height={48}
            src={brand.logoUrl}
            unoptimized
            width={48}
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-xl text-base font-semibold"
            style={{
              background: "var(--brand-accent)",
              color: "var(--brand-accent-ink)",
            }}
          >
            {initials(brand.name) || "GP"}
          </span>
        )}
        <p className="text-ink text-sm font-semibold tracking-[-0.008em]">
          {brand.name}
        </p>
      </div>
      <div className="mt-6 max-w-md space-y-3 lg:mt-0">
        <h1 className="font-display text-[2rem] leading-9 font-extrabold tracking-[-0.03em] text-balance lg:text-[2.5rem] lg:leading-[2.75rem]">
          {brand.collectionFormTitle}
        </h1>
        <p className="type-body text-ink-2">
          {brand.collectionFormDescription}
        </p>
        <ol aria-label="Steps" className="hidden pt-4 lg:block">
          {stepTitles.map((title, index) => {
            const number = index + 1;
            const state =
              number < step ? "done" : number === step ? "current" : "todo";
            return (
              <li
                aria-current={state === "current" ? "step" : undefined}
                className="flex items-center gap-3 py-1.5 text-sm"
                key={title}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                    state === "todo" && "border-line-2 text-ink-3 border",
                  )}
                  style={
                    state === "todo"
                      ? undefined
                      : {
                          background: "var(--brand-accent)",
                          color: "var(--brand-accent-ink)",
                        }
                  }
                >
                  {state === "done" ? (
                    <IconCheck aria-hidden="true" className="size-3.5" />
                  ) : (
                    number
                  )}
                </span>
                <span
                  className={
                    state === "current"
                      ? "text-ink font-semibold"
                      : "text-ink-2"
                  }
                >
                  {title}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="type-small text-ink-2 hidden lg:block">
        Your details stay private. Nothing is published without your consent.
      </p>
    </aside>
  );
}

function StepLabel({ step }: { step: number }) {
  return (
    <div aria-label={`Step ${step} of 4`} className="flex items-center gap-3">
      <p className="type-micro text-ink-2 shrink-0">Step {step} of 4</p>
      <div className="flex flex-1 items-center gap-1.5">
        {[1, 2, 3, 4].map((number) => (
          <span
            className="bg-surface-2 h-1.5 flex-1 rounded-full transition-colors duration-200"
            key={number}
            style={
              number <= step ? { background: "var(--brand-accent)" } : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

function VideoStep({
  error,
  onBack,
  onContinue,
  onFileChange,
  onRecordingChange,
  recorderVisualFixture,
  recording,
  recordingSupported,
  validating,
  videoFile,
}: {
  error: string | null;
  onBack: () => void;
  onContinue: () => void;
  onFileChange: (file: File | undefined) => void;
  onRecordingChange: (recording: boolean) => void;
  recorderVisualFixture?: boolean;
  recording: boolean;
  recordingSupported: boolean;
  validating: boolean;
  videoFile: File | undefined;
}) {
  return (
    <section className="space-y-5" aria-labelledby="add-video">
      <div>
        <h2 className="type-subheading" id="add-video">
          Record your story
        </h2>
        <p className="text-ink-2 mt-1 text-sm">
          Up to 2 minutes. Review or retake before sending.
        </p>
      </div>
      <div className="bg-surface-2 rounded-lg border p-4 text-sm">
        <p className="font-medium">A simple story works best</p>
        <ul className="text-ink-2 mt-2 space-y-1 text-xs leading-5">
          <li>What was happening before?</li>
          <li>What changed after working with us?</li>
          <li>What would you tell someone considering it?</li>
        </ul>
      </div>
      {recordingSupported ? (
        <BrowserVideoRecorder
          onFileChange={onFileChange}
          onRecordingChange={onRecordingChange}
          visualFixture={recorderVisualFixture}
        />
      ) : (
        <p className="bg-surface-2 text-ink-2 rounded-lg border p-4 text-sm">
          Recording isn&apos;t supported here. You can still upload a video or
          go back and send text.
        </p>
      )}
      <div className="relative py-1" aria-hidden="true">
        <div className="border-t" />
        <span className="bg-background text-ink-2 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 text-xs font-semibold tracking-[0.06em] uppercase">
          or
        </span>
      </div>
      <Field>
        <Label htmlFor="testimonial-video">Upload a video</Label>
        <Input
          accept="video/mp4,video/quicktime,video/webm"
          data-step-focus
          id="testimonial-video"
          onChange={(event) => onFileChange(event.target.files?.[0])}
          type="file"
        />
        <FieldDescription>
          MP4, MOV or WebM, up to 2 minutes. Your file uploads only after you
          confirm.
        </FieldDescription>
        {videoFile ? (
          <p className="text-xs font-medium">Selected: {videoFile.name}</p>
        ) : null}
      </Field>
      {error ? <ErrorToast message={error} /> : null}
      <div className="flex gap-3">
        <Button onClick={onBack} type="button" variant="outline">
          Back
        </Button>
        <Button
          className={accentButtonClassName}
          disabled={!videoFile || recording}
          loading={validating}
          onClick={onContinue}
          type="button"
        >
          Continue
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
      <section aria-live="polite">
        <EmptyState
          className="py-6"
          description="This Brand is not accepting new testimonials right now."
          illustration={<WallFrames className="h-28" draw />}
          headingLevel={2}
          title="Collection is temporarily closed"
        />
      </section>
    );
  }
  return (
    <section className="space-y-4" aria-labelledby="choose-proof-type">
      <div>
        <h2 className="type-subheading" id="choose-proof-type">
          What would you like to share?
        </h2>
        <p className="text-ink-2 mt-1 text-sm">
          Choose one format. Nothing is saved until you confirm.
        </p>
      </div>
      <button
        aria-label="Send a text testimonial"
        data-step-focus
        className="bg-surface flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-[border-color,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-accent) enabled:hover:border-(--brand-accent) disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!textAvailable}
        onClick={onText}
        type="button"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-(--brand-accent) text-(--brand-accent-ink)">
          <IconMessage2 aria-hidden="true" className="size-5" />
        </span>
        <span>
          <span className="block font-medium">Send a text testimonial</span>
          <span className="text-ink-2 text-sm">
            {textAvailable
              ? "Write 20 to 2,000 characters"
              : "Text testimonials are currently unavailable"}
          </span>
        </span>
      </button>
      <button
        aria-label="Record or upload a video"
        className="bg-surface flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-[border-color,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-accent) enabled:hover:border-(--brand-accent) disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!videoAvailable}
        onClick={onVideo}
        type="button"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-(--brand-accent) text-(--brand-accent-ink)">
          <IconVideo aria-hidden="true" className="size-5" />
        </span>
        <span>
          <span className="block font-medium">Record or upload a video</span>
          <span className="text-ink-2 text-sm">
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
  richText,
  imageFiles,
  onImageFilesChange,
  valid,
}: {
  onBack: () => void;
  onChange: (value: string, richText: TestimonialRichText) => void;
  imageFiles: File[];
  onImageFilesChange: (files: File[]) => void;
  onContinue: () => void;
  text: string;
  richText?: TestimonialRichText;
  textLength: number;
  valid: boolean;
}) {
  return (
    <section className="space-y-4" aria-labelledby="write-testimonial">
      <div>
        <h2 className="type-subheading" id="write-testimonial">
          Tell your story
        </h2>
        <p className="text-ink-2 mt-1 text-sm">
          A specific outcome or before-and-after is most useful.
        </p>
      </div>
      <Field>
        <Label htmlFor="testimonial-text">Your testimonial</Label>
        <TestimonialEditor
          autoFocus
          id="testimonial-text"
          text={text}
          richText={richText}
          onChange={onChange}
        />
        <TestimonialImagesInput
          files={imageFiles}
          onFilesChange={onImageFilesChange}
        />
        <div className="flex justify-between text-xs">
          <span
            className={
              textLength > 0 && textLength < 20 ? "text-danger" : "text-ink-2"
            }
          >
            Minimum 20 characters
          </span>
          <span className="text-ink-2 tabular-nums">{textLength} / 2,000</span>
        </div>
      </Field>
      <div className="flex gap-3">
        <Button onClick={onBack} type="button" variant="outline">
          Back
        </Button>
        <Button
          className={accentButtonClassName}
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
    <section className="space-y-5 py-2">
      <Sparkle className="size-14 text-(--brand-accent)" draw />
      <div className="space-y-2">
        <h2 className="type-heading" data-step-focus tabIndex={-1}>
          Thank you for your proof
        </h2>
        <p className="type-body text-ink-2">
          {proofType === "video"
            ? `Your video is processing and remains Pending private review by ${brandName}.`
            : `Your testimonial is Pending private review by ${brandName}.`}{" "}
          Check {email} for your private management link. Delivery can take a
          moment.
        </p>
        {proofType === "video" && videoUploaded ? (
          <p className="text-ink-2 type-small">
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
  onCancelVideoUpload,
  onRatingChange,
  onRoleChange,
  onSubmit,
  rating,
  role,
  company,
  submitting,
  videoSelectionLocked,
  videoProgress,
  videoUploadPhase,
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
  onCancelVideoUpload: () => void;
  onRatingChange: (value: number) => void;
  onRoleChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  rating: number | undefined;
  role: string;
  submitting: boolean;
  videoSelectionLocked: boolean;
  videoProgress: number;
  videoUploadPhase: VideoUploadPhase;
  botChallenge?: ReactNode;
  botVerificationReady: boolean;
}) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div>
        <h2 className="type-subheading">About you</h2>
        <p className="text-ink-2 mt-1 text-sm">
          Your email stays private and is used for your management link.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="submitter-name">Your name</Label>
          <Input
            autoComplete="name"
            data-step-focus
            id="submitter-name"
            onChange={(event) => onNameChange(event.target.value)}
            required
            value={name}
          />
        </Field>
        <Field>
          <Label htmlFor="submitter-email">Email address</Label>
          <Input
            autoComplete="email"
            id="submitter-email"
            onChange={(event) => onEmailChange(event.target.value)}
            required
            type="email"
            value={email}
          />
        </Field>
        <Field>
          <Label htmlFor="submitter-role">Role</Label>
          <Input
            id="submitter-role"
            maxLength={100}
            onChange={(event) => onRoleChange(event.target.value)}
            placeholder="Optional"
            value={role}
          />
        </Field>
        <Field>
          <Label htmlFor="submitter-company">Company</Label>
          <Input
            id="submitter-company"
            maxLength={100}
            onChange={(event) => onCompanyChange(event.target.value)}
            placeholder="Optional"
            value={company}
          />
        </Field>
      </div>
      <Field>
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
        {avatar ? <FieldDescription>{avatar.name}</FieldDescription> : null}
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium tracking-[-0.008em]">
          Rating (optional)
        </legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <label className="cursor-pointer p-2.5" key={value}>
              <input
                checked={rating === value}
                className="sr-only"
                name="rating"
                onChange={() => onRatingChange(value)}
                type="radio"
                value={value}
              />
              <span className="sr-only">{value} stars</span>
              <IconStar
                aria-hidden="true"
                className={
                  rating !== undefined && value <= rating
                    ? "size-6 fill-current text-(--brand-accent)"
                    : "text-ink-3 size-6"
                }
              />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="bg-surface-2 space-y-3 rounded-lg border p-4">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <Checkbox
            checked={ageConfirmed}
            onCheckedChange={(checked) =>
              onAgeConfirmedChange(checked === true)
            }
          />
          <span>I confirm that I am at least 18 years old.</span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <Checkbox
            checked={consentAccepted}
            onCheckedChange={(checked) =>
              onConsentAcceptedChange(checked === true)
            }
          />
          <span>I give Publication Consent.</span>
        </label>
        <p className="text-ink-2 text-xs leading-5">{consentText}</p>
      </div>
      {botChallenge}
      {videoUploadPhase !== "idle" ? (
        <VideoUploadProgress
          onCancel={
            videoUploadPhase === "uploading" ? onCancelVideoUpload : undefined
          }
          phase={videoUploadPhase}
          progress={videoProgress}
        />
      ) : null}
      {error ? <ErrorToast message={error} /> : null}
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
          className={accentButtonClassName}
          disabled={
            !identityValid ||
            !ageConfirmed ||
            !consentAccepted ||
            !botVerificationReady
          }
          loading={submitting}
          type="submit"
        >
          Submit testimonial
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
  videoUpload: ReturnType<
    typeof useVideoUpload<VideoDirectUploadResult & VideoUploadReservation>
  >;
  resetBotVerification?: () => void;
  spokenLanguage: "en" | "fr";
  submitText: (input: TextSubmissionInput) => Promise<SubmissionResult>;
  submitVideo: (input: VideoSubmissionInput) => Promise<VideoSubmissionResult>;
  submitterEmail: string;
  submitterName: string;
  text: string;
  richText?: TestimonialRichText;
  textValid: boolean;
  imageFiles: File[];
  uploadImage?: (
    file: File,
    clientSubmissionId: string,
  ) => Promise<TestimonialImage>;
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
      signal?: AbortSignal;
      uploadUrl: string;
    },
  ) => Promise<void>;
  videoDurationSeconds: number | undefined;
  videoDimensions: { height: number; width: number } | undefined;
  videoFile: File | undefined;
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
      rating: input.rating,
      role: input.role.trim() || undefined,
      submitterEmail: input.submitterEmail.trim(),
      submitterName: input.submitterName.trim(),
    };
    if (input.proofType === "text") {
      const images = await uploadTestimonialImages(
        input.imageFiles,
        input.uploadImage
          ? (file) => input.uploadImage!(file, input.clientSubmissionId)
          : undefined,
      );
      await input.submitText({
        imageIds: images.map((image) => image.id),
        ...identity,
        publicSlug: input.brand.publicSlug,
        text: input.text.trim(),
        richText: input.richText,
        ...(input.botToken ? { turnstileToken: input.botToken } : {}),
      });
    } else if (input.videoFile && input.videoDurationSeconds) {
      const completed = await input.videoUpload.run({
        file: input.videoFile,
        reserve: async () => {
          const upload = await input.createDirectUpload({
            clientSubmissionId: input.clientSubmissionId,
            ...(input.videoDimensions
              ? { dimensions: input.videoDimensions }
              : {}),
            fileSizeBytes: input.videoFile!.size,
            mimeType: input.videoFile!.type,
            publicSlug: input.brand.publicSlug,
            spokenLanguage: input.spokenLanguage,
            ...(input.botToken ? { turnstileToken: input.botToken } : {}),
          });
          return {
            ...upload,
            release: () =>
              input.cancelVideo({
                clientSubmissionId: input.clientSubmissionId,
                reservationId: upload.reservationId,
              }),
          };
        },
        upload: input.uploadVideo,
        confirm: (upload) =>
          input.submitVideo({
            ...identity,
            durationSeconds: input.videoDurationSeconds!,
            reservationId: upload.reservationId,
          }),
        retainOnConfirmationError: (error) =>
          !isDefinitiveVideoUploadFailure(error),
      });
      if (!completed) return;
    }
    input.setStep(4);
  } catch (submissionError) {
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
  inspect: (file: File) => Promise<{
    durationSeconds: number;
    height?: number;
    width?: number;
  }>;
  setDuration: (duration: number) => void;
  setDimensions: (dimensions: { height: number; width: number }) => void;
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
    if (metadata.height && metadata.width) {
      input.setDimensions({ height: metadata.height, width: metadata.width });
    }
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

type InitialCollectionValues = Partial<{
  ageConfirmed: boolean;
  company: string;
  consentAccepted: boolean;
  rating: number;
  role: string;
  submitterEmail: string;
  submitterName: string;
  text: string;
  richText?: TestimonialRichText;
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
  imageCount: number;
  brand: PublicBrand;
  company: string;
  name: string;
  rating: number | undefined;
  role: string;
}) {
  return buildPublicationConsent({
    brandName: input.brand.name,
    imageCount: input.imageCount,
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
  uploadImage,
  uploadVideo = uploadDirectVideo,
  inspectVideo = inspectVideoFile,
  botChallenge,
  botToken,
  resetBotVerification,
  recorderVisualFixture = false,
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
  uploadImage?: (
    file: File,
    clientSubmissionId: string,
  ) => Promise<TestimonialImage>;
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
      signal?: AbortSignal;
      uploadUrl: string;
    },
  ) => Promise<void>;
  inspectVideo?: (file: File) => Promise<{
    durationSeconds: number;
    height?: number;
    width?: number;
  }>;
  botChallenge?: ReactNode;
  botToken?: string;
  resetBotVerification?: () => void;
  recorderVisualFixture?: boolean;
}) {
  const normalizedInitialValues = normalizeInitialValues(initialValues);
  const [step, setStep] = useState(initialStep);
  const [proofType, setProofType] = useState<"text" | "video">(
    initialProofType,
  );
  const [clientSubmissionId] = useState(createClientSubmissionId);
  const [text, setText] = useState(normalizedInitialValues.text);
  const [richText, setRichText] = useState<TestimonialRichText>();
  const [imageFiles, setImageFiles] = useState<File[]>([]);
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
  const videoUpload = useVideoUpload<
    VideoDirectUploadResult & VideoUploadReservation
  >();
  const videoDurationSecondsRef = useRef<number | undefined>(undefined);
  const videoDimensionsRef = useRef<
    { height: number; width: number } | undefined
  >(undefined);
  const spokenLanguage = "en";
  const [validatingVideo, setValidatingVideo] = useState(false);
  const [recording, setRecording] = useState(false);
  const flowRef = useRef<HTMLElement | null>(null);
  const previousStepRef = useRef(step);
  const [ageConfirmed, setAgeConfirmed] = useState(
    normalizedInitialValues.ageConfirmed,
  );
  const [consentAccepted, setConsentAccepted] = useState(
    normalizedInitialValues.consentAccepted,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recordingSupported = useSyncExternalStore(
    subscribeToBrowserCapabilities,
    supportsBrowserRecording,
    () => false,
  );
  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    flowRef.current?.querySelector<HTMLElement>("[data-step-focus]")?.focus();
  }, [proofType, step]);
  const textLength = Array.from(text.trim()).length;
  const textValid = textLength >= 20 && textLength <= 2_000;
  const identityValid = hasValidIdentity(submitterName, submitterEmail);
  const consent = buildConsentForForm({
    imageCount: proofType === "text" ? imageFiles.length : 0,
    avatar,
    brand,
    company,
    name: submitterName,
    rating,
    role,
  });

  return (
    <main
      className="bg-paper min-h-svh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] [&_button:not([data-slot=checkbox])]:min-h-11 [&_input:not([type=checkbox]):not([type=radio])]:min-h-11"
      ref={flowRef}
      style={
        {
          "--brand-accent": brand.primaryColor,
          "--brand-accent-ink": accentInk(brand.primaryColor),
          // Shared controls resolve these tokens within the customer surface.
          "--brand": brand.primaryColor,
          "--brand-ink": accentInk(brand.primaryColor),
          "--brand-strong": brand.primaryColor,
          "--brand-soft":
            "color-mix(in srgb, var(--brand-accent) 12%, var(--surface))",
          "--brand-soft-2":
            "color-mix(in srgb, var(--brand-accent) 20%, var(--surface))",
          "--brand-ring":
            "color-mix(in srgb, var(--brand-accent) 50%, transparent)",
          "--ring": "var(--brand-ring)",
        } as CSSProperties
      }
    >
      <BrandPanel brand={brand} step={step} />
      <section className="px-5 py-8 sm:px-8 lg:px-16 lg:py-12">
        <div className="mx-auto w-full max-w-[520px] space-y-6 lg:mx-0">
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
              onChange={(text, content) => {
                setText(text);
                setRichText(content);
              }}
              richText={richText}
              imageFiles={imageFiles}
              onImageFilesChange={setImageFiles}
              onContinue={() => setStep(3)}
              text={text}
              textLength={textLength}
              valid={textValid}
            />
          ) : null}

          {step === 2 && proofType === "video" ? (
            <VideoStep
              error={error}
              onBack={() => setStep(1)}
              onContinue={() =>
                void continueWithSelectedVideo({
                  file: videoFile,
                  inspect: inspectVideo,
                  setDuration: (duration) => {
                    videoDurationSecondsRef.current = duration;
                  },
                  setDimensions: (dimensions) => {
                    videoDimensionsRef.current = dimensions;
                  },
                  setError,
                  setStep,
                  setValidating: setValidatingVideo,
                })
              }
              onFileChange={(file) => {
                setVideoFile(file);
                videoDurationSecondsRef.current = undefined;
                videoDimensionsRef.current = undefined;
                setError(null);
              }}
              onRecordingChange={setRecording}
              recorderVisualFixture={recorderVisualFixture}
              recording={recording}
              recordingSupported={recordingSupported}
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
              onCancelVideoUpload={videoUpload.cancel}
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
                  resetBotVerification,
                  spokenLanguage,
                  submitText,
                  submitVideo,
                  submitterEmail,
                  submitterName,
                  text,
                  richText,
                  imageFiles,
                  uploadImage,
                  textValid,
                  uploadAvatar,
                  uploadVideo,
                  videoDurationSeconds: videoDurationSecondsRef.current,
                  videoDimensions: videoDimensionsRef.current,
                  videoFile,
                  videoUpload,
                })
              }
              rating={rating}
              role={role}
              submitting={submitting}
              videoSelectionLocked={
                proofType === "video" && videoUpload.hasReservation
              }
              videoProgress={videoUpload.progress}
              videoUploadPhase={videoUpload.phase}
            />
          ) : null}

          {step === 4 ? (
            <SuccessStep
              brandName={brand.name}
              email={submitterEmail.trim()}
              proofType={proofType}
              videoUploaded={videoUpload.progress > 0}
            />
          ) : null}

          <p className="text-ink-2 text-xs">
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
        </div>
      </section>
    </main>
  );
}

export function CollectionFormShell({ publicSlug }: { publicSlug: string }) {
  const brand = useQuery(api.organizations.getByPublicSlug, { publicSlug });
  const availability = useQuery(api.collectionQuotas.getPublicAvailability, {
    publicSlug,
  });
  const submitText = useAction(api.submissions.submitText);
  const generateImageUpload = useMutation(
    api.testimonialImages.generateUploadUrl,
  );
  const registerImageUpload = useMutation(api.testimonialImages.registerUpload);
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
      <main className="bg-paper grid min-h-svh place-items-center px-5">
        <p className="text-ink-2 text-sm" role="status">
          Loading Collection Form…
        </p>
      </main>
    );
  }
  if (brand === null || availability === null) {
    return (
      <main className="bg-paper grid min-h-svh place-items-center px-5">
        <EmptyState
          description="Check the address with the Brand that shared it."
          illustration={<WallFrames className="h-32" />}
          headingLevel={1}
          title="Collection Form unavailable"
        />
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
      uploadImage={async (file, clientSubmissionId) => {
        const identity = { clientSubmissionId, publicSlug };
        const { imageId, uploadUrl } = await generateImageUpload(identity);
        const storageId = await uploadProfileImage(file, uploadUrl);
        return registerImageUpload({ ...identity, imageId, storageId });
      }}
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
