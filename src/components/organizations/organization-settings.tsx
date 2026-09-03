"use client";

import { type FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
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
          <h1 className="text-2xl font-semibold">Organization unavailable</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            This Organization does not exist or your Membership is inactive.
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
      canUpdate={access?.can.updateOrganization ?? false}
      logoUrl={organization.logoUrl}
      name={organization.name}
      onRemoveLogo={async () => {
        await removeLogo({ organizationId });
      }}
      onRename={renameOrganization}
      onUploadLogo={uploadLogo}
      slug={organization.slug}
    />
  );
}

export function OrganizationSettingsView({
  canUpdate,
  logoUrl,
  name,
  onRemoveLogo,
  onRename,
  onUploadLogo,
  slug,
}: {
  canUpdate: boolean;
  logoUrl: string | null;
  name: string;
  onRemoveLogo: () => Promise<void>;
  onRename: (name: string) => Promise<void>;
  onUploadLogo: (blob: Blob) => Promise<void>;
  slug: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function updateName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setMessage(null);
    try {
      await onRename(String(new FormData(form).get("name")));
      setMessage("Organization name updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="settings-heading" className="space-y-6">
      <div>
        <h1 className="dashboard-page-title" id="settings-heading">
          Organization settings
        </h1>
        <p className="dashboard-page-description mt-1">
          Update the identity shared across your Organization.
        </p>
      </div>

      <div className="bg-card max-w-2xl rounded-xl border p-6 shadow-xs">
        <ProfileImageControl
          alt={`${name} logo`}
          cropShape="rect"
          fallback={initials(name) || "OR"}
          imageUrl={logoUrl}
          label="Organization logo"
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
            <Label htmlFor="organization-name">Organization name</Label>
            <Input
              defaultValue={name}
              id="organization-name"
              name="name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="organization-slug">Stable URL identifier</Label>
            <Input
              aria-describedby="organization-slug-help"
              disabled
              id="organization-slug"
              value={slug}
            />
            <p
              className="text-muted-foreground text-xs"
              id="organization-slug-help"
            >
              The slug stays unchanged when the Organization is renamed.
            </p>
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
            Only an Owner or Admin can update Organization settings.
          </p>
        </div>
      )}
    </section>
  );
}
