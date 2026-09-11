"use client";
import type { CSSProperties } from "react";
import { IconPlayerPlayFilled } from "@tabler/icons-react";
import type {
  TestimonialCardValue,
  TestimonialCardTextValue,
  TestimonialCardVideoValue,
} from "@convex/testimonialCardValue";
import { DesignQuote } from "./designs/design-parts";
import { videoAspect } from "./testimonial-card-markup";
import { Stars } from "@/components/templates/template-primitives";

function formatDuration(seconds: number) {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** A small still for the list: the Owner's own thumbnail, or a frame. */
function stillUrl(card: TestimonialCardVideoValue) {
  if (card.posterUrl) return card.posterUrl;
  return `https://image.mux.com/${encodeURIComponent(card.playbackId)}/thumbnail.webp?width=192&time=${card.posterTimeSeconds ?? 0.5}`;
}

function stillBox(aspectRatio?: string): CSSProperties {
  const [width, height] = videoAspect(aspectRatio);
  return {
    aspectRatio: `${width} / ${height}`,
    width: width < height ? 48 : 64,
  };
}

export function TestimonialListFace({
  testimonial,
  onPreview,
  name = testimonial.name,
  aspectRatio,
  durationSeconds,
  showAvatar = true,
}: {
  testimonial: TestimonialCardValue;
  onPreview: () => void;
  name?: string;
  aspectRatio?: string;
  durationSeconds?: number;
  showAvatar?: boolean;
}) {
  if (testimonial.type === "text") {
    if (!showAvatar) return null;
    return testimonial.avatarUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt=""
        className="size-12 shrink-0 rounded-full object-cover"
        height={48}
        loading="lazy"
        src={testimonial.avatarUrl}
        width={48}
      />
    ) : (
      <span
        aria-hidden="true"
        className="grid size-12 shrink-0 place-items-center"
      >
        <span className="font-display translate-y-[0.3em] text-[44px] leading-none font-bold text-(--wall-accent) select-none">
          &ldquo;
        </span>
      </span>
    );
  }
  if (testimonial.type === "video") {
    return (
      <button
        aria-label={`Preview ${name}'s video`}
        className="group/still bg-ink focus-visible:ring-ring relative block shrink-0 cursor-pointer overflow-hidden rounded-md outline-none focus-visible:ring-[3px]"
        onClick={(event) => {
          event.currentTarget.focus();
          onPreview();
        }}
        style={stillBox(aspectRatio ?? testimonial.aspectRatio)}
        type="button"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          className="size-full object-cover transition-transform duration-[var(--motion-base)] ease-[var(--ease-settle-soft)] group-hover/still:scale-105 motion-reduce:transition-none"
          loading="lazy"
          src={stillUrl(testimonial)}
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center bg-black/25 text-white"
        >
          <IconPlayerPlayFilled className="size-4" />
        </span>
        {durationSeconds ? (
          <span
            aria-hidden="true"
            className="absolute right-1 bottom-1 rounded-sm bg-black/70 px-1 font-mono text-xs leading-4 text-white tabular-nums"
          >
            {formatDuration(durationSeconds)}
          </span>
        ) : null}
      </button>
    );
  }
  return null;
}

export function TestimonialListIdentity({
  name,
  testimonial,
}: {
  name: string;
  testimonial: TestimonialCardValue | null;
}) {
  const identity = testimonial
    ? [testimonial.role, testimonial.company].filter(Boolean).join(" · ")
    : "";
  const rating = testimonial?.rating;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {/* The stars stay on the name's line; the role and company wrap. */}
      <span className="flex items-center gap-x-2">
        <span className="type-ui text-ink font-semibold">{name}</span>
        {rating ? (
          <Stars className="shrink-0" rating={rating} size={14} />
        ) : null}
      </span>
      {identity ? (
        <span className="type-small text-ink-2 min-w-0">{identity}</span>
      ) : null}
    </div>
  );
}

export function TestimonialListWords({
  accentColor,
  testimonial,
}: {
  accentColor: string;
  testimonial: TestimonialCardTextValue;
}) {
  return (
    <>
      <DesignQuote
        accentColor={accentColor}
        className="type-body text-ink mt-1 max-w-prose"
        testimonial={testimonial}
      />
      {testimonial.images?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {testimonial.images.map((image, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`Image ${index + 1} from ${testimonial.name}`}
              className="size-14 rounded-md object-cover"
              height={56}
              key={image.id}
              loading="lazy"
              src={image.url}
              width={56}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
