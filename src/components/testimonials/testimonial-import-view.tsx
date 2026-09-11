"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { defaultPrimaryColor } from "@convex/domain/brand";
import { PageHeader } from "@/components/page-header";
import { BlobLoader, BlobLoadingText } from "@/components/brand/blob-loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowNote, WallFrames } from "@/components/doodles";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { ImportIdentityDialog } from "./import-identity-dialog";
import { DesignQuote } from "./designs/design-parts";

function canSelect(item: Doc<"testimonialImportItems">, videoEnabled = false) {
  return (
    (item.type === "text" || (videoEnabled && !!item.videoUrl)) &&
    !item.unavailableReason &&
    !item.outcome &&
    !item.videoStatus &&
    (!item.sourceState || item.sourceState === "new")
  );
}

export function ImportPreviewList({
  items,
  selected,
  onSelect,
  disabled = false,
  videoEnabled = false,
  onRetry,
  retryingItemId,
  onEdit,
}: {
  items: Doc<"testimonialImportItems">[];
  selected: Set<Id<"testimonialImportItems">>;
  onSelect: (id: Id<"testimonialImportItems">, checked: boolean) => void;
  disabled?: boolean;
  videoEnabled?: boolean;
  onRetry?: (id: Id<"testimonialImportItems">) => Promise<void>;
  retryingItemId?: Id<"testimonialImportItems"> | null;
  onEdit?: (item: Doc<"testimonialImportItems">) => void;
}) {
  return (
    <ul className="bg-surface border-line divide-line divide-y overflow-hidden rounded-lg border">
      {items.map((item) => (
        <li
          key={item._id}
          className="hover:bg-surface-2 grid grid-cols-[1fr_auto] gap-4 p-4 md:grid-cols-[200px_1fr_auto] md:gap-6"
        >
          <div className="flex min-w-0 items-start gap-3">
            <Avatar aria-hidden="true" className="size-10 shrink-0">
              {item.avatarUrl && (
                <AvatarImage
                  src={item.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              )}
              <AvatarFallback className="text-brand-text font-display bg-transparent text-4xl">
                “
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="type-ui font-semibold break-words">
                {item.identityCorrection?.authorName ??
                  (item.authorName || "Name unavailable")}
              </p>
              {(item.identityCorrection
                ? item.identityCorrection.tagline
                : item.tagline) && (
                <p className="type-small text-ink-2 mt-1 break-words max-md:text-sm">
                  {item.identityCorrection?.tagline ?? item.tagline}
                </p>
              )}
              {onEdit &&
                !item.outcome &&
                !item.videoStatus &&
                (!item.sourceState || item.sourceState === "new") && (
                  <Button
                    variant="ghost"
                    className="mt-2"
                    disabled={disabled}
                    onClick={(event) => {
                      event.currentTarget.focus();
                      onEdit(item);
                    }}
                    aria-label={`Correct details for ${item.identityCorrection?.authorName ?? item.authorName}`}
                  >
                    Correct details
                  </Button>
                )}
            </div>
          </div>
          <div className="col-span-2 col-start-1 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
            {(item.outcome ||
              (item.sourceState && item.sourceState !== "new")) && (
              <div className="mb-3">
                <Badge
                  variant={
                    item.outcome === "changed" || item.sourceState === "changed"
                      ? "warning"
                      : "neutral"
                  }
                >
                  {item.outcome === "changed" || item.sourceState === "changed"
                    ? "Changed at source"
                    : item.outcome === "unavailable"
                      ? "Unavailable"
                      : "Already imported"}
                </Badge>
              </div>
            )}
            {item.text && (
              <DesignQuote
                accentColor={defaultPrimaryColor}
                className="type-quote max-w-prose break-words whitespace-pre-wrap"
                testimonial={item}
              />
            )}
            {item.type === "video" && (
              <div className="mt-3 grid gap-3">
                {item.videoStatus && (
                  <Badge
                    variant={
                      item.videoStatus === "failed"
                        ? "danger"
                        : item.videoStatus === "processing"
                          ? "warning"
                          : "success"
                    }
                  >
                    {item.videoStatus === "failed"
                      ? "Failed"
                      : item.videoStatus === "processing"
                        ? "Processing"
                        : "Ready"}
                  </Badge>
                )}
                {item.videoUrl && (
                  <video
                    controls
                    preload="none"
                    src={item.videoUrl}
                    aria-label={`Preview ${item.authorName}'s source video`}
                    className="bg-surface-2 max-h-48 w-full max-w-sm rounded-md"
                  />
                )}
                <p className="type-small text-ink-2 max-md:text-sm">
                  {item.videoStatus === "processing"
                    ? "Copying video"
                    : item.videoStatus === "ready"
                      ? "Video copied"
                      : item.videoStatus === "failed"
                        ? (item.failureReason ?? "Video copy failed")
                        : item.unavailableReason
                          ? "Video source unavailable"
                          : !videoEnabled
                            ? "Video import is unavailable. You can still import text testimonials."
                            : "Video · up to 10 minutes and 512 MB"}
                </p>
                {item.videoStatus === "failed" && onRetry && (
                  <Button
                    className="w-fit"
                    variant="outline"
                    disabled={disabled}
                    loading={retryingItemId === item._id}
                    onClick={() => void onRetry(item._id)}
                  >
                    Retry video
                  </Button>
                )}
              </div>
            )}
          </div>
          <label className="col-start-2 row-start-1 flex min-h-11 min-w-11 cursor-pointer items-center justify-center self-center md:col-start-3">
            <span className="sr-only">
              Select{" "}
              {item.identityCorrection?.authorName ??
                (item.authorName || "testimonial")}
            </span>
            <Checkbox
              checked={selected.has(item._id)}
              disabled={disabled || !canSelect(item, videoEnabled)}
              onCheckedChange={(checked) =>
                onSelect(item._id, checked === true)
              }
            />
          </label>
        </li>
      ))}
    </ul>
  );
}

export function TestimonialImportView({
  slug,
  jobId,
  provider,
  setProvider,
  url,
  setUrl,
  loading,
  saving,
  saveLoading = saving,
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
  reviewRemaining,
  onRetry,
  retryingItemId,
  onCorrectIdentity,
  onPhoto,
  typeFilter = "all",
  onTypeFilterChange,
  publicPreview = false,
  navigation,
  inboxAction,
  resultDetails,
  selectionReview,
  checkingSelection = false,
}: {
  slug: string;
  jobId: Id<"testimonialImportJobs"> | null;
  provider: "testimonial-to" | "senja";
  setProvider: (provider: "testimonial-to" | "senja") => void;
  url: string;
  setUrl: (url: string) => void;
  loading: boolean;
  saving: boolean;
  saveLoading?: boolean;
  error: string;
  result: FunctionReturnType<typeof api.testimonialImports.confirm> | null;
  preview:
    FunctionReturnType<typeof api.testimonialImports.getPreview> | undefined;
  selected: Set<Id<"testimonialImportItems">>;
  cursors: (string | null)[];
  setCursors: Dispatch<SetStateAction<(string | null)[]>>;
  changeSelection: (next: Set<Id<"testimonialImportItems">>) => void;
  backToUrl: () => void;
  read: () => Promise<void>;
  save: () => Promise<void>;
  reviewRemaining?: () => void;
  onRetry?: (id: Id<"testimonialImportItems">) => Promise<void>;
  retryingItemId?: Id<"testimonialImportItems"> | null;
  onPhoto?: (
    itemId: Id<"testimonialImportItems">,
    photo: Blob | null,
  ) => Promise<void>;
  onCorrectIdentity?: (
    itemId: Id<"testimonialImportItems">,
    identity: { authorName: string; tagline: string },
  ) => Promise<void>;
  typeFilter?: "all" | "text" | "video";
  onTypeFilterChange?: (type: "all" | "text" | "video") => void;
  publicPreview?: boolean;
  navigation?: React.ReactNode;
  inboxAction?: React.ReactNode;
  resultDetails?: React.ReactNode;
  selectionReview?: FunctionReturnType<typeof api.importEligibility.selection>;
  checkingSelection?: boolean;
}) {
  const [editingItem, setEditingItem] =
    useState<Doc<"testimonialImportItems"> | null>(null);
  const videoEnabled =
    publicPreview ||
    (!!preview?.videoCapacity.configured && !!preview?.videoCapacity.available);
  const eligible =
    preview?.items.page.filter((item) => canSelect(item, videoEnabled)) ?? [];
  const allSelected =
    eligible.length > 0 && eligible.every((item) => selected.has(item._id));

  return (
    <div
      className={`mx-auto grid w-full max-w-[1200px] gap-8 pb-24 max-md:[&_[data-slot=button]]:min-h-11 ${publicPreview ? "[&_[data-slot=button]]:min-h-11" : ""}`}
    >
      <PageHeader
        eyebrow={publicPreview ? undefined : "Workspace"}
        title={
          result
            ? result.processing
              ? "Importing your videos"
              : result.failed || result.unavailable
                ? "Review your import"
                : "Your testimonials are in"
            : jobId && preview === null
              ? "Preview unavailable"
              : jobId
                ? "Select testimonials"
                : "Import testimonials"
        }
        description={
          result
            ? "Review your imported testimonials in the Inbox before publishing."
            : jobId && preview === null
              ? "Start a fresh preview to continue importing your testimonials."
              : jobId
                ? publicPreview
                  ? "Choose the testimonials you want to bring into Get Some Proof."
                  : "Choose the testimonials you want to bring into this Project."
                : "Bring your existing Senja or Testimonial.to wall into Get Some Proof."
        }
        actions={
          navigation ?? (
            <Button asChild variant="ghost">
              <a href={publicPreview ? "/" : `/org/${slug}/inbox`}>
                {publicPreview ? "Get Some Proof" : "Back to Inbox"}
              </a>
            </Button>
          )
        }
      />

      <FieldError>{error}</FieldError>
      {result ? (
        <section className="grid gap-6" aria-live="polite">
          <p className="type-body">
            {result.imported} imported · {result.skipped} already imported ·{" "}
            {result.changed} changed at source · {result.unavailable}{" "}
            unavailable
            {result.failed !== undefined ? ` · ${result.failed} failed` : ""}
          </p>
          {!!result.processing && (
            <BlobLoadingText
              label={`${result.processing} ${result.processing === 1 ? "video" : "videos"} processing. You can leave this page and return later.`}
            />
          )}
          <p className="type-body text-ink-2 max-w-prose">
            Imported testimonials are Pending. Nothing has been published.
          </p>
          {resultDetails}
          <div className="flex flex-wrap gap-3">
            {inboxAction ?? (
              <Button asChild>
                <a
                  href={`/org/${slug}/inbox${jobId ? `?import=${encodeURIComponent(jobId)}` : ""}`}
                >
                  Open Inbox
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={backToUrl}>
              Import another wall
            </Button>
            {reviewRemaining &&
              preview &&
              (!!result.failed ||
                eligible.length > 0 ||
                !preview.items.isDone ||
                cursors.length > 1) && (
                <Button variant="ghost" onClick={reviewRemaining}>
                  Review remaining testimonials
                </Button>
              )}
          </div>
        </section>
      ) : !jobId ? (
        <section className="grid w-full max-w-2xl gap-6">
          <div aria-hidden="true">
            <ArrowNote size="sm" arrow="flat">
              Your proof, all together
            </ArrowNote>
          </div>
          <div
            role="group"
            aria-label="Wall provider"
            className="flex flex-wrap gap-3"
          >
            <Button
              variant="outline"
              aria-pressed={provider === "testimonial-to"}
              className="aria-pressed:bg-brand-soft aria-pressed:border-brand-soft-2 aria-pressed:font-semibold"
              disabled={loading}
              onClick={() => setProvider("testimonial-to")}
            >
              Testimonial.to
            </Button>
            <Button
              variant="outline"
              aria-pressed={provider === "senja"}
              className="aria-pressed:bg-brand-soft aria-pressed:border-brand-soft-2 aria-pressed:font-semibold"
              disabled={loading}
              onClick={() => setProvider("senja")}
            >
              Senja
            </Button>
          </div>
          <form
            className="grid gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              void read();
            }}
          >
            <Field>
              <Label htmlFor="wall-url">Public wall URL</Label>
              <Input
                id="wall-url"
                type="url"
                required
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={loading}
                placeholder={
                  provider === "senja"
                    ? "https://senja.io/p/your-project/wall-of-love"
                    : "https://testimonial.to/your-project/all"
                }
                aria-describedby="wall-url-help"
                aria-invalid={!!error}
              />
              <FieldDescription id="wall-url-help" className="max-md:text-sm">
                Paste the full address of your public wall. You can review and
                select testimonials before importing.
              </FieldDescription>
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" loading={loading} disabled={!url.trim()}>
                Preview testimonials
              </Button>
              {loading && (
                <Button type="button" variant="ghost" onClick={backToUrl}>
                  Cancel
                </Button>
              )}
            </div>
            {loading && (
              <BlobLoadingText
                label="Reading your wall…"
                className="text-ink-2"
              />
            )}
          </form>
          {!publicPreview && (
            <div className="border-line grid gap-4 border-t pt-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="grid gap-1">
                <h2 className="type-heading">Import with an assistant</h2>
                <p className="type-body text-ink-2 max-w-prose">
                  Use Claude Code or Codex to bring testimonials from another
                  page.
                </p>
              </div>
              <Button asChild variant="outline">
                <a href={`/org/${slug}/mcp`}>Import with an assistant</a>
              </Button>
            </div>
          )}
        </section>
      ) : preview === null ? (
        <EmptyState
          headingLevel={2}
          illustration={<WallFrames className="h-40" />}
          title="This preview is no longer available"
          description="It may have expired or belong to another Project. Read your wall again to start a new preview."
          action={<Button onClick={backToUrl}>Read a wall again</Button>}
        />
      ) : preview === undefined ? (
        <BlobLoader label="Loading your preview…" showLabel />
      ) : (
        <section className="grid gap-6">
          {onTypeFilterChange && (
            <div
              role="group"
              aria-label="Testimonial format"
              className="flex flex-wrap gap-3"
            >
              {(["all", "text", "video"] as const).map((type) => (
                <Button
                  key={type}
                  variant="outline"
                  disabled={saving}
                  aria-pressed={typeFilter === type}
                  className="aria-pressed:bg-brand-soft aria-pressed:border-brand-soft-2"
                  onClick={() => onTypeFilterChange(type)}
                >
                  {type === "all"
                    ? "All formats"
                    : type === "text"
                      ? "Text"
                      : "Video"}
                </Button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="type-small text-ink-2 max-md:text-sm">
              {preview.itemCount}{" "}
              {preview.itemCount === 1 ? "testimonial" : "testimonials"} on this
              wall
              {preview.videoCapacity.configured && (
                <>
                  {" "}
                  ·{" "}
                  {Math.max(
                    0,
                    preview.videoCapacity.limit - preview.videoCapacity.used,
                  )}{" "}
                  of {preview.videoCapacity.limit} video storage places
                  available
                </>
              )}
            </p>
            <label className="type-ui flex min-h-11 cursor-pointer items-center gap-3">
              <Checkbox
                disabled={saving || !eligible.length}
                checked={allSelected}
                onCheckedChange={(checked) => {
                  const next = new Set(selected);
                  for (const item of eligible) {
                    if (checked && next.size < 100) next.add(item._id);
                    else if (!checked) next.delete(item._id);
                  }
                  changeSelection(next);
                }}
              />
              Select this page
            </label>
          </div>
          {preview.items.page.length ? (
            <ImportPreviewList
              onEdit={onCorrectIdentity ? setEditingItem : undefined}
              items={preview.items.page}
              selected={selected}
              disabled={saving}
              videoEnabled={videoEnabled}
              onRetry={onRetry}
              retryingItemId={retryingItemId}
              onSelect={(id, checked) => {
                const next = new Set(selected);
                if (checked && next.size < 100) next.add(id);
                else if (!checked) next.delete(id);
                changeSelection(next);
              }}
            />
          ) : (
            <p className="type-body">
              {typeFilter === "all"
                ? "No testimonials were found on this wall."
                : `No ${typeFilter} testimonials in this preview.`}
            </p>
          )}
          {(cursors.length > 1 || !preview.items.isDone) && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                disabled={cursors.length === 1 || saving}
                onClick={() => setCursors((previous) => previous.slice(0, -1))}
              >
                Previous page
              </Button>
              <Button
                variant="outline"
                disabled={preview.items.isDone || saving}
                onClick={() =>
                  setCursors((previous) => [
                    ...previous,
                    preview.items.continueCursor,
                  ])
                }
              >
                Next page
              </Button>
            </div>
          )}
          <div className="bg-paper border-line flex flex-wrap items-center justify-between gap-4 border-t py-4 md:sticky md:bottom-0">
            <div>
              <p className="type-ui" aria-live="polite">
                {selected.size} selected
              </p>
              {checkingSelection && (
                <BlobLoadingText label="Checking your selection…" />
              )}
              {selectionReview && (
                <div
                  className="type-small text-ink-2 mt-2 grid gap-2 max-md:text-sm"
                  aria-live="polite"
                >
                  <p>
                    {selectionReview.text + selectionReview.video} importable:{" "}
                    {selectionReview.text} text · {selectionReview.video} video
                  </p>
                  {!!(
                    selectionReview.duplicates +
                    selectionReview.changed +
                    selectionReview.unavailable +
                    selectionReview.videoCapacityExceeded
                  ) && (
                    <>
                      <p>
                        {selectionReview.duplicates} already imported ·{" "}
                        {selectionReview.changed} changed at source ·{" "}
                        {selectionReview.unavailable} unavailable ·{" "}
                        {selectionReview.videoCapacityExceeded} videos without
                        storage
                      </p>
                      <Button
                        className="w-fit"
                        variant="outline"
                        disabled={
                          saving || !selectionReview.eligibleKeys.length
                        }
                        onClick={() =>
                          changeSelection(
                            new Set(
                              selectionReview.eligibleKeys as Id<"testimonialImportItems">[],
                            ),
                          )
                        }
                      >
                        Keep importable testimonials
                      </Button>
                    </>
                  )}
                </div>
              )}
              <p className="type-small text-ink-2 max-md:text-sm">
                {publicPreview
                  ? "Select up to 100. Sign in to choose a Project and check video capacity."
                  : "Import up to 100 at a time. Text imports use no Collection Credits."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="ghost" disabled={saving} onClick={backToUrl}>
                Back
              </Button>
              <Button
                variant="ghost"
                disabled={saving || !selected.size}
                onClick={() => changeSelection(new Set())}
              >
                Clear
              </Button>
              <Button
                disabled={
                  saving ||
                  !selected.size ||
                  checkingSelection ||
                  (!!selectionReview &&
                    (selectionReview.videoCapacityExceeded > 0 ||
                      !selectionReview.eligibleKeys.length))
                }
                loading={saveLoading}
                onClick={() => void save()}
              >
                {publicPreview ? "Continue to save" : "Import testimonials"}
              </Button>
            </div>
          </div>
        </section>
      )}
      {editingItem && onCorrectIdentity && (
        <ImportIdentityDialog
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onPhoto={
            onPhoto ? (photo) => onPhoto(editingItem._id, photo) : undefined
          }
          onSave={(identity) => onCorrectIdentity(editingItem._id, identity)}
        />
      )}
    </div>
  );
}
