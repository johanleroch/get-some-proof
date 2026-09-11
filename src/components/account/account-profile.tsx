"use client";

import Link from "next/link";
import { AccountTestimonialLinks } from "./account-testimonial-links";
import { BlobLoader } from "@/components/brand/blob-loader";

import { type FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { ProfileImageControl } from "@/components/profile-image/profile-image-control";
import { Button } from "@/components/ui/button";
import { ErrorToast, SuccessToast } from "@/components/ui/error-toast";
import { Field, FieldDescription } from "@/components/ui/field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { uploadProfileImage } from "@/lib/upload-profile-image";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AccountProfile() {
  const session = authClient.useSession();
  const currentUser = useQuery(api.auth.getCurrentUser, {});
  const user = session.data?.user;

  if (!user || currentUser === undefined) {
    return <BlobLoader label="Loading profile…" showLabel />;
  }

  return (
    <AccountProfileContent
      currentImage={currentUser?.image ?? null}
      email={user.email}
      initialName={user.name}
      key={user.id ?? user.email}
      refetchSession={session.refetch}
    />
  );
}

function AccountProfileContent({
  currentImage,
  email,
  initialName,
  refetchSession,
}: {
  currentImage: string | null;
  email: string;
  initialName: string;
  refetchSession: () => Promise<unknown>;
}) {
  const generateUploadUrl = useMutation(
    api.profileImages.generateAvatarUploadUrl,
  );
  const setAvatar = useMutation(api.profileImages.setMyAvatar);
  const removeAvatar = useMutation(api.profileImages.removeMyAvatar);

  async function uploadAvatar(blob: Blob) {
    const image = await uploadProfileImage(
      blob,
      await generateUploadUrl(),
      "ownerPhoto",
    );
    await setAvatar(image);
  }

  async function removeProfileImage() {
    const result = await authClient.updateUser({ image: null });
    if (result.error) {
      throw new Error(result.error.message ?? "Unable to remove your picture.");
    }
    await removeAvatar({});
    await refetchSession();
  }

  async function saveName(name: string) {
    const result = await authClient.updateUser({ name });
    if (result.error) {
      throw new Error(result.error.message ?? "Unable to update your profile.");
    }
    await refetchSession();
  }

  return (
    <>
      <AccountProfileView
        currentImage={currentImage}
        email={email}
        initialName={initialName}
        onRemoveImage={removeProfileImage}
        onSaveName={saveName}
        onUploadImage={uploadAvatar}
      />
      <AccountTestimonialLinks />
    </>
  );
}

export function AccountProfileView({
  currentImage,
  email,
  initialName,
  onRemoveImage,
  onSaveName,
  onUploadImage,
}: {
  currentImage: string | null;
  email: string;
  initialName: string;
  onRemoveImage: () => Promise<void>;
  onSaveName: (name: string) => Promise<void>;
  onUploadImage: (blob: Blob) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      await onSaveName(name.trim());
      setSuccess("Profile updated.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update your profile.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Update the identity used for your Owner account."
        eyebrow="Account"
        title="Profile"
      />
      <Link className="text-sm underline" href="/account/billing">
        Account billing and deletion
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Profile picture</CardTitle>
          <CardDescription>
            This picture identifies you inside your private Workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileImageControl
            alt={initialName}
            cropShape="round"
            fallback={initials(initialName) || "U"}
            imageUrl={currentImage}
            label="Profile picture"
            onRemove={onRemoveImage}
            onUpload={onUploadImage}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>
            Your name and verified email stay private to your Owner account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={updateProfile}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <Label htmlFor="profile-name">Full name</Label>
                <Input
                  autoComplete="name"
                  id="profile-name"
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </Field>
              <Field>
                <Label htmlFor="profile-email">Email address</Label>
                <Input disabled id="profile-email" type="email" value={email} />
                <FieldDescription>
                  Email changes require a verified email workflow.
                </FieldDescription>
              </Field>
            </div>
            {error ? <ErrorToast message={error} /> : null}
            {success ? <SuccessToast message={success} /> : null}
            <Button disabled={!name.trim()} loading={pending} type="submit">
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
