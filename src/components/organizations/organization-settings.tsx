"use client";
import type { ExportProgress } from "@/lib/export-progress";
import { ExportProgressDialog } from "./export-progress-dialog";
import { downloadProjectExport } from "@/lib/download-project-export";
import { EmbeddedWallSnippet } from "./embedded-wall-snippet";
import {
  MediaDeletionProgress,
  type MediaDeletionCounts,
} from "@/components/ui/media-deletion-progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { AnimatedBlob } from "@/components/brand/animated-blob";

import { type FormEvent, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { publicSlugFromBrandName } from "@convex/domain/brand";
import { ProfileImageControl } from "@/components/profile-image/profile-image-control";
import {
  PublicWallSettings,
  type PublicWallSettingsValue,
} from "@/components/organizations/public-wall-settings";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ErrorToast, SuccessToast } from "@/components/ui/error-toast";
import { Field, FieldDescription } from "@/components/ui/field";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadProfileImage } from "@/lib/upload-profile-image";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function OrganizationSettings({
  embedOrigin,
  slug,
}: {
  embedOrigin: string;
  slug: string;
}) {
  const organization = useQuery(api.organizations.getBySlug, { slug });
  const deletionBySlug = useQuery(api.workspaceDeletion.getByOrganizationSlug, {
    slug,
  });
  const [startedDeletion, setStartedDeletion] = useState<{
    brandName: string;
    deletionId: Id<"workspaceDeletions">;
    organizationId: Id<"organizations">;
  } | null>(null);
  const deletionStatus = useQuery(
    api.workspaceDeletion.getStatus,
    startedDeletion ? { deletionId: startedDeletion.deletionId } : "skip",
  );
  const access = useQuery(
    api.organizationAuthorization.getMine,
    organization ? { organizationId: organization.id } : "skip",
  );
  const rename = useMutation(api.organizations.rename);
  const changePublicSlug = useMutation(api.organizations.changePublicSlug);
  const generateUploadUrl = useMutation(
    api.organizations.generateLogoUploadUrl,
  );
  const processImage = useAction(api.imageAssetProcessing.processDirectUpload);
  const setLogo = useMutation(api.organizations.setLogo);
  const removeLogo = useMutation(api.organizations.removeLogo);
  const wallSettings = useQuery(
    api.wallCustomization.getSettings,
    organization ? { organizationId: organization.id } : "skip",
  );
  const updateWallSettings = useMutation(api.wallCustomization.updateSettings);
  const deleteWorkspace = useAction(api.workspaceDeletion.remove);

  if (deletionStatus?.status === "deleted") redirect("/dashboard");

  const activeDeletion = startedDeletion
    ? {
        ...startedDeletion,
        mediaProgress:
          deletionStatus?.mediaProgress ?? deletionBySlug?.mediaProgress,
        lastError: deletionStatus?.lastError,
        phase: deletionStatus?.phase ?? deletionBySlug?.phase ?? "queued",
        status:
          deletionStatus?.status ??
          deletionBySlug?.status ??
          ("requested" as const),
      }
    : deletionBySlug;

  if (activeDeletion) {
    return (
      <WorkspaceDeletionProgress
        mediaProgress={activeDeletion.mediaProgress}
        brandName={activeDeletion.brandName}
        lastError={activeDeletion.lastError}
        onRetry={async () => {
          const result = await deleteWorkspace({
            brandName: activeDeletion.brandName,
            irreversibleConfirmed: true,
            organizationId: activeDeletion.organizationId,
          });
          setStartedDeletion({
            brandName: activeDeletion.brandName,
            deletionId: result.deletionId,
            organizationId: activeDeletion.organizationId,
          });
        }}
        phase={activeDeletion.phase}
        status={activeDeletion.status}
      />
    );
  }

  if (
    organization === undefined ||
    deletionBySlug === undefined ||
    (organization && (access === undefined || wallSettings === undefined))
  ) {
    return <OrganizationSettingsSkeleton />;
  }

  if (organization === null) {
    return (
      <section className="grid min-h-[50vh] place-items-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Brand unavailable</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            This Brand does not exist or you no longer have access to it.
          </p>
        </div>
      </section>
    );
  }

  const organizationId = organization.id;

  async function renameOrganization(name: string) {
    await rename({ organizationId, name });
  }

  async function uploadLogo(blob: Blob) {
    const uploadUrl = await generateUploadUrl({ organizationId });
    const image = await uploadProfileImage(
      blob,
      uploadUrl,
      "brandLogo",
      processImage,
      { kind: "brandLogo", organizationId },
    );
    await setLogo({ organizationId, verificationId: image.verificationId });
  }

  return (
    <OrganizationSettingsView
      canChangePublicSlug={access?.can.manageOwnership ?? false}
      canManageWall={access?.can.manageOwnership ?? false}
      canUpdate={access?.can.updateOrganization ?? false}
      embedOrigin={embedOrigin}
      logoUrl={organization.logoUrl}
      name={organization.name}
      onChangePublicSlug={async (publicSlug) => {
        await changePublicSlug({ organizationId, publicSlug });
      }}
      onRemoveLogo={async () => {
        await removeLogo({ organizationId });
      }}
      onRename={renameOrganization}
      onUploadLogo={uploadLogo}
      onUpdateWallSettings={async (settings) => {
        await updateWallSettings({ organizationId, ...settings });
      }}
      publicSlug={organization.publicSlug}
      publicSlugCanChange={organization.publicSlugCanChange}
      wallSettings={wallSettings}
      workspaceDeletion={
        access?.can.manageOwnership
          ? {
              onDelete: async (brandName) => {
                const result = await deleteWorkspace({
                  brandName,
                  irreversibleConfirmed: true,
                  organizationId,
                });
                setStartedDeletion({
                  brandName,
                  deletionId: result.deletionId,
                  organizationId,
                });
              },
              onExport: async (onProgress) => {
                await downloadProjectExport(
                  organizationId,
                  organization.publicSlug,
                  onProgress,
                );
              },
            }
          : undefined
      }
    />
  );
}

const settingsLoadingAction = async () => {};

export function OrganizationSettingsSkeleton() {
  return (
    <OrganizationSettingsView
      loading
      canChangePublicSlug
      canManageWall
      canUpdate
      embedOrigin=""
      logoUrl={null}
      name=""
      publicSlug=""
      publicSlugCanChange
      onChangePublicSlug={settingsLoadingAction}
      onRemoveLogo={settingsLoadingAction}
      onRename={settingsLoadingAction}
      onUploadLogo={settingsLoadingAction}
      onUpdateWallSettings={settingsLoadingAction}
      wallSettings={{
        accentColor: "#ffbb16",
        canHideAttribution: false,
        hideAttribution: false,
        theme: "system",
        transparentEmbed: false,
        visibility: { avatar: true, company: true, rating: true, role: true },
      }}
      workspaceDeletion={{
        onDelete: settingsLoadingAction,
        onExport: settingsLoadingAction,
      }}
    />
  );
}

export function OrganizationSettingsView({
  loading = false,
  canChangePublicSlug,
  canManageWall,
  canUpdate,
  embedOrigin,
  logoUrl,
  name,
  onChangePublicSlug,
  onRemoveLogo,
  onRename,
  onUploadLogo,
  onUpdateWallSettings,
  publicSlug,
  publicSlugCanChange,
  wallSettings,
  workspaceDeletion,
}: {
  loading?: boolean;
  canChangePublicSlug: boolean;
  canManageWall: boolean;
  canUpdate: boolean;
  embedOrigin: string;
  logoUrl: string | null;
  name: string;
  onChangePublicSlug: (publicSlug: string) => Promise<void>;
  onRemoveLogo: () => Promise<void>;
  onRename: (name: string) => Promise<void>;
  onUploadLogo: (blob: Blob) => Promise<void>;
  onUpdateWallSettings?: (
    settings: Omit<PublicWallSettingsValue, "canHideAttribution">,
  ) => Promise<void>;
  publicSlug: string;
  publicSlugCanChange: boolean;
  wallSettings?: PublicWallSettingsValue;
  workspaceDeletion?: {
    onDelete: (brandName: string) => Promise<void>;
    onExport: (
      onProgress?: (progress: ExportProgress) => void,
    ) => Promise<void>;
  };
}) {
  const [pending, setPending] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [slugPending, setSlugPending] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugSuccess, setSlugSuccess] = useState<string | null>(null);
  const [nextPublicSlug, setNextPublicSlug] = useState(publicSlug);
  const displayedPublicSlug = publicSlugCanChange ? nextPublicSlug : publicSlug;

  async function updateName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setNameError(null);
    setNameSuccess(null);
    try {
      await onRename(String(new FormData(form).get("name")));
      setNameSuccess("Brand name updated.");
    } catch (error) {
      setNameError(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setPending(false);
    }
  }

  async function updatePublicSlug(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSlugPending(true);
    setSlugError(null);
    setSlugSuccess(null);
    try {
      await onChangePublicSlug(nextPublicSlug);
      setSlugSuccess("Public slug changed permanently.");
    } catch (error) {
      setSlugError(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setSlugPending(false);
    }
  }

  return (
    <section
      aria-labelledby="settings-heading"
      className="space-y-8"
      aria-busy={loading || undefined}
    >
      <PageHeader
        description="Update the identity shared across your public proof surfaces."
        title={<span id="settings-heading">Brand settings</span>}
      />

      {loading ? (
        <span className="sr-only" role="status">
          Loading project settings…
        </span>
      ) : null}
      <div
        inert={loading || undefined}
        className={`grid gap-6 ${loading ? "[&_input]:bg-muted [&_textarea]:bg-muted [&_[data-slot=avatar]]:animate-pulse [&_[data-slot=avatar]]:text-transparent [&_button]:pointer-events-none [&_button]:opacity-50 [&_input]:animate-pulse [&_input]:text-transparent [&_textarea]:animate-pulse [&_textarea]:text-transparent" : ""}`}
      >
        <div className="space-y-6">
          <div className="bg-card scroll-mt-24 rounded-lg border p-5" id="logo">
            <ProfileImageControl
              alt={`${name} logo`}
              cropShape="rect"
              fallback={initials(name) || "OR"}
              imageUrl={logoUrl}
              label="Brand logo"
              onRemove={onRemoveLogo}
              onUpload={onUploadLogo}
              preserveRatio
              readOnly={!canUpdate}
            />
          </div>

          {canUpdate ? (
            <form
              className="bg-card scroll-mt-24 space-y-5 rounded-lg border p-5"
              id="identity"
              onSubmit={updateName}
            >
              <div>
                <h2 className="type-subheading">Identity</h2>
                <p className="text-ink-2 mt-1 text-sm">
                  The name shown on your Collection Form and Wall.
                </p>
              </div>
              <Field>
                <Label htmlFor="organization-name">Brand name</Label>
                <Input
                  defaultValue={name}
                  id="organization-name"
                  name="name"
                  required
                />
              </Field>
              {nameError ? <ErrorToast message={nameError} /> : null}
              {nameSuccess ? <SuccessToast message={nameSuccess} /> : null}
              <Button loading={pending} type="submit">
                Save settings
              </Button>
            </form>
          ) : (
            <div className="bg-card rounded-lg border p-5">
              <p className="font-medium">Settings are read-only</p>
              <p className="text-ink-2 mt-1 text-sm">
                Only the Owner can update Brand settings.
              </p>
            </div>
          )}

          {canChangePublicSlug ? (
            <form
              className="bg-card scroll-mt-24 space-y-4 rounded-lg border p-5"
              id="address"
              onSubmit={updatePublicSlug}
            >
              <div>
                <h2 className="type-subheading">Public address</h2>
                <p className="text-ink-2 mt-1 text-sm">
                  Used by your Collection Form, Wall and embed links.
                </p>
              </div>
              <Field>
                <Label htmlFor="public-slug">Public slug</Label>
                <Input
                  aria-describedby="public-slug-help"
                  autoComplete="off"
                  data-form-type="other"
                  disabled={!publicSlugCanChange}
                  id="public-slug"
                  maxLength={48}
                  minLength={2}
                  onChange={(event) =>
                    setNextPublicSlug(
                      publicSlugFromBrandName(event.target.value),
                    )
                  }
                  required
                  value={displayedPublicSlug}
                />
                <FieldDescription id="public-slug-help">
                  {publicSlugCanChange
                    ? "You can change this once. Old collection, wall, and embed links will stop working immediately."
                    : "Your one Public Slug change has been used."}
                </FieldDescription>
              </Field>
              {slugError ? <ErrorToast message={slugError} /> : null}
              {slugSuccess ? <SuccessToast message={slugSuccess} /> : null}
              {publicSlugCanChange ? (
                <Button
                  disabled={nextPublicSlug === publicSlug}
                  loading={slugPending}
                  type="submit"
                  variant="destructive"
                >
                  Change public slug permanently
                </Button>
              ) : null}
            </form>
          ) : null}

          <PublicWallSettingsSection
            canUpdate={canManageWall}
            onSave={onUpdateWallSettings}
            settings={wallSettings}
          />

          {canUpdate ? (
            <EmbeddedWallSnippet
              embedOrigin={embedOrigin}
              publicSlug={publicSlug}
            />
          ) : null}

          {workspaceDeletion ? (
            <WorkspaceDeletionSection
              brandName={name}
              onDelete={workspaceDeletion.onDelete}
              onExport={workspaceDeletion.onExport}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function WorkspaceDeletionProgress({
  mediaProgress,
  brandName,
  lastError,
  onRetry,
  status,
}: {
  mediaProgress?: MediaDeletionCounts;
  brandName: string;
  lastError?: string;
  onRetry: () => Promise<void>;
  phase: string;
  status: "requested" | "failed" | "deleted";
}) {
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [progressOpen, setProgressOpen] = useState(true);

  async function retry() {
    setRetrying(true);
    setRetryError(null);
    try {
      await onRetry();
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : "Retry failed.");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4 px-6 py-12">
      {status === "requested" ? (
        <AnimatedBlob size={64} variant="look" />
      ) : null}
      <div>
        <h1 className="type-heading">Project deletion</h1>
        <p className="type-body text-ink-2 mt-2">
          Public access is disabled and will not be restored. You may leave this
          page; deletion continues in the background.
        </p>
      </div>
      <Button variant="outline" onClick={() => setProgressOpen(true)}>
        View deletion progress
      </Button>
      <Dialog open={progressOpen} onOpenChange={setProgressOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deleting {brandName}</DialogTitle>
            <DialogDescription>
              Images and videos are cleaned up before the project is deleted.
            </DialogDescription>
          </DialogHeader>
          <MediaDeletionProgress progress={mediaProgress} status={status} />
          {lastError || retryError ? (
            <ErrorToast message={(retryError ?? lastError)!} />
          ) : null}
          {status === "failed" ? (
            <Button
              loading={retrying}
              onClick={() => void retry()}
              type="button"
            >
              Retry cleanup now
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function WorkspaceDeletionSection({
  brandName,
  initialConfirmation = "",
  initialDialogOpen = false,
  onDelete,
  onExport,
}: {
  brandName: string;
  initialConfirmation?: string;
  initialDialogOpen?: boolean;
  onDelete: (brandName: string) => Promise<void>;
  onExport: (onProgress?: (progress: ExportProgress) => void) => Promise<void>;
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
    phase: "preparing",
    processed: 0,
    total: 0,
    failed: 0,
  });
  const [confirmation, setConfirmation] = useState(initialConfirmation);
  const [dialogOpen, setDialogOpen] = useState(initialDialogOpen);
  const [pending, setPending] = useState<"delete" | "export" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setExportOpen(true);
    setExportProgress({
      phase: "preparing",
      processed: 0,
      total: 0,
      failed: 0,
    });
    setPending("export");
    setError(null);
    try {
      await onExport(setExportProgress);
      setExportProgress((current) => ({ ...current, phase: "done" }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Export failed.");
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    setPending("delete");
    setError(null);
    try {
      await onDelete(confirmation);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Deletion failed.");
      setDialogOpen(false);
      setPending(null);
    }
  }

  return (
    <div
      className="border-danger/40 bg-card scroll-mt-24 space-y-4 rounded-lg border p-5"
      id="danger"
    >
      <ExportProgressDialog
        open={exportOpen}
        pending={pending === "export"}
        progress={exportProgress}
        error={error}
        onClose={() => setExportOpen(false)}
        onRetry={() => void download()}
      />
      <div>
        <h2 className="type-subheading">Delete Project</h2>
        <p className="text-ink-2 mt-1 text-sm">
          This permanently removes the Collection Form, Public Wall, Embed,
          private data, and every hosted video in this project. There is no
          recovery window. Your subscription and consumed Free credits remain
          unchanged.
        </p>
      </div>
      <div>
        <Button
          disabled={pending === "delete"}
          loading={pending === "export"}
          onClick={() => void download()}
          type="button"
          variant="outline"
        >
          Download ZIP backup
        </Button>
      </div>
      <p
        className="text-ink-2 text-sm"
        role={pending === "export" ? "status" : undefined}
      >
        {pending === "export"
          ? "Preparing your ZIP with images, videos and data. Keep this page open; videos may take several minutes."
          : "Includes hosted images, videos, data.json and an export report. Check the archive before deleting this project."}
      </p>
      <Link className="text-sm underline" href="/account/billing">
        Manage subscription
      </Link>
      <Field>
        <Label htmlFor="delete-workspace-name">
          Type <span className="font-semibold">{brandName}</span> to continue
        </Label>
        <Input
          autoComplete="off"
          id="delete-workspace-name"
          onChange={(event) => setConfirmation(event.target.value)}
          value={confirmation}
        />
      </Field>
      {error ? <ErrorToast message={error} /> : null}
      <Button
        disabled={confirmation !== brandName || pending !== null}
        onClick={() => setDialogOpen(true)}
        type="button"
        variant="destructive"
      >
        Review irreversible deletion
      </Button>

      <AlertDialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete {brandName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Public access stops immediately. Your account subscription
              continues, even if this is your last project. All project records,
              tokens, captions, thumbnails, renditions, and source videos are
              deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row">
            <AlertDialogCancel disabled={pending === "delete"}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                loading={pending === "delete"}
                onClick={() => void remove()}
                variant="destructive"
              >
                Delete Project permanently
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PublicWallSettingsSection({
  canUpdate,
  onSave,
  settings,
}: {
  canUpdate: boolean;
  onSave?: (
    settings: Omit<PublicWallSettingsValue, "canHideAttribution">,
  ) => Promise<void>;
  settings?: PublicWallSettingsValue;
}) {
  if (!canUpdate || !onSave || !settings) return null;

  return <PublicWallSettings onSave={onSave} settings={settings} />;
}
