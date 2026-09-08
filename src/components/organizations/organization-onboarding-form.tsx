"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { IconChevronRight } from "@tabler/icons-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  defaultCollectionFormTitle,
  defaultPrimaryColor,
  publicSlugFromBrandName,
} from "@convex/domain/brand";
import { ArrowNote } from "@/components/doodles";
import { CollectionFormPreview } from "@/components/organizations/collection-form-preview";
import { ProfileImageControl } from "@/components/profile-image/profile-image-control";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { ErrorToast } from "@/components/ui/error-toast";
import { Field, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { accentPresets } from "@/lib/templates-catalog";
import { uploadProfileImage } from "@/lib/upload-profile-image";
import { cn } from "@/lib/utils";

type CreateBrandArgs = {
  collectionFormDescription?: string;
  collectionFormTitle?: string;
  name: string;
  primaryColor?: string;
  privacyContact?: string;
  publicSlug?: string;
};

/** Sends only what was filled in, so the Brand keeps the domain defaults. */
function chosen(value: string) {
  return value.trim() || undefined;
}

export function OrganizationOnboardingForm() {
  const router = useRouter();
  const createOrganization = useMutation(api.organizations.create);
  const generateUploadUrl = useMutation(
    api.organizations.generateLogoUploadUrl,
  );
  const setLogo = useMutation(api.organizations.setLogo);
  return (
    <OrganizationOnboardingFormView
      createOrganization={createOrganization}
      generateUploadUrl={generateUploadUrl}
      navigate={(path) => router.push(path as Route)}
      setLogo={setLogo}
      uploadImage={uploadProfileImage}
    />
  );
}

/**
 * The first screen after verification. Only the Brand name is asked for:
 * the mutation already derives the public address, seeds Proof Amber and
 * writes the Collection Form copy, so everything else is an invitation, not
 * a question. The address sits under the name as a consequence you can open
 * and edit, and the Collection Form wording waits behind one disclosure.
 * The preview on the right is the explanation, which is why it shows the
 * real defaults rather than empty fields.
 */
export function OrganizationOnboardingFormView({
  createOrganization,
  generateUploadUrl,
  navigate,
  setLogo,
  uploadImage,
}: {
  createOrganization: (args: CreateBrandArgs) => Promise<{
    id: Id<"organizations">;
    publicSlug: string;
    slug: string;
  }>;
  generateUploadUrl: (args: {
    organizationId: Id<"organizations">;
  }) => Promise<string>;
  navigate: (path: string) => void;
  setLogo: (args: {
    organizationId: Id<"organizations">;
    storageId: Id<"_storage">;
  }) => Promise<unknown>;
  uploadImage: (blob: Blob, uploadUrl: string) => Promise<Id<"_storage">>;
}) {
  const [name, setName] = useState("");
  const [publicSlug, setPublicSlug] = useState("");
  const [slugWasEdited, setSlugWasEdited] = useState(false);
  const [slugIsOpen, setSlugIsOpen] = useState(false);
  const [collectionFormTitle, setCollectionFormTitle] = useState("");
  const [collectionFormDescription, setCollectionFormDescription] =
    useState("");
  const [privacyContact, setPrivacyContact] = useState("");
  const [primaryColor, setPrimaryColor] = useState(defaultPrimaryColor);
  const [wordingIsOpen, setWordingIsOpen] = useState(false);
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [createdOrganization, setCreatedOrganization] = useState<{
    id: Id<"organizations">;
    publicSlug: string;
    slug: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const slugInput = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    },
    [logoPreview],
  );

  const trimmedName = name.trim();
  // What the Brand will actually be called if nothing else is touched, so the
  // preview and the placeholders promise exactly what the mutation writes.
  const titleDefault = trimmedName
    ? defaultCollectionFormTitle(trimmedName)
    : "";

  function updateName(nextName: string) {
    setName(nextName);
    if (!slugWasEdited) setPublicSlug(publicSlugFromBrandName(nextName));
  }

  function openSlug() {
    setSlugIsOpen(true);
    window.requestAnimationFrame(() => slugInput.current?.focus());
  }

  async function stageLogo(blob: Blob) {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoBlob(blob);
    setLogoPreview(URL.createObjectURL(blob));
  }

  async function removeStagedLogo() {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoBlob(null);
    setLogoPreview(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    let organizationCreated = Boolean(createdOrganization);

    try {
      const organization =
        createdOrganization ??
        (await createOrganization({
          collectionFormDescription: chosen(collectionFormDescription),
          collectionFormTitle: chosen(collectionFormTitle),
          name,
          primaryColor,
          privacyContact: chosen(privacyContact),
          publicSlug: chosen(publicSlug),
        }));
      if (!createdOrganization) {
        setCreatedOrganization({
          id: organization.id,
          publicSlug: organization.publicSlug,
          slug: organization.slug,
        });
        organizationCreated = true;
      }
      if (logoBlob) {
        const uploadUrl = await generateUploadUrl({
          organizationId: organization.id,
        });
        const storageId = await uploadImage(logoBlob, uploadUrl);
        await setLogo({ organizationId: organization.id, storageId });
      }
      navigate(`/org/${organization.slug}/dashboard`);
    } catch (caught) {
      setError(
        organizationCreated
          ? "Your Brand was created, but the logo upload failed. Retry or continue without it."
          : caught instanceof Error
            ? caught.message
            : "Unable to create the Brand.",
      );
      setPending(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
      <form className="max-w-xl space-y-8" onSubmit={submit}>
        <div className="space-y-4">
          <Field>
            <Label htmlFor="brand-name">Brand name</Label>
            <Input
              autoComplete="organization"
              id="brand-name"
              maxLength={80}
              minLength={2}
              name="name"
              onChange={(event) => updateName(event.target.value)}
              placeholder="Northwind Bakery"
              required
              value={name}
            />
            {slugIsOpen ? null : (
              <FieldDescription>
                Your public address will be /c/{publicSlug || "your-brand"}.{" "}
                <button
                  className="text-ink type-small cursor-pointer font-semibold underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                  onClick={openSlug}
                  type="button"
                >
                  Change
                </button>
              </FieldDescription>
            )}
          </Field>

          {slugIsOpen ? (
            <Field>
              <Label htmlFor="public-slug">Public address</Label>
              <div className="flex items-center gap-2">
                <span className="text-ink-2 type-ui shrink-0">/c/</span>
                <Input
                  aria-describedby="public-slug-help"
                  id="public-slug"
                  maxLength={48}
                  minLength={2}
                  name="publicSlug"
                  onChange={(event) => {
                    setSlugWasEdited(true);
                    setPublicSlug(publicSlugFromBrandName(event.target.value));
                  }}
                  placeholder="northwind-bakery"
                  ref={slugInput}
                  required
                  value={publicSlug}
                />
              </div>
              <FieldDescription id="public-slug-help">
                Letters, numbers and dashes. Your Collection Form and your Wall
                both live here.
              </FieldDescription>
            </Field>
          ) : null}
        </div>

        <Field>
          <Label id="brand-color-label">Brand color</Label>
          <ColorPicker
            className="-ml-3"
            labelledBy="brand-color-label"
            legend="Brand color"
            onChange={setPrimaryColor}
            presets={accentPresets}
            value={primaryColor}
          />
          <FieldDescription>
            It colors your Collection Form, your Wall and every embed.
          </FieldDescription>
        </Field>

        <ProfileImageControl
          alt={`${trimmedName || "New Brand"} logo`}
          cropShape="rect"
          fallback={(trimmedName.slice(0, 2) || "GP").toUpperCase()}
          imageUrl={logoPreview}
          label="Brand logo (optional)"
          onRemove={removeStagedLogo}
          onUpload={stageLogo}
          size="sm"
        />

        <div className="border-t pt-5">
          <button
            aria-controls="collection-form-wording"
            aria-expanded={wordingIsOpen}
            className="text-ink type-ui hover:text-ink-2 focus-visible:ring-ring -m-1 flex cursor-pointer items-center gap-1.5 rounded-md p-1 font-semibold transition-colors duration-150 outline-none focus-visible:ring-[3px]"
            onClick={() => setWordingIsOpen((open) => !open)}
            type="button"
          >
            <IconChevronRight
              aria-hidden="true"
              className={cn(
                "size-4 transition-transform duration-150",
                wordingIsOpen && "rotate-90",
              )}
            />
            Write your own wording
          </button>
          <div className="space-y-5 pt-5" hidden={!wordingIsOpen}>
            <Field>
              <Label htmlFor="collection-form-title">
                Collection Form title
              </Label>
              <Input
                id="collection-form-title"
                maxLength={100}
                name="collectionFormTitle"
                onChange={(event) => setCollectionFormTitle(event.target.value)}
                placeholder={
                  titleDefault || "Share your experience with your Brand"
                }
                value={collectionFormTitle}
              />
            </Field>

            <Field>
              <Label htmlFor="collection-form-description">
                Collection Form description
              </Label>
              <Textarea
                id="collection-form-description"
                maxLength={500}
                name="collectionFormDescription"
                onChange={(event) =>
                  setCollectionFormDescription(event.target.value)
                }
                placeholder="Tell us what changed for you."
                value={collectionFormDescription}
              />
            </Field>

            <Field>
              <Label htmlFor="privacy-contact">Privacy contact</Label>
              <Input
                aria-describedby="privacy-contact-help"
                autoComplete="email"
                id="privacy-contact"
                name="privacyContact"
                onChange={(event) => setPrivacyContact(event.target.value)}
                placeholder="privacy@yourbrand.com"
                type="email"
                value={privacyContact}
              />
              <FieldDescription id="privacy-contact-help">
                Where Submitters write to have their Testimonial removed. Left
                empty, we use your account email.
              </FieldDescription>
            </Field>
          </div>
        </div>

        {error ? <ErrorToast message={error} /> : null}
        <div className="space-y-2">
          <Button className="w-full" loading={pending} type="submit">
            {createdOrganization ? "Retry logo and continue" : "Create Brand"}
          </Button>
          {createdOrganization ? (
            <Button
              className="w-full"
              disabled={pending}
              onClick={() =>
                navigate(`/org/${createdOrganization.slug}/dashboard`)
              }
              type="button"
              variant="ghost"
            >
              Continue without logo
            </Button>
          ) : null}
        </div>
      </form>
      {/* Pulled up so the card's top edge meets the first field rather than
          its baseline: the note above it is an annotation, and annotations
          overhang. */}
      <aside className="space-y-3 lg:sticky lg:top-8 lg:-mt-10">
        {/* The arrow leads on the left so it lands on the Brand lockup, the
            first thing a customer reads, instead of the empty corner the
            right-hand version pointed at. The inset walks the tip across the
            card's padding and onto the logo, and holds at every width because
            that padding does not change. */}
        <ArrowNote className="ms-11" direction="left">
          this is what your customers see
        </ArrowNote>
        <CollectionFormPreview
          accentColor={primaryColor}
          description={collectionFormDescription}
          logoUrl={logoPreview}
          name={name}
          title={collectionFormTitle.trim() || titleDefault}
        />
      </aside>
    </div>
  );
}
