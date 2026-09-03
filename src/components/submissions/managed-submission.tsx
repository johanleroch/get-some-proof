"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { CheckCircle2, RefreshCw, Trash2, Upload } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadProfileImage } from "@/lib/upload-profile-image";
import { inspectVideoFile } from "@/lib/video-file";
import { uploadDirectVideo } from "@/lib/video-upload";

type ManagedSubmissionValue = {
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
};

type RevisionInput = {
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
};

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Try again.";
}

export function ManagedSubmissionView({
  onConfirm,
  onReplaceVideo,
  onWithdraw,
  submission,
  uploadAvatar,
}: {
  onConfirm?: (input: RevisionInput) => Promise<void>;
  onReplaceVideo?: (file: File, spokenLanguage: "en" | "fr") => Promise<void>;
  onWithdraw?: () => Promise<void>;
  submission: ManagedSubmissionValue;
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
  const [avatarFile, setAvatarFile] = useState<File>();
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [videoFile, setVideoFile] = useState<File>();
  const [spokenLanguage, setSpokenLanguage] = useState<"en" | "fr">("en");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const normalizedRating = rating ? Number(rating) : undefined;
  const consent = buildPublicationConsent({
    brandName: submission.brandName,
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
      await onConfirm({
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
      });
      setConsentAccepted(false);
      setNotice("Your revision was sent for review.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function replaceVideo() {
    if (!videoFile || !onReplaceVideo) return;
    setUploadingVideo(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await onReplaceVideo(videoFile, spokenLanguage);
      setVideoFile(undefined);
      setNotice("Replacement uploaded. Wait until it is Ready, then confirm.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setUploadingVideo(false);
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
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <p className="text-muted-foreground text-sm font-medium">
          {submission.brandName}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Manage your testimonial
        </h1>
        <p className="text-muted-foreground text-sm">
          Current status:{" "}
          <span className="capitalize">{submission.moderationStatus}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-7">
        <form className="space-y-6" onSubmit={confirm}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="managed-email">Private email</Label>
              <Input
                disabled
                id="managed-email"
                value={submission.submitterEmail}
              />
              <p className="text-muted-foreground text-xs">
                This email identifies the original submission and cannot be
                changed.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="managed-name">Name</Label>
              <Input
                id="managed-name"
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="managed-role">Role</Label>
              <Input
                id="managed-role"
                maxLength={100}
                onChange={(event) => setRole(event.target.value)}
                value={role}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="managed-company">Company</Label>
              <Input
                id="managed-company"
                maxLength={100}
                onChange={(event) => setCompany(event.target.value)}
                value={company}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="managed-rating">Rating</Label>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs"
                id="managed-rating"
                onChange={(event) => setRating(event.target.value)}
                value={rating}
              >
                <option value="">No rating</option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value} / 5
                  </option>
                ))}
              </select>
            </div>
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
              <Textarea
                id="managed-text"
                maxLength={2_000}
                minLength={20}
                onChange={(event) => setText(event.target.value)}
                required
                rows={7}
                value={text}
              />
              <p className="text-muted-foreground text-right text-xs">
                {Array.from(text).length} / 2,000
              </p>
            </div>
          ) : (
            <div className="space-y-4 rounded-xl border p-4">
              {submission.currentVideo ? (
                <div
                  aria-label="Your current video testimonial"
                  className="mx-auto w-full max-w-52 overflow-hidden rounded-lg bg-black"
                  data-playback-id={submission.currentVideo.playbackId}
                  role="region"
                >
                  <MuxPlayer
                    className="block aspect-[9/16] w-full"
                    disableCookies
                    playbackId={submission.currentVideo.playbackId}
                    playsInline
                    poster={`https://image.mux.com/${encodeURIComponent(submission.currentVideo.playbackId)}/thumbnail.png?width=416&height=740&fit_mode=smartcrop&time=${submission.currentVideo.posterTimeSeconds ?? 0.5}`}
                    preload="metadata"
                  />
                </div>
              ) : null}
              <div>
                <p className="font-medium">Replace your video</p>
                <p className="text-muted-foreground mt-1 text-sm">
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
              <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
                <Input
                  accept="video/mp4,video/quicktime,video/webm"
                  aria-label="Replacement video"
                  onChange={(event) => setVideoFile(event.target.files?.[0])}
                  type="file"
                />
                <select
                  aria-label="Spoken language"
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-xs"
                  onChange={(event) =>
                    setSpokenLanguage(event.target.value as "en" | "fr")
                  }
                  value={spokenLanguage}
                >
                  <option value="en">English</option>
                  <option value="fr">French</option>
                </select>
              </div>
              <Button
                disabled={
                  !videoFile ||
                  uploadingVideo ||
                  Boolean(
                    submission.replacement &&
                    submission.replacement.status !== "failed",
                  )
                }
                onClick={replaceVideo}
                type="button"
                variant="outline"
              >
                {uploadingVideo ? (
                  <RefreshCw className="animate-spin" />
                ) : (
                  <Upload />
                )}
                {uploadingVideo ? "Uploading…" : "Upload replacement"}
              </Button>
            </div>
          )}

          <div className="space-y-3 rounded-xl border p-4">
            <p className="text-sm leading-6">{consent.text}</p>
            <label className="flex items-start gap-3 text-sm">
              <input
                checked={consentAccepted}
                className="mt-1 size-4"
                onChange={(event) => setConsentAccepted(event.target.checked)}
                type="checkbox"
              />
              <span>
                I confirm this revision and give fresh Publication Consent.
              </span>
            </label>
          </div>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="flex items-center gap-2 text-sm" role="status">
              <CheckCircle2 className="size-4" /> {notice}
            </p>
          ) : null}
          <Button disabled={!consentAccepted || saving} type="submit">
            {saving ? "Confirming…" : "Confirm revision"}
          </Button>
        </form>

        <div className="border-destructive/30 space-y-3 border-t pt-6">
          <div>
            <h2 className="font-semibold">Withdraw Publication Consent</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              This immediately removes the testimonial from public pages and
              permanently deletes its content and media.
            </p>
          </div>
          <Button
            onClick={() => setWithdrawDialogOpen(true)}
            type="button"
            variant="destructive"
          >
            <Trash2 /> Withdraw and delete
          </Button>
        </div>
      </CardContent>
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
                disabled={withdrawing}
                onClick={withdraw}
                variant="destructive"
              >
                {withdrawing ? "Deleting…" : "Withdraw and delete"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function ManagedSubmission({ token }: { token: string }) {
  const submission = useQuery(api.submissionManagement.get, { token });
  const confirmRevision = useMutation(api.submissionManagement.confirmRevision);
  const withdrawConsent = useMutation(api.submissionManagement.withdrawConsent);
  const createVideoReplacement = useAction(
    api.submissionManagement.createVideoReplacementUpload,
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
      <Card className="w-full max-w-xl text-center">
        <CardHeader>
          <h1 className="text-2xl font-semibold">Consent withdrawn</h1>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          The testimonial is no longer public and its content has been deleted.
        </CardContent>
      </Card>
    );
  if (submission === undefined)
    return <p className="text-muted-foreground text-sm">Loading submission…</p>;
  if (submission === null)
    return (
      <Card className="w-full max-w-xl text-center">
        <CardHeader>
          <h1 className="text-2xl font-semibold">Private link unavailable</h1>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          This management link is invalid or no longer active.
        </CardContent>
      </Card>
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
      onReplaceVideo={async (file, spokenLanguage) => {
        await inspectVideoFile(file);
        const upload = await createVideoReplacement({
          expectedContentVersion: submission.contentVersion,
          fileSizeBytes: file.size,
          mimeType: file.type,
          spokenLanguage,
          token,
        });
        await uploadDirectVideo(file, {
          onProgress: () => undefined,
          provider: upload.provider,
          uploadUrl: upload.uploadUrl,
        });
      }}
      onWithdraw={async () => {
        await withdrawConsent({ token });
        setWithdrawn(true);
      }}
      uploadAvatar={async (file) => {
        const clientSubmissionId = `revision-${token.slice(0, 32)}`;
        const { reservationId, uploadUrl } = await generateAvatarUploadUrl({
          clientSubmissionId,
          publicSlug: submission.publicSlug,
        });
        const storageId = await uploadProfileImage(file, uploadUrl);
        await registerAvatarUpload({ reservationId, storageId });
        return { reservationId, storageId };
      }}
    />
  );
}
