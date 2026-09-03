"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PublicWallSettingsValue = {
  accentColor: string;
  canHideAttribution: boolean;
  hideAttribution: boolean;
  theme: "light" | "dark" | "system";
  transparentEmbed: boolean;
  visibility: {
    avatar: boolean;
    company: boolean;
    rating: boolean;
    role: boolean;
  };
};

export function PublicWallSettings({
  onSave,
  settings,
}: {
  onSave: (
    settings: Omit<PublicWallSettingsValue, "canHideAttribution">,
  ) => Promise<void>;
  settings: PublicWallSettingsValue;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const form = new FormData(event.currentTarget);
      await onSave({
        accentColor: String(form.get("accentColor")),
        hideAttribution:
          settings.canHideAttribution && form.has("hideAttribution"),
        theme: String(form.get("theme")) as PublicWallSettingsValue["theme"],
        transparentEmbed: form.has("transparentEmbed"),
        visibility: {
          avatar: form.has("visibility.avatar"),
          company: form.has("visibility.company"),
          rating: form.has("visibility.rating"),
          role: form.has("visibility.role"),
        },
      });
      setMessage("Public Wall settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="bg-card max-w-2xl space-y-6 rounded-xl border p-6 shadow-xs"
      onSubmit={submit}
    >
      <div>
        <h2 className="font-semibold">Public Wall appearance</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          The hosted and Embedded Walls use these same choices.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="wall-theme">Theme</Label>
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs"
            defaultValue={settings.theme}
            id="wall-theme"
            name="theme"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="wall-accent">Accent color</Label>
          <Input
            defaultValue={settings.accentColor}
            id="wall-accent"
            name="accentColor"
            type="color"
          />
        </div>
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Show by default</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["avatar", "role", "company", "rating"] as const).map((field) => (
            <label className="flex items-center gap-2 text-sm" key={field}>
              <input
                defaultChecked={settings.visibility[field]}
                name={`visibility.${field}`}
                type="checkbox"
              />
              <span className="capitalize">
                {field === "rating" ? "Stars" : field}
              </span>
            </label>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          Submitter name is always shown. Individual Published Testimonials can
          override these optional fields.
        </p>
      </fieldset>
      <label className="flex items-start gap-2 text-sm">
        <input
          defaultChecked={settings.transparentEmbed}
          name="transparentEmbed"
          type="checkbox"
        />
        <span>Use a transparent Embedded Wall background</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          defaultChecked={settings.hideAttribution}
          disabled={!settings.canHideAttribution}
          name="hideAttribution"
          type="checkbox"
        />
        <span>
          Hide the Attribution Badge
          {!settings.canHideAttribution ? " (Pro)" : ""}
        </span>
      </label>
      {message ? (
        <p className="text-sm" role="status">
          {message}
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        {pending ? "Saving…" : "Save Public Wall"}
      </Button>
    </form>
  );
}
