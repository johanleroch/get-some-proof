"use client";

import { type FormEvent, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";

import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OrganizationOnboardingForm() {
  const router = useRouter();
  const createOrganization = useMutation(api.organizations.create);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const organization = await createOrganization({
        name: String(form.get("name")),
      });
      router.push(`/org/${organization.slug}/dashboard` as Route);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to create the Organization.",
      );
      setPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="space-y-2">
        <Label htmlFor="organization-name">Organization name</Label>
        <Input
          autoComplete="organization"
          id="organization-name"
          maxLength={80}
          minLength={2}
          name="name"
          placeholder="Acme Holdings"
          required
        />
        <p className="text-muted-foreground text-xs leading-5">
          The URL is created once from this name and remains stable after a
          rename.
        </p>
      </div>
      {error ? (
        <p
          aria-live="polite"
          className="text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
      <Button className="w-full" disabled={pending} type="submit">
        {pending ? "Creating Organization…" : "Create Organization"}
      </Button>
    </form>
  );
}
