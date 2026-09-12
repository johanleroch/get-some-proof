"use client";
import { GoogleBusiness } from "./google-business";
import { BackupImport } from "./backup-import";
import { ImportPhotoProgress } from "./import-photo-progress";
import { useRef, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useAction, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { BlobLoader } from "@/components/brand/blob-loader";
import { TestimonialImportView } from "./testimonial-import-view";
export {
  TestimonialImportView,
  ImportPreviewList,
} from "./testimonial-import-view";
function importError(error: unknown) {
  if (
    error instanceof ConvexError &&
    typeof error.data === "object" &&
    error.data !== null &&
    "message" in error.data
  )
    return String(error.data.message);
  return "The wall could not be read. Check the URL and try again.";
}

export function TestimonialImport({
  slug,
  initialJobId,
  initialSource,
}: {
  slug: string;
  initialJobId?: string;
  initialSource?: string;
}) {
  const router = useRouter();
  const organization = useQuery(api.organizations.getBySlug, { slug });
  const readSource = useAction(api.testimonialImportSource.preview);
  const confirm = useMutation(api.testimonialImports.confirm);
  const persistSelection = useMutation(api.testimonialImports.setSelection);
  const retryPhoto = useMutation(api.testimonialImportAvatar.retry);
  const retryVideo = useMutation(api.testimonialImportVideo.retry);
  const uploadPhoto = useAction(api.importAvatarUpload.upload);
  const generatePhotoUploadUrl = useMutation(
    api.importAvatarUpload.generateUploadUrl,
  );
  const removePhoto = useMutation(api.importAvatarUpload.remove);
  const correctIdentity = useMutation(api.testimonialImports.correctIdentity);
  const [retryingItemId, setRetryingItemId] =
    useState<Id<"testimonialImportItems"> | null>(null);
  const [provider, setProvider] = useState<"testimonial-to" | "senja">(
    "testimonial-to",
  );
  const [url, setUrl] = useState("");
  const [jobId, setJobId] = useState<Id<"testimonialImportJobs"> | null>(
    initialJobId ? (initialJobId as Id<"testimonialImportJobs">) : null,
  );
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [typeFilter, setTypeFilter] = useState<"all" | "text" | "video">("all");
  const [localSelected, setSelected] = useState<Set<
    Id<"testimonialImportItems">
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewingRemaining, setReviewingRemaining] = useState(false);
  const [error, setError] = useState("");
  const [savedResult, setResult] = useState<FunctionReturnType<
    typeof api.testimonialImports.confirm
  > | null>(null);
  const request = useRef(0);
  const preview = useQuery(
    api.testimonialImports.getPreview,
    jobId && organization
      ? {
          jobId,
          organizationId: organization.id,
          type: typeFilter === "all" ? undefined : typeFilter,
          paginationOpts: {
            cursor: cursors[cursors.length - 1]!,
            numItems: 100,
          },
        }
      : "skip",
  );
  const result = reviewingRemaining
    ? null
    : (preview?.result ?? savedResult ?? null);
  const photos = useQuery(
    api.testimonialImportAvatar.progress,
    jobId && organization && result ? { jobId } : "skip",
  );
  const selected = localSelected ?? new Set(preview?.selectedItemIds ?? []);
  const selectionReview = useQuery(
    api.importEligibility.selection,
    jobId && preview && !result ? { jobId, itemIds: [...selected] } : "skip",
  );

  function changeSelection(next: Set<Id<"testimonialImportItems">>) {
    setSelected(next);
    if (jobId)
      void persistSelection({ jobId, itemIds: [...next] }).catch((failure) => {
        setError(importError(failure));
        setSelected(null);
      });
  }

  function backToUrl() {
    request.current++;
    setLoading(false);
    setJobId(null);
    setTypeFilter("all");
    setCursors([null]);
    setSelected(null);
    setResult(null);
    setReviewingRemaining(false);
    setError("");
    router.replace(`/org/${slug}/import` as Route, { scroll: false });
  }

  async function read() {
    if (!organization) return;
    const current = ++request.current;
    setLoading(true);
    setError("");
    try {
      const response = await readSource({
        organizationId: organization.id,
        url,
      });
      if (current === request.current) {
        setJobId(response.jobId);
        router.replace(`/org/${slug}/import?job=${response.jobId}` as Route, {
          scroll: false,
        });
      }
    } catch (failure) {
      if (current === request.current) setError(importError(failure));
    } finally {
      if (current === request.current) setLoading(false);
    }
  }

  async function save() {
    if (!jobId) return;
    setSaving(true);
    setError("");
    try {
      setResult(await confirm({ jobId, itemIds: [...selected] }));
      setSelected(new Set());
      setReviewingRemaining(false);
    } catch (failure) {
      setError(importError(failure));
    } finally {
      setSaving(false);
    }
  }

  async function onRetry(itemId: Id<"testimonialImportItems">) {
    setRetryingItemId(itemId);
    setError("");
    try {
      await retryVideo({ itemId });
    } catch (failure) {
      setError(importError(failure));
    } finally {
      setRetryingItemId(null);
    }
  }

  if (organization === undefined)
    return <BlobLoader label="Loading Project…" showLabel />;
  if (!organization) return <p role="alert">Project unavailable.</p>;
  return (
    <TestimonialImportView
      googleConnection={<GoogleBusiness organizationId={organization.id} />}
      initialGoogle={initialSource === "google"}
      backupImport={<BackupImport organizationId={organization.id} />}
      resultDetails={
        <ImportPhotoProgress
          photos={photos ?? []}
          onRetry={async (itemId) => {
            await retryPhoto({
              itemId: itemId as Id<"testimonialImportItems">,
            });
          }}
        />
      }
      selectionReview={selectionReview}
      checkingSelection={
        !!jobId && !!preview && !result && selectionReview === undefined
      }
      typeFilter={typeFilter}
      onTypeFilterChange={(type) => {
        setTypeFilter(type);
        setCursors([null]);
      }}
      onPhoto={async (itemId, photo) => {
        const target = { itemId };
        if (photo) {
          const uploadUrl = await generatePhotoUploadUrl({ target });
          const response = await fetch(uploadUrl, {
            body: photo,
            headers: { "Content-Type": photo.type },
            method: "POST",
          });
          if (!response.ok) throw new Error("IMAGE_UPLOAD_FAILED");
          const { storageId } = (await response.json()) as {
            storageId: Id<"_storage">;
          };
          await uploadPhoto({ target, temporaryStorageId: storageId });
        } else await removePhoto({ target });
      }}
      onCorrectIdentity={async (itemId, identity) => {
        await correctIdentity({ itemId, ...identity });
      }}
      onRetry={onRetry}
      retryingItemId={retryingItemId}
      reviewRemaining={() => setReviewingRemaining(true)}
      {...{
        slug,
        jobId,
        provider,
        setProvider,
        url,
        setUrl,
        loading,
        saving,
        error,
        result,
        preview,
        selected,
        cursors,
        setCursors,
        changeSelection,
        backToUrl,
        read,
        save,
      }}
    />
  );
}
