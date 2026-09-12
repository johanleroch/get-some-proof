"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ErrorToast, SuccessToast } from "@/components/ui/error-toast";

export function AccountTestimonialLinks() {
  const account = useQuery(api.accounts.getMine, {});
  const update = useMutation(api.accounts.setTestimonialLinksEnabled);
  if (account === null) return null;
  return (
    <AccountTestimonialLinksView
      loading={account === undefined}
      enabled={account?.testimonialLinksEnabled ?? false}
      onChange={(enabled) => update({ enabled })}
    />
  );
}

export function AccountTestimonialLinksView({
  enabled,
  onChange,
  loading = false,
}: {
  enabled: boolean;
  loading?: boolean;
  onChange: (enabled: boolean) => Promise<unknown>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  async function change(value: boolean) {
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      await onChange(value);
      setSuccess(
        value
          ? "Testimonial links enabled across your Projects."
          : "Testimonial links disabled. The words stay visible.",
      );
    } catch {
      setError("Could not update testimonial links. Try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="mt-8 border-t pt-6" aria-label="Testimonial links">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <Label htmlFor="testimonial-links">Allow links in testimonials</Label>
          <p
            id="testimonial-links-description"
            className="text-muted-foreground max-w-prose text-sm"
          >
            Make imported mentions and links clickable on every Project’s public
            pages and embedded Walls. Turn this off to keep the words without
            links.
          </p>
        </div>
        <Switch
          id="testimonial-links"
          aria-describedby="testimonial-links-description"
          checked={enabled}
          disabled={pending || loading}
          className={loading ? "invisible" : undefined}
          onCheckedChange={change}
        />
      </div>
      {error ? <ErrorToast message={error} /> : null}
      {success ? <SuccessToast message={success} /> : null}
    </section>
  );
}
