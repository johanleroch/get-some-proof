"use client";

import { type FormEvent, useState } from "react";
import { IconPhoto, IconUser } from "@tabler/icons-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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

type ProfileUser = {
  email: string;
  image?: string | null;
  name: string;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function ProfileEditor({
  refetch,
  user,
}: {
  refetch: () => Promise<unknown>;
  user: ProfileUser;
}) {
  const [name, setName] = useState(user.name);
  const [image, setImage] = useState(user.image ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const result = await authClient.updateUser({
      image: image.trim() || null,
      name: name.trim(),
    });

    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Unable to update your profile.");
      return;
    }

    await refetch();
    setSuccess("Profile updated.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="dashboard-page-title">Profile</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Update the information shown across your Organizations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>
            Your name and avatar are shared with the teams you join.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={updateProfile}>
            <div className="flex items-center gap-4">
              <Avatar className="size-16 rounded-xl">
                {image ? <AvatarImage alt={name} src={image} /> : null}
                <AvatarFallback className="rounded-xl text-base font-semibold">
                  {initials(name) || <IconUser className="size-5" />}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">Profile picture</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Paste a public image URL below. Upload storage can be wired to
                  this field later.
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full name</Label>
                <Input
                  autoComplete="name"
                  id="profile-name"
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email address</Label>
                <Input
                  disabled
                  id="profile-email"
                  type="email"
                  value={user.email}
                />
                <p className="text-muted-foreground text-xs">
                  Email changes require a verified email workflow.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-image">Avatar URL</Label>
              <div className="relative">
                <IconPhoto className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  className="pl-9"
                  id="profile-image"
                  inputMode="url"
                  onChange={(event) => setImage(event.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  type="url"
                  value={image}
                />
              </div>
            </div>

            {error ? (
              <p
                aria-live="assertive"
                className="text-destructive text-sm"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            {success ? (
              <p aria-live="polite" className="text-sm">
                {success}
              </p>
            ) : null}

            <Button disabled={pending || !name.trim()} type="submit">
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function AccountProfile() {
  const session = authClient.useSession();
  const user = session.data?.user;

  return user ? (
    <ProfileEditor key={user.id} refetch={session.refetch} user={user} />
  ) : (
    <p className="text-muted-foreground text-sm" role="status">
      Loading profile…
    </p>
  );
}
