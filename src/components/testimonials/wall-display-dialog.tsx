"use client";

import { useState } from "react";
import { ConvexError } from "convex/values";

import { defaultPrimaryColor } from "@convex/domain/brand";
import type { TestimonialCardValue } from "@convex/testimonialCardValue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/segmented";
import { TestimonialCard } from "@/components/testimonials/testimonial-card";
import { WallCardMiniature } from "@/components/testimonials/wall-card-miniature";

/** The optional identity details a Public Wall card can show or hide. */
export type WallDetail = "avatar" | "role" | "company" | "rating";
export type WallVisibility = Record<WallDetail, boolean>;
/** A Visibility Override per detail; an absent key follows the Wall. */
export type WallVisibilityOverrides = Partial<Record<WallDetail, boolean>>;

export const defaultWallVisibility: WallVisibility = {
  avatar: true,
  company: true,
  rating: true,
  role: true,
};

type Choice = "inherit" | "show" | "hide";

const details: ReadonlyArray<{
  key: WallDetail;
  label: string;
  /** Whether this card has the detail at all; a choice about nothing is noise. */
  present: (testimonial: TestimonialCardValue) => boolean;
}> = [
  { key: "avatar", label: "Photo", present: (t) => Boolean(t.avatarUrl) },
  { key: "role", label: "Role", present: (t) => Boolean(t.role) },
  { key: "company", label: "Company", present: (t) => Boolean(t.company) },
  { key: "rating", label: "Stars", present: (t) => Boolean(t.rating) },
];

function choiceOf(override: boolean | undefined): Choice {
  return override === undefined ? "inherit" : override ? "show" : "hide";
}

/** The card exactly as the Public Projection draws it under these choices. */
export function withWallVisibility(
  testimonial: TestimonialCardValue,
  visibility: WallVisibility,
): TestimonialCardValue {
  return {
    ...testimonial,
    avatarVisible: visibility.avatar,
    company: visibility.company ? testimonial.company : undefined,
    rating: visibility.rating ? testimonial.rating : undefined,
    role: visibility.role ? testimonial.role : undefined,
  };
}

export function resolveWallVisibility(
  defaults: WallVisibility,
  overrides: WallVisibilityOverrides | undefined,
): WallVisibility {
  return {
    avatar: overrides?.avatar ?? defaults.avatar,
    company: overrides?.company ?? defaults.company,
    rating: overrides?.rating ?? defaults.rating,
    role: overrides?.role ?? defaults.role,
  };
}

function saveError(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === "string") {
    return error.data;
  }
  if (
    error instanceof ConvexError &&
    typeof (error.data as { message?: unknown })?.message === "string"
  ) {
    return (error.data as { message: string }).message;
  }
  return error instanceof Error
    ? error.message
    : "Could not save what the card shows.";
}

/**
 * Which details one Published card shows on the Public Wall. The Wall
 * settings decide for every card; this dialog holds the exceptions for one
 * Testimonial (a Visibility Override per detail), and the preview underneath
 * is the real card in the Brand's colour, so the Owner judges what ships.
 */
export function WallDisplayDialog({
  accentColor = defaultPrimaryColor,
  onClose,
  onSave,
  overrides,
  submitterName,
  testimonial,
  wallVisibility = defaultWallVisibility,
}: {
  accentColor?: string;
  onClose: () => void;
  onSave: (overrides: WallVisibilityOverrides) => Promise<unknown>;
  overrides?: WallVisibilityOverrides;
  submitterName: string;
  testimonial: TestimonialCardValue;
  /** What the Wall shows by default, from the Brand's Wall settings. */
  wallVisibility?: WallVisibility;
}) {
  const [choices, setChoices] = useState<Record<WallDetail, Choice>>({
    avatar: choiceOf(overrides?.avatar),
    company: choiceOf(overrides?.company),
    rating: choiceOf(overrides?.rating),
    role: choiceOf(overrides?.role),
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = details.filter((detail) => detail.present(testimonial));
  const nextOverrides: WallVisibilityOverrides = Object.fromEntries(
    rows
      .filter((detail) => choices[detail.key] !== "inherit")
      .map((detail) => [detail.key, choices[detail.key] === "show"]),
  );
  const preview = withWallVisibility(
    testimonial,
    resolveWallVisibility(wallVisibility, nextOverrides),
  );

  async function save() {
    setPending(true);
    setError(null);
    try {
      await onSave(nextOverrides);
      onClose();
    } catch (cause) {
      setError(saveError(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Details on {submitterName}&rsquo;s card</DialogTitle>
          <DialogDescription>
            Your Wall settings decide for every card. Choose here for this one
            only.
          </DialogDescription>
        </DialogHeader>

        {rows.length ? (
          <div className="space-y-3">
            {rows.map((detail) => (
              <div
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
                key={detail.key}
              >
                <span
                  className="type-ui text-ink"
                  id={`wall-detail-${detail.key}`}
                >
                  {detail.label}
                  <span className="type-small text-ink-2 ml-2 font-normal">
                    {wallVisibility[detail.key]
                      ? "shown by default"
                      : "hidden by default"}
                  </span>
                </span>
                <Segmented<Choice>
                  label={detail.label}
                  onChange={(value) =>
                    setChoices((current) => ({
                      ...current,
                      [detail.key]: value,
                    }))
                  }
                  options={[
                    { key: "inherit", label: "Wall default" },
                    { key: "show", label: "Show" },
                    { key: "hide", label: "Hide" },
                  ]}
                  value={choices[detail.key]}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="type-body text-ink-2">
            This card shows the name only: {submitterName} sent no photo, role,
            company or stars.
          </p>
        )}

        <div className="space-y-2">
          <p className="type-micro text-ink-2 uppercase">On your Public Wall</p>
          <div className="mx-auto w-full max-w-[340px] [&_[data-gsp-card]]:mb-0">
            {preview.type === "video" ? (
              <div className="mx-auto w-fit">
                <WallCardMiniature
                  accentColor={accentColor}
                  testimonial={preview}
                  width={220}
                />
              </div>
            ) : (
              <TestimonialCard
                accentColor={accentColor}
                testimonial={preview}
              />
            )}
          </div>
        </div>

        {error ? (
          <p className="type-small text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            disabled={pending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button loading={pending} onClick={() => void save()} type="button">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
