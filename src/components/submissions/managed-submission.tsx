"use client";

import type { FormEvent } from "react";
import { BlobLoader } from "@/components/brand/blob-loader";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  IconPlayerPlayFilled,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import MuxPlayer from "@mux/mux-player-react/lazy";
import Image from "next/image";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { buildPublicationConsent } from "@convex/domain/submission";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { WallFrames } from "@/components/doodles";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FieldDescription } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorToast, SuccessToast } from "@/components/ui/error-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadTestimonialImages } from "@/lib/upload-testimonial-images";
import { TestimonialImagesInput } from "@/components/testimonials/testimonial-images-input";
import type { TestimonialImage } from "@convex/domain/testimonialImage";
import { TestimonialEditor } from "@/components/testimonials/testimonial-editor";
import type { TestimonialRichText } from "@convex/domain/testimonialRichText";
import { uploadProfileImage } from "@/lib/upload-profile-image";
import { inspectVideoFile } from "@/lib/video-file";
import {
  useVideoUpload,
  type VideoUploadReservation,
} from "@/hooks/use-video-upload";
import { uploadDirectVideo } from "@/lib/video-upload";
import { VideoUploadProgress } from "@/components/collection/video-upload-progress";

type ManagedSubmissionValue = {
  images?: TestimonialImage[];
  avatarUrl: string | null;
  brandName: string;
  company?: string;
  consentAcceptedAt: number;
  contentVersion: number;
  currentVideo?: {
    playbackId: string;
    posterTimeSeconds?: number;
  };
  moderationStatus: "pending" | "published" | "archived" | "spam";
  privacyContact: string;
  publicSlug: string;
  rating?: number;
  replacement?: {
    revisionId: Id<"submissionVideoRevisions">;
    status: "awaiting_upload" | "processing" | "ready" | "failed";
  };
  role?: string;
  submissionType: "text" | "video";
  submitterEmail: string;
  submitterName: string;
  text: string;
  richText?: TestimonialRichText;
};

type RevisionInput = {
  imageIds?: Id<"testimonialImages">[];
  avatarReservationId?: Id<"submissionAvatarUploads">;
  avatarStorageId?: Id<"_storage">;
  company?: string;
  consentText: string;
  consentVersion: string;
  rating?: number;
  removeAvatar: boolean;
  revisionId?: Id<"submissionVideoRevisions">;
  role?: string;
  submitterName: string;
  text: string;
  richText?: TestimonialRichText;
};

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Try again.";
}

function CurrentManagedVideo({
  playbackId,
  posterTimeSeconds,
}: {
  playbackId: string;
  posterTimeSeconds?: number;
}) {
  const [playing, setPlaying] = useState(false);
  const poster = `https://image.mux.com/${encodeURIComponent(playbackId)}/thumbnail.png?width=416&height=740&fit_mode=smartcrop&time=${posterTimeSeconds ?? 0.5}`;

  return (
    <div
      aria-label="Your current video testimonial"
      className="relative mx-auto aspect-[9/16] w-full max-w-52 overflow-hidden rounded-lg bg-black"
      data-playback-id={playbackId}
      role="region"
    >
      {playing ? (
        <MuxPlayer
          autoPlay
          className="block h-full w-full"
          disableCookies
          playbackId={playbackId}
          playsInline
          poster={poster}
          preload="metadata"
          style={{ aspectRatio: "9 / 16", height: "100%", width: "100%" }}
        />
      ) : (
        <button
          aria-label="Play your current video testimonial"
          className="group absolute inset-0 cursor-pointer"
          onClick={() => setPlaying(true)}
          type="button"
        >
          <Image
            alt="Current video testimonial"
            className="object-cover"
            fill
            sizes="208px"
            src={poster}
            unoptimized
          />
          <span className="bg-background/90 text-foreground absolute top-1/2 left-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-lg transition-transform group-hover:scale-105 group-focus-visible:scale-105">
            <IconPlayerPlayFilled
              aria-hidden="true"
              className="ml-0.5 size-5"
            />
          </span>
        </button>
      )}
    </div>
  );
}

export function ManagedSubmissionView({
  onConfirm,
  prepareVideoUpload,
  uploadVideo = uploadDirectVideo,
  onWithdraw,
  submission,
  uploadAvatar,
  uploadImage,
}: {
  onConfirm?: (input: RevisionInput) => Promise<void>;
  prepareVideoUpload?: (
    file: File,
    spokenLanguage: "en" | "fr",
  ) => Promise<VideoUploadReservation>;
  uploadVideo?: typeof uploadDirectVideo;
  onWithdraw?: () => Promise<void>;
  submission: ManagedSubmissionValue;
  uploadImage?: (file: File) => Promise<TestimonialImage>;
  uploadAvatar?: (file: File) => Promise<{
    reservationId: Id<"submissionAvatarUploads">;
    storageId: Id<"_storage">;
  }>;
}) {
  const [name, setName] = useState(() => submission.submitterName);
  const [role, setRole] = useState(() => submission.role ?? "");
  const [company, setCompany] = useState(() => submission.company ?? "");
  const [rating, setRating] = useState(
    () => submission.rating?.toString() ?? "",
  );
  const [text, setText] = useState(() => submission.text);
  const [richText, setRichText] = useState(() => submission.richText);
  const [images, setImages] = useState(() => submission.images ?? []);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [avatarFile, setAvatarFile] = useState<File>();
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [videoFile, setVideoFile] = useState<File>();
  const spokenLanguage = "en";
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const videoUpload = useVideoUpload();
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const normalizedRating = rating ? Number(rating) : undefined;
  const consent = buildPublicationConsent({
    brandName: submission.brandName,
    imageCount: images.length + imageFiles.length,
    privacyContact: submission.privacyContact,
    suppliedIdentity: {
      avatarSupplied:
        Boolean(avatarFile) || (Boolean(submission.avatarUrl) && !removeAvatar),
      company: company.trim() || undefined,
      name: name.trim(),
      rating: normalizedRating,
      role: role.trim() || undefined,
    },
  });

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!onConfirm) return;
    setSaving(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const avatar =
        avatarFile && uploadAvatar ? await uploadAvatar(avatarFile) : undefined;
      const uploaded = await uploadTestimonialImages(imageFiles, uploadImage);
      await onConfirm({
        imageIds:
          submission.submissionType === "text"
            ? [...images, ...uploaded].map((image) => image.id)
            : undefined,
        avatarReservationId: avatar?.reservationId,
        avatarStorageId: avatar?.storageId,
        company: company.trim() || undefined,
        consentText: consent.text,
        consentVersion: consent.version,
        rating: normalizedRating,
        removeAvatar,
        revisionId:
          submission.replacement?.status === "ready"
            ? submission.replacement.revisionId
            : undefined,
        role: role.trim() || undefined,
        submitterName: name,
        text,
        richText,
      });
      setImages([...images, ...uploaded]);
      setImageFiles([]);
      setConsentAccepted(false);
      setNotice("Your revision was sent for review.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function replaceVideo() {
    if (!videoFile || !prepareVideoUpload) return;
    setError(undefined);
    setNotice(undefined);
    try {
      const completed = await videoUpload.run({
        file: videoFile,
        reserve: () => prepareVideoUpload(videoFile, spokenLanguage),
        upload: uploadVideo,
      });
      if (completed) {
        setVideoFile(undefined);
        setNotice(
          "Replacement uploaded. Wait until it is Ready, then confirm.",
        );
      }
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function withdraw() {
    if (!onWithdraw) return;
    setWithdrawing(true);
    setError(undefined);
    try {
      await onWithdraw();
    } catch (caught) {
      setError(errorMessage(caught));
      setWithdrawing(false);
      setWithdrawDialogOpen(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl space-y-8">
      <header className="space-y-1.5">
        <p className="type-micro text-ink-2">{submission.brandName}</p>
        <h1 className="type-heading">Manage your testimonial</h1>
        <p className="type-body text-ink-2">
          Current status:{" "}
          <span className="capitalize">{submission.moderationStatus}</span>
        </p>
      </header>
      <div className="space-y-7">
        <form className="space-y-6" onSubmit={confirm}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <Label htmlFor="managed-email">Private email</Label>
              <Input
                disabled
                id="managed-email"
                value={submission.submitterEmail}
              />
              <FieldDescription>
                This email identifies the original submission and cannot be
                changed.
              </FieldDescription>
            </Field>
            <Field>
              <Label htmlFor="managed-name">Name</Label>
              <Input
                id="managed-name"
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </Field>
            <Field>
              <Label htmlFor="managed-role">Role</Label>
              <Input
                id="managed-role"
                maxLength={100}
                onChange={(event) => setRole(event.target.value)}
                value={role}
              />
            </Field>
            <Field>
              <Label htmlFor="managed-company">Company</Label>
              <Input
                id="managed-company"
                maxLength={100}
                onChange={(event) => setCompany(event.target.value)}
                value={company}
              />
            </Field>
            <Field>
              <Label htmlFor="managed-rating">Rating</Label>
              <Select
                onValueChange={(value) =>
                  setRating(value === "none" ? "" : value)
                }
                value={rating || "none"}
              >
                <SelectTrigger className="w-full" id="managed-rating">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No rating</SelectItem>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value} / 5
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="space-y-3">
            <Label htmlFor="managed-avatar">Avatar</Label>
            <div className="flex items-center gap-4">
              {submission.avatarUrl && !removeAvatar ? (
                <Image
                  alt="Current avatar"
                  className="size-14 rounded-full object-cover"
                  height={56}
                  src={submission.avatarUrl}
                  unoptimized
                  width={56}
                />
              ) : (
                <div className="bg-muted grid size-14 place-items-center rounded-full text-sm font-medium">
                  {name.trim().slice(0, 2).toUpperCase() || "?"}
                </div>
              )}
              <Input
                accept="image/jpeg,image/png,image/webp"
                id="managed-avatar"
                onChange={(event) => {
                  setAvatarFile(event.target.files?.[0]);
                  if (event.target.files?.[0]) setRemoveAvatar(false);
                }}
                type="file"
              />
            </div>
            {submission.avatarUrl ? (
              <Button
                onClick={() => {
                  setAvatarFile(undefined);
                  setRemoveAvatar(true);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Remove current avatar
              </Button>
            ) : null}
          </div>

          {submission.submissionType === "text" ? (
            <div className="space-y-2">
              <Label htmlFor="managed-text">Your testimonial</Label>
              <TestimonialEditor
                id="managed-text"
                text={text}
                richText={richText}
                onChange={(text, content) => {
                  setText(text);
                  setRichText(content);
                }}
              />
              <TestimonialImagesInput
                disabled={saving}
                files={imageFiles}
                onFilesChange={setImageFiles}
                images={images}
                onImagesChange={setImages}
              />
              <p className="text-ink-2 text-right text-xs tabular-nums">
                {Array.from(text).length} / 2,000
              </p>
            </div>
          ) : (
            <div className="bg-card space-y-4 rounded-lg border p-4">
              {submission.currentVideo ? (
                <CurrentManagedVideo {...submission.currentVideo} />
              ) : null}
              <div>
                <p className="type-subheading">Replace your video</p>
                <p className="text-ink-2 mt-1 text-sm">
                  Your current video stays unchanged unless a new one becomes
                  Ready and you confirm it.
                </p>
              </div>
              {submission.replacement ? (
                <p className="text-sm" role="status">
                  Replacement:{" "}
                  <span className="capitalize">
                    {submission.replacement.status.replace("_", " ")}
                  </span>
                </p>
              ) : null}
              <div>
                <Input
                  accept="video/mp4,video/quicktime,video/webm"
                  aria-label="Replacement video"
                  onChange={(event) => setVideoFile(event.target.files?.[0])}
                  type="file"
                />
              </div>
              <Button
                disabled={
                  !videoFile ||
                  Boolean(
                    submission.replacement &&
                    submission.replacement.status !== "failed",
                  )
                }
                loading={videoUpload.uploading}
                onClick={replaceVideo}
                type="button"
                variant="outline"
              >
                <IconUpload aria-hidden="true" />
                Upload replacement
              </Button>
              <VideoUploadProgress
                onCancel={videoUpload.cancel}
                phase={videoUpload.phase}
                progress={videoUpload.progress}
              />
            </div>
          )}

          <div className="bg-surface-2 space-y-3 rounded-lg border p-4">
            <p className="text-ink-2 text-sm leading-6">{consent.text}</p>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <Checkbox
                checked={consentAccepted}
                onCheckedChange={(checked) =>
                  setConsentAccepted(checked === true)
                }
              />
              <span>
                I confirm this revision and give fresh Publication Consent.
              </span>
            </label>
          </div>
          {error ? <ErrorToast message={error} /> : null}
          {notice ? <SuccessToast message={notice} /> : null}
          <Button
            disabled={!consentAccepted}
            loading={saving}
            size="lg"
            type="submit"
          >
            Confirm revision
          </Button>
        </form>

        <div className="border-danger/30 space-y-3 border-t pt-6">
          <div>
            <h2 className="type-subheading">Withdraw Publication Consent</h2>
            <p className="text-ink-2 mt-1 text-sm">
              This immediately removes the testimonial from public pages and
              permanently deletes its content and media.
            </p>
          </div>
          <Button
            onClick={() => setWithdrawDialogOpen(true)}
            type="button"
            variant="destructive"
          >
            <IconTrash aria-hidden="true" /> Withdraw and delete
          </Button>
        </div>
      </div>
      <AlertDialog
        onOpenChange={setWithdrawDialogOpen}
        open={withdrawDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw consent and delete?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The testimonial disappears from every
              public surface immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button disabled={withdrawing} variant="outline">
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                loading={withdrawing}
                onClick={withdraw}
                variant="destructive"
              >
                Withdraw and delete
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export function ManagedSubmission({ token }: { token: string }) {
  const submission = useQuery(api.submissionManagement.get, { token });
  const confirmRevision = useMutation(api.submissionManagement.confirmRevision);
  const generateImageUpload = useMutation(
    api.testimonialImages.generateUploadUrl,
  );
  const registerImageUpload = useMutation(api.testimonialImages.registerUpload);
  const [imageClientId] = useState(() => crypto.randomUUID());
  const withdrawConsent = useMutation(api.submissionManagement.withdrawConsent);
  const createVideoReplacement = useAction(
    api.submissionManagement.createVideoReplacementUpload,
  );
  const cancelVideoReplacement = useMutation(
    api.submissionManagement.cancelVideoReplacement,
  );
  const generateAvatarUploadUrl = useMutation(
    api.submissions.generateAvatarUploadUrl,
  );
  const registerAvatarUpload = useMutation(
    api.submissions.registerAvatarUpload,
  );
  const [withdrawn, setWithdrawn] = useState(false);
  if (withdrawn)
    return (
      <EmptyState
        description="The testimonial is no longer public and its content has been deleted."
        headingLevel={1}
        illustration={<WallFrames className="h-28" />}
        title="Consent withdrawn"
      />
    );
  if (submission === undefined)
    return <BlobLoader label="Loading submission…" />;
  if (submission === null)
    return (
      <EmptyState
        description="This management link is invalid or no longer active."
        headingLevel={1}
        illustration={<WallFrames className="h-28" />}
        title="Private link unavailable"
      />
    );
  return (
    <ManagedSubmissionView
      key={submission.contentVersion}
      submission={submission}
      onConfirm={async (input) => {
        await confirmRevision({
          ...input,
          consentAccepted: true,
          expectedContentVersion: submission.contentVersion,
          token,
        });
      }}
      prepareVideoUpload={async (file, spokenLanguage) => {
        const metadata = await inspectVideoFile(file);
        const upload = await createVideoReplacement({
          dimensions: { height: metadata.height, width: metadata.width },
          expectedContentVersion: submission.contentVersion,
          fileSizeBytes: file.size,
          mimeType: file.type,
          spokenLanguage,
          token,
        });
        return {
          ...upload,
          release: () =>
            cancelVideoReplacement({
              reservationId: upload.reservationId,
              revisionId: upload.revisionId,
              token,
            }),
        };
      }}
      onWithdraw={async () => {
        await withdrawConsent({ token });
        setWithdrawn(true);
      }}
      uploadImage={async (file) => {
        const identity = {
          clientSubmissionId: imageClientId,
          publicSlug: submission.publicSlug,
          token,
        };
        const { imageId, uploadUrl } = await generateImageUpload(identity);
        const storageId = await uploadProfileImage(file, uploadUrl);
        return registerImageUpload({ ...identity, imageId, storageId });
      }}
      uploadAvatar={async (file) => {
        const clientSubmissionId = `revision-${token.slice(0, 32)}`;
        const { reservationId, uploadUrl } = await generateAvatarUploadUrl({
          clientSubmissionId,
          token,
          publicSlug: submission.publicSlug,
        });
        const storageId = await uploadProfileImage(file, uploadUrl);
        await registerAvatarUpload({ reservationId, storageId });
        return { reservationId, storageId };
      }}
    />
  );
}
