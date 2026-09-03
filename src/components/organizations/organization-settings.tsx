"use client";

import { type FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { publicSlugFromBrandName } from "@convex/domain/brand";
import { ProfileImageControl } from "@/components/profile-image/profile-image-control";
import { Button } from "@/components/ui/button";
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

export function OrganizationSettings({ slug }: { slug: string }) {
  const organization = useQuery(api.organizations.getBySlug, { slug });
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

  if (organization === undefined || (organization && access === undefined)) {
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
      canUpdate={access?.can.updateOrganization ?? false}
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
      publicSlug={organization.publicSlug}
      publicSlugCanChange={organization.publicSlugCanChange}
    />
  );
}

export function OrganizationSettingsView({
  canChangePublicSlug,
  canUpdate,
  logoUrl,
  name,
  onChangePublicSlug,
  onRemoveLogo,
  onRename,
  onUploadLogo,
  publicSlug,
  publicSlugCanChange,
}: {
  canChangePublicSlug: boolean;
  canUpdate: boolean;
  logoUrl: string | null;
  name: string;
  onChangePublicSlug: (publicSlug: string) => Promise<void>;
  onRemoveLogo: () => Promise<void>;
  onRename: (name: string) => Promise<void>;
  onUploadLogo: (blob: Blob) => Promise<void>;
  publicSlug: string;
  publicSlugCanChange: boolean;
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
    </section>
  );
}
