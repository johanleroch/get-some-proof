"use client";

import { type FormEvent, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
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
  const [message, setMessage] = useState<string | null>(null);
  const snippet = embedOrigin
    ? `<div data-gsp-wall data-public-slug="${publicSlug}" data-theme="system"></div>\n<script async src="${embedOrigin}/embed/v1.js" data-api-origin="${embedOrigin}"></script>`
    : "";

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setMessage("Embed snippet copied.");
  }

  return (
    <div className="bg-card max-w-2xl space-y-4 rounded-xl border p-6 shadow-xs">
      <div>
        <h2 className="font-semibold">Embedded Wall</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Paste this snippet where your website accepts custom HTML. It inherits
          the host font and never uses an iframe.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="embed-snippet">Embed snippet</Label>
        <Textarea
          className="min-h-28 font-mono text-xs"
          id="embed-snippet"
          readOnly
          value={snippet}
        />
      </div>
      {message ? (
        <p className="text-sm" role="status">
          {message}
        </p>
      ) : null}
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
        <p className="text-muted-foreground text-sm">Loading settings…</p>
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
    const storageId = await uploadProfileImage(blob, uploadUrl);
    await setLogo({ organizationId, storageId });
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
              inboxHref: `/org/${slug}/inbox`,
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
    inboxHref: string;
    onDelete: (brandName: string) => Promise<void>;
    onExport: () => Promise<void>;
  };
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [slugPending, setSlugPending] = useState(false);
  const [slugMessage, setSlugMessage] = useState<string | null>(null);
  const [nextPublicSlug, setNextPublicSlug] = useState(publicSlug);
  const displayedPublicSlug = publicSlugCanChange ? nextPublicSlug : publicSlug;

  async function updateName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setMessage(null);
    try {
      await onRename(String(new FormData(form).get("name")));
      setMessage("Brand name updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setPending(false);
    }
  }

  async function updatePublicSlug(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSlugPending(true);
    setSlugMessage(null);
    try {
      await onChangePublicSlug(nextPublicSlug);
      setSlugMessage("Public slug changed permanently.");
    } catch (error) {
      setSlugMessage(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setSlugPending(false);
    }
  }

  return (
    <section aria-labelledby="settings-heading" className="space-y-6">
      <div>
        <h1 className="dashboard-page-title" id="settings-heading">
          Brand settings
        </h1>
        <p className="dashboard-page-description mt-1">
          Update the identity shared across your public proof surfaces.
        </p>
      </div>

      <div className="bg-card max-w-2xl rounded-xl border p-6 shadow-xs">
        <ProfileImageControl
          alt={`${name} logo`}
          cropShape="rect"
          fallback={initials(name) || "OR"}
          imageUrl={logoUrl}
          label="Brand logo"
          onRemove={onRemoveLogo}
          onUpload={onUploadLogo}
          readOnly={!canUpdate}
        />
      </div>

      {canUpdate ? (
        <form
          className="bg-card max-w-2xl space-y-5 rounded-xl border p-6 shadow-xs"
          onSubmit={updateName}
        >
          <div className="space-y-2">
            <Label htmlFor="organization-name">Brand name</Label>
            <Input
              defaultValue={name}
              id="organization-name"
              name="name"
              required
            />
          </div>
          {message ? (
            <p aria-live="polite" className="text-sm">
              {message}
            </p>
          ) : null}
          <Button disabled={pending} type="submit">
            {pending ? "Saving…" : "Save settings"}
          </Button>
        </form>
      ) : (
        <div className="bg-card max-w-2xl rounded-xl border p-6 shadow-xs">
          <p className="font-medium">Settings are read-only</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Only the Owner can update Brand settings.
          </p>
        </div>
      )}

      {canChangePublicSlug ? (
        <form
          className="bg-card max-w-2xl space-y-4 rounded-xl border p-6 shadow-xs"
          onSubmit={updatePublicSlug}
        >
          <div className="space-y-2">
            <Label htmlFor="public-slug">Public slug</Label>
            <Input
              aria-describedby="public-slug-help"
              disabled={!publicSlugCanChange}
              id="public-slug"
              maxLength={48}
              minLength={2}
              onChange={(event) =>
                setNextPublicSlug(publicSlugFromBrandName(event.target.value))
              }
              required
              value={displayedPublicSlug}
            />
            <p className="text-muted-foreground text-xs" id="public-slug-help">
              {publicSlugCanChange
                ? "You can change this once. Old collection, wall, and embed links will stop working immediately."
                : "Your one Public Slug change has been used."}
            </p>
          </div>
          {slugMessage ? (
            <p aria-live="polite" className="text-sm">
              {slugMessage}
            </p>
          ) : null}
          {publicSlugCanChange ? (
            <Button
              disabled={slugPending || nextPublicSlug === publicSlug}
              type="submit"
              variant="destructive"
            >
              {slugPending ? "Changing…" : "Change public slug permanently"}
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
          inboxHref={workspaceDeletion.inboxHref}
          onDelete={workspaceDeletion.onDelete}
          onExport={workspaceDeletion.onExport}
        />
      ) : null}
    </section>
  );
}

export function WorkspaceDeletionProgress({
  brandName,
  lastError,
  onRetry,
  phase,
  status,
}: {
  brandName: string;
  lastError?: string;
  onRetry: () => Promise<void>;
  phase: string;
  status: "requested" | "failed" | "deleted";
}) {
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const phaseLabel =
    phase === "providerCleanup" || phase === "media"
      ? "Deleting hosted videos"
      : phase.startsWith("stripe")
        ? "Removing billing records"
        : phase === "complete"
          ? "Finishing deletion"
          : "Removing private Workspace data";

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
      <div>
        <h1 className="text-2xl font-semibold">Deleting {brandName}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Public access is disabled and will not be restored. You may leave this
          page; deletion continues in the background.
        </p>
      </div>
      <div className="bg-card space-y-3 rounded-xl border p-6 shadow-xs">
        <p className="font-medium" role="status">
          {status === "failed" ? "Cleanup needs another attempt" : phaseLabel}
        </p>
        <p className="text-muted-foreground text-sm">
          {status === "failed"
            ? "A provider cleanup step failed. The Workspace remains private and the same deletion can be resumed safely."
            : "The durable cleanup is progressing in small, retryable steps."}
        </p>
        {lastError || retryError ? (
          <p className="text-destructive text-sm" role="alert">
            {retryError ?? lastError}
          </p>
        ) : null}
        {status === "failed" ? (
          <Button
            disabled={retrying}
            onClick={() => void retry()}
            type="button"
          >
            {retrying ? "Retrying cleanup…" : "Retry cleanup now"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

export function WorkspaceDeletionSection({
  brandName,
  inboxHref,
  initialConfirmation = "",
  initialDialogOpen = false,
  onDelete,
  onExport,
}: {
  brandName: string;
  inboxHref: string;
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
    <div className="border-destructive/40 bg-card max-w-2xl space-y-4 rounded-xl border p-6 shadow-xs">
      <div>
        <h2 className="font-semibold">Delete Workspace</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          This permanently removes the Collection Form, Public Wall, Embed,
          private data, and every hosted video. There is no recovery window.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          disabled={pending !== null}
          onClick={() => void download()}
          type="button"
          variant="outline"
        >
          {pending === "export" ? "Preparing export…" : "Download data first"}
        </Button>
        <Button asChild variant="outline">
          <a href={inboxHref}>Download eligible MP4s from Inbox</a>
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="delete-workspace-name">
          Type <span className="font-semibold">{brandName}</span> to continue
        </Label>
        <Input
          autoComplete="off"
          id="delete-workspace-name"
          onChange={(event) => setConfirmation(event.target.value)}
          value={confirmation}
        />
      </div>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
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
              Public access stops immediately. Billing is canceled and all
              private records, tokens, captions, thumbnails, renditions, and
              source videos are deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row">
            <AlertDialogCancel disabled={pending === "delete"}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                disabled={pending === "delete"}
                onClick={() => void remove()}
                variant="destructive"
              >
                {pending === "delete"
                  ? "Deleting Workspace…"
                  : "Delete Workspace permanently"}
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
