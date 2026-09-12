"use client";
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

import { BlobLoader } from "@/components/brand/blob-loader";

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
import { Textarea } from "@/components/ui/textarea";
import { uploadProfileImage } from "@/lib/upload-profile-image";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function EmbeddedWallSnippet({
  embedOrigin,
  publicSlug,
}: {
  embedOrigin: string;
  publicSlug: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const snippet = embedOrigin
    ? `<div data-gsp-wall data-public-slug="${publicSlug}" data-theme="system"></div>\n<script async src="${embedOrigin}/embed/v1.js" data-api-origin="${embedOrigin}"></script>`
    : "";

  async function copy() {
    setError(null);
    setSuccess(null);
    try {
      await navigator.clipboard.writeText(snippet);
      setSuccess("Embed snippet copied.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Copy failed.");
    }
  }

  return (
    <div
      className="bg-card scroll-mt-24 space-y-4 rounded-lg border p-5"
      id="embed"
    >
      <div>
        <h2 className="type-subheading">Embedded Wall</h2>
        <p className="text-ink-2 mt-1 text-sm">
          Paste this snippet where your website accepts custom HTML. It inherits
          the host font and never uses an iframe.
        </p>
      </div>
      <Field>
        <Label htmlFor="embed-snippet">Embed snippet</Label>
        <Textarea
          className="min-h-28 font-mono text-xs"
          id="embed-snippet"
          readOnly
          value={snippet}
        />
      </Field>
      {error ? <ErrorToast message={error} /> : null}
      {success ? <SuccessToast message={success} /> : null}
      <Button
        disabled={!snippet}
        onClick={() => void copy()}
        type="button"
        variant="outline"
      >
        Copy embed snippet
      </Button>
    </div>
  );
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
  const exportWorkspace = useAction(api.workspaceDeletion.exportData);
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
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <BlobLoader label="Loading settings…" showLabel />
      </div>
    );
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
              onExport: async () => {
                const data = await exportWorkspace({ organizationId });
                const url = URL.createObjectURL(
                  new Blob([data], { type: "application/json" }),
                );
                const link = document.createElement("a");
                link.download = `${organization.publicSlug}-export.json`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
              },
            }
          : undefined
      }
    />
  );
}

export function OrganizationSettingsView({
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
    onExport: () => Promise<void>;
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
    <section aria-labelledby="settings-heading" className="space-y-8">
      <PageHeader
        description="Update the identity shared across your public proof surfaces."
        title={<span id="settings-heading">Brand settings</span>}
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,42rem)_minmax(0,1fr)] lg:items-start">
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
        <nav
          aria-label="Settings sections"
          className="hidden lg:sticky lg:top-24 lg:block"
        >
          <p className="type-micro text-ink-2 mb-2 px-2">On this page</p>
          <ul className="space-y-0.5">
            {[
              ["logo", "Brand logo"],
              ...(canUpdate ? [["identity", "Identity"]] : []),
              ...(canChangePublicSlug ? [["address", "Public address"]] : []),
              ...(canManageWall && wallSettings
                ? [["wall", "Public Wall"]]
                : []),
              ...(canUpdate ? [["embed", "Embedded Wall"]] : []),
              ...(workspaceDeletion ? [["danger", "Delete Project"]] : []),
            ].map(([id, label]) => (
              <li key={id}>
                <a
                  className="text-ink-2 hover:text-ink hover:bg-accent block rounded-md px-2 py-1.5 text-sm transition-colors"
                  href={`#${id}`}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
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
  onExport: () => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState(initialConfirmation);
  const [dialogOpen, setDialogOpen] = useState(initialDialogOpen);
  const [pending, setPending] = useState<"delete" | "export" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setPending("export");
    setError(null);
    try {
      await onExport();
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
          Download data first
        </Button>
      </div>
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
