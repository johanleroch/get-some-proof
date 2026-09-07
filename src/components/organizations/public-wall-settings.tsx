"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorToast, SuccessToast } from "@/components/ui/error-toast";
import { Field, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

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

const visibilityFields = [
  ["avatar", "Avatar"],
  ["role", "Role"],
  ["company", "Company"],
  ["rating", "Stars"],
] as const;

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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [theme, setTheme] = useState<PublicWallSettingsValue["theme"]>(
    settings.theme,
  );
  const [visibility, setVisibility] = useState(settings.visibility);
  const [transparentEmbed, setTransparentEmbed] = useState(
    settings.transparentEmbed,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const form = new FormData(event.currentTarget);
      await onSave({
        accentColor: String(form.get("accentColor")),
        hideAttribution: settings.canHideAttribution,
        theme,
        transparentEmbed,
        visibility,
      });
      setSuccess("Public Wall settings saved.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="bg-card scroll-mt-24 space-y-6 rounded-lg border p-5"
      id="wall"
      onSubmit={submit}
    >
      <div>
        <h2 className="type-subheading">Public Wall appearance</h2>
        <p className="text-ink-2 mt-1 text-sm">
          The hosted and Embedded Walls use these same choices.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label htmlFor="wall-theme">Theme</Label>
          <Select
            onValueChange={(value) =>
              setTheme(value as PublicWallSettingsValue["theme"])
            }
            value={theme}
          >
            <SelectTrigger className="w-full" id="wall-theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">Match the visitor</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <Label htmlFor="wall-accent">Accent color</Label>
          <Input
            className="h-10 cursor-pointer p-1"
            defaultValue={settings.accentColor}
            id="wall-accent"
            name="accentColor"
            type="color"
          />
        </Field>
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium tracking-[-0.008em]">
          Show by default
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {visibilityFields.map(([field, label]) => (
            <label
              className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"
              key={field}
            >
              <Checkbox
                checked={visibility[field]}
                onCheckedChange={(checked) =>
                  setVisibility((current) => ({
                    ...current,
                    [field]: checked === true,
                  }))
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <FieldDescription>
          Submitter name is always shown. Individual Published Testimonials can
          override these optional fields.
        </FieldDescription>
      </fieldset>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <Switch
          checked={transparentEmbed}
          onCheckedChange={setTransparentEmbed}
        />
        <span>Use a transparent Embedded Wall background</span>
      </label>
      <div className="bg-surface-2 rounded-md border p-4 text-sm">
        <p className="font-medium">
          {settings.canHideAttribution
            ? "The Get Some Proof promo card is hidden on Pro."
            : "Free walls include one Get Some Proof promo card."}
        </p>
        <p className="text-ink-2 mt-1 text-xs leading-5">
          It appears once among your Testimonials on Free and is removed
          automatically while Pro is active.
        </p>
      </div>
      {error ? <ErrorToast message={error} /> : null}
      {success ? <SuccessToast message={success} /> : null}
      <Button loading={pending} type="submit">
        Save Public Wall
      </Button>
    </form>
  );
}
