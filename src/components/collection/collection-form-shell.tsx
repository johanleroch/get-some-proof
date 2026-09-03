"use client";

import type { CSSProperties, FormEvent } from "react";
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { CheckCircle2, MessageSquareText, Star, Video } from "lucide-react";
import Image from "next/image";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { buildPublicationConsent } from "@convex/domain/submission";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadProfileImage } from "@/lib/upload-profile-image";

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
};

type SubmissionResult = {
  moderationStatus: "pending";
  testimonialId: Id<"testimonials"> | string;
};

const fieldClassName =
  "h-4 w-4 shrink-0 accent-(--brand-accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-accent)";

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

export function CollectionFormShellView({
  brand,
  initialStep = 1,
  initialValues,
  submitText = async () => {
    throw new Error("Submission is unavailable in this preview.");
  },
  uploadAvatar,
}: {
  brand: PublicBrand;
  initialStep?: 1 | 2 | 3 | 4;
  initialValues?: Partial<{
    ageConfirmed: boolean;
    company: string;
    consentAccepted: boolean;
    rating: number;
    role: string;
    submitterEmail: string;
    submitterName: string;
    text: string;
  }>;
  submitText?: (input: TextSubmissionInput) => Promise<SubmissionResult>;
  uploadAvatar?: (
    file: File,
    clientSubmissionId: string,
  ) => Promise<{
    reservationId: Id<"submissionAvatarUploads">;
    storageId: Id<"_storage">;
  }>;
}) {
  const [step, setStep] = useState(initialStep);
  const [clientSubmissionId] = useState(() => crypto.randomUUID());
  const [text, setText] = useState(initialValues?.text ?? "");
  const [submitterName, setSubmitterName] = useState(
    initialValues?.submitterName ?? "",
  );
  const [submitterEmail, setSubmitterEmail] = useState(
    initialValues?.submitterEmail ?? "",
  );
  const [role, setRole] = useState(initialValues?.role ?? "");
  const [company, setCompany] = useState(initialValues?.company ?? "");
  const [rating, setRating] = useState<number | undefined>(
    initialValues?.rating,
  );
  const [avatar, setAvatar] = useState<File | undefined>();
  const [ageConfirmed, setAgeConfirmed] = useState(
    initialValues?.ageConfirmed ?? false,
  );
  const [consentAccepted, setConsentAccepted] = useState(
    initialValues?.consentAccepted ?? false,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textLength = Array.from(text.trim()).length;
  const textValid = textLength >= 20 && textLength <= 2_000;
  const identityValid =
    submitterName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail.trim());
  const consent = buildPublicationConsent({
    brandName: brand.name,
    privacyContact: brand.privacyContact,
    suppliedIdentity: {
      avatarSupplied: avatar !== undefined,
      company: company.trim() || undefined,
      name: submitterName.trim() || "your name",
      rating,
      role: role.trim() || undefined,
    },
  });

  async function confirmSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identityValid || !ageConfirmed || !consentAccepted || !textValid)
      return;
    setSubmitting(true);
    setError(null);
    try {
      const avatarUpload =
        avatar && uploadAvatar
          ? await uploadAvatar(avatar, clientSubmissionId)
          : undefined;
      await submitText({
        ageConfirmed,
        avatarReservationId: avatarUpload?.reservationId,
        avatarStorageId: avatarUpload?.storageId,
        clientSubmissionId,
        company: company.trim() || undefined,
        consentAccepted,
        consentText: consent.text,
        consentVersion: consent.version,
        publicSlug: brand.publicSlug,
        rating,
        role: role.trim() || undefined,
        submitterEmail: submitterEmail.trim(),
        submitterName: submitterName.trim(),
        text: text.trim(),
      });
      setStep(4);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Your testimonial could not be submitted. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

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
                className="flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors hover:border-(--brand-accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-accent)"
                onClick={() => setStep(2)}
                type="button"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-(--brand-accent) text-white">
                  <MessageSquareText className="size-5" />
                </span>
                <span>
                  <span className="block font-medium">
                    Send a text testimonial
                  </span>
                  <span className="text-muted-foreground text-sm">
                    Write 20 to 2,000 characters
                  </span>
                </span>
              </button>
              <button
                aria-label="Record or upload a video"
                className="text-muted-foreground flex w-full cursor-not-allowed items-center gap-4 rounded-xl border border-dashed p-4 text-left opacity-65"
                disabled
                type="button"
              >
                <span className="bg-muted grid size-11 place-items-center rounded-xl">
                  <Video className="size-5" />
                </span>
                <span>
                  <span className="block font-medium">
                    Record or upload a video
                  </span>
                  <span className="text-xs">Available soon</span>
                </span>
              </button>
            </section>
          ) : null}

          {step === 2 ? (
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
                  onChange={(event) => setText(event.target.value)}
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
                  <span className="text-muted-foreground">
                    {textLength} / 2,000
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => setStep(1)}
                  type="button"
                  variant="outline"
                >
                  Back
                </Button>
                <Button
                  className="flex-1 bg-(--brand-accent) text-white hover:opacity-90"
                  disabled={!textValid}
                  onClick={() => setStep(3)}
                  type="button"
                >
                  Continue
                </Button>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <form className="space-y-5" onSubmit={confirmSubmission}>
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
                    onChange={(event) => setSubmitterName(event.target.value)}
                    required
                    value={submitterName}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="submitter-email">Email address</Label>
                  <Input
                    autoComplete="email"
                    id="submitter-email"
                    onChange={(event) => setSubmitterEmail(event.target.value)}
                    required
                    type="email"
                    value={submitterEmail}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="submitter-role">Role</Label>
                  <Input
                    id="submitter-role"
                    maxLength={100}
                    onChange={(event) => setRole(event.target.value)}
                    placeholder="Optional"
                    value={role}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="submitter-company">Company</Label>
                  <Input
                    id="submitter-company"
                    maxLength={100}
                    onChange={(event) => setCompany(event.target.value)}
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
                    if (file && file.size <= 5 * 1024 * 1024) setAvatar(file);
                  }}
                  type="file"
                />
                {avatar ? (
                  <p className="text-muted-foreground text-xs">{avatar.name}</p>
                ) : null}
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">
                  Rating (optional)
                </legend>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <label className="cursor-pointer p-1" key={value}>
                      <input
                        checked={rating === value}
                        className="sr-only"
                        name="rating"
                        onChange={() => setRating(value)}
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
                    onChange={(event) => setAgeConfirmed(event.target.checked)}
                    type="checkbox"
                  />
                  <span>I confirm that I am at least 18 years old.</span>
                </label>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    checked={consentAccepted}
                    className={fieldClassName}
                    onChange={(event) =>
                      setConsentAccepted(event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>I give Publication Consent.</span>
                </label>
                <p className="text-muted-foreground text-xs leading-5">
                  {consent.text}
                </p>
              </div>
              {error ? (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex gap-3">
                <Button
                  onClick={() => setStep(2)}
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
                    submitting
                  }
                  type="submit"
                >
                  {submitting ? "Submitting…" : "Submit testimonial"}
                </Button>
              </div>
            </form>
          ) : null}

          {step === 4 ? (
            <section className="space-y-4 py-2 text-center">
              <CheckCircle2 className="mx-auto size-12 text-(--brand-accent)" />
              <div>
                <h2 className="text-xl font-semibold">
                  Thank you for your proof
                </h2>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  Your testimonial is Pending private review by {brand.name}.
                  Check {submitterEmail.trim()} for your private management
                  link. Delivery can take a moment.
                </p>
              </div>
            </section>
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
        </CardContent>
      </Card>
    </main>
  );
}

export function CollectionFormShell({ publicSlug }: { publicSlug: string }) {
  const brand = useQuery(api.organizations.getByPublicSlug, { publicSlug });
  const submitText = useAction(api.submissions.submitText);
  const generateAvatarUploadUrl = useMutation(
    api.submissions.generateAvatarUploadUrl,
  );
  const registerAvatarUpload = useMutation(
    api.submissions.registerAvatarUpload,
  );

  if (brand === undefined) {
    return (
      <main className="bg-muted/30 grid min-h-svh place-items-center px-5">
        <p className="text-muted-foreground text-sm" role="status">
          Loading Collection Form…
        </p>
      </main>
    );
  }
  if (brand === null) {
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
      brand={brand}
      submitText={submitText}
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
