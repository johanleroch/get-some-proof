import type {
  TestimonialCardTextValue,
  TestimonialCardValue,
  TestimonialCardVideoValue,
} from "@convex/testimonialCardValue";
import {
  accentHighlight,
  accentInk,
  accentSoft,
} from "@convex/domain/color-contrast";
import { markerHighlightStyle } from "@/lib/marker-highlight";

export type {
  TestimonialCardTextValue,
  TestimonialCardValue,
  TestimonialCardVideoValue,
} from "@convex/testimonialCardValue";

/** @deprecated Prefer the surface-neutral TestimonialCardValue name. */
export type PublicTextTestimonial = TestimonialCardTextValue;
/** @deprecated Prefer the surface-neutral TestimonialCardValue name. */
export type PublicVideoTestimonial = TestimonialCardVideoValue;
/** @deprecated Prefer the surface-neutral TestimonialCardValue name. */
export type PublicTestimonial = TestimonialCardValue;

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "'": "&#39;",
        '"': "&quot;",
        "<": "&lt;",
        ">": "&gt;",
      })[character]!,
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function testimonialPoster(testimonial: TestimonialCardVideoValue) {
  return `https://image.mux.com/${encodeURIComponent(testimonial.playbackId)}/thumbnail.webp?width=960&time=${testimonial.posterTimeSeconds ?? 0.5}`;
}

export function testimonialAspectRatio(testimonial: TestimonialCardVideoValue) {
  return videoAspectRatioStyle(testimonial.aspectRatio);
}

export function videoAspectRatioStyle(aspectRatio?: string) {
  const match = /^(\d{1,5}):(\d{1,5})$/.exec(aspectRatio ?? "");
  if (!match || Number(match[1]) <= 0 || Number(match[2]) <= 0) {
    return "9 / 16";
  }
  return `${Number(match[1])} / ${Number(match[2])}`;
}

function avatarMarkup(testimonial: TestimonialCardValue) {
  if (testimonial.avatarVisible === false) return "";
  if (testimonial.avatarUrl) {
    return `<span class="avatar"><img alt="" class="size-8 rounded-full object-cover" height="32" loading="lazy" src="${escapeHtml(testimonial.avatarUrl)}" width="32"></span>`;
  }
  return `<span aria-hidden="true" class="avatar bg-muted grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold">${escapeHtml(initials(testimonial.name))}</span>`;
}

function starIconsMarkup(rating: number, sizeClass = "size-3.5") {
  return Array.from({ length: 5 }, (_, index) => {
    const filled = index < rating;
    return `<svg aria-hidden="true" class="star ${filled ? "fill-current" : "text-muted-foreground/25"} ${sizeClass}" data-filled="${filled}" fill="none" height="24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.12 2.12 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16z"></path></svg>`;
  }).join("");
}

function starsMarkup(rating?: number) {
  if (!rating) return "";
  return `<div aria-label="${rating} out of 5 stars" class="stars flex shrink-0 gap-1 text-(--wall-accent)" role="img">${starIconsMarkup(rating)}</div>`;
}

function videoLoaderMarkup() {
  return '<span aria-hidden="true" aria-label="Loading video" class="video-loader pointer-events-none absolute inset-0 z-[5] hidden place-items-center bg-black/35 text-white" data-gsp-video-loader="" role="status"><svg aria-hidden="true" class="size-10 animate-spin motion-reduce:animate-none" fill="none" viewBox="0 0 24 24"><circle class="opacity-30" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3"></circle><path class="opacity-90" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-linecap="round" stroke-width="3"></path></svg></span>';
}

/**
 * One markup for the Wall, the Inbox and the embed (DESIGN.md section 7): the
 * quote leads, then the signature row with a 32px avatar and the stars on the
 * right. A marked phrase is painted with the hand-drawn marker swash in the
 * Brand accent.
 */
export function testimonialCardHtml({
  accentColor,
  menuMount = false,
  testimonial,
}: {
  accentColor: string;
  menuMount?: boolean;
  testimonial: TestimonialCardValue;
}) {
  const identity = [testimonial.role, testimonial.company]
    .filter(Boolean)
    .join(" · ");
  const video =
    testimonial.type === "video"
      ? `<div class="video-shell relative w-full cursor-pointer overflow-hidden bg-black" data-video-aspect-ratio="${escapeHtml(testimonial.aspectRatio ?? "9:16")}" style="aspect-ratio:${testimonialAspectRatio(testimonial)}">${videoLoaderMarkup()}<img alt="Video from ${escapeHtml(testimonial.name)}" class="poster absolute inset-0 z-[1] h-full w-full object-cover transition-opacity duration-200" data-gsp-video-poster="" loading="lazy" src="${escapeHtml(testimonialPoster(testimonial))}"><span aria-hidden="true" class="video-shade pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/90 via-black/35 to-transparent transition-opacity duration-200 ease-out motion-reduce:transition-none"></span><span class="video-overlay pointer-events-none absolute inset-x-0 bottom-0 z-[3] flex items-end justify-between gap-4 p-5 text-white transition-opacity duration-200 ease-out motion-reduce:transition-none"><span class="min-w-0">${testimonial.rating ? `<span class="stars mb-2 flex gap-1 text-(--wall-accent)" aria-label="${testimonial.rating} out of 5 stars" role="img">${starIconsMarkup(testimonial.rating, "size-4")}</span>` : ""}<span class="video-name block truncate text-xl font-semibold tracking-tight">${escapeHtml(testimonial.name)}</span>${identity ? `<span class="video-meta mt-0.5 block truncate text-sm text-white/75">${escapeHtml(identity)}</span>` : ""}</span><button aria-label="Play ${escapeHtml(testimonial.name)}&#39;s testimonial" class="play group pointer-events-auto grid size-12 shrink-0 cursor-pointer place-items-center rounded-full bg-white/92 text-brand-ink shadow-float transition-transform hover:scale-105 focus-visible:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--wall-accent) disabled:cursor-wait" data-gsp-play="" data-pause-label="Pause ${escapeHtml(testimonial.name)}&#39;s testimonial" data-play-label="Play ${escapeHtml(testimonial.name)}&#39;s testimonial" type="button"><span class="play-icon contents"><svg aria-hidden="true" class="ml-0.5 size-5 fill-current" data-gsp-play-icon="" fill="none" height="24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"><path d="m6 3 14 9-14 9z"></path></svg><svg aria-hidden="true" class="hidden size-5 fill-current" data-gsp-pause-icon="" fill="none" height="24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"><path d="M8 5v14M16 5v14"></path></svg></span></button></span></div>`
      : "";
  const meta = identity
    ? `<p class="meta text-muted-foreground truncate text-[13px] leading-[1.125rem]">${escapeHtml(identity)}</p>`
    : "";
  const text =
    testimonial.type === "text"
      ? `<blockquote style="white-space:pre-wrap" class="quote text-[15px] leading-7 tracking-[-0.01em]">${testimonial.richText ? testimonial.richText.map((block) => block.children.map((leaf) => (leaf.highlight ? `<mark style="${markerHighlightStyle(accentHighlight(accentColor))}">${escapeHtml(leaf.text)}</mark>` : escapeHtml(leaf.text))).join("")).join("<br>") : escapeHtml(testimonial.text).replace(/\n/g, "<br>")}</blockquote>`
      : "";
  const attachments =
    testimonial.type === "text" && testimonial.images?.length
      ? `<div class="testimonial-images" style="margin-top:20px;display:grid;grid-template-columns:repeat(${Math.min(testimonial.images.length, 3)},minmax(0,1fr));gap:8px">${testimonial.images.map((image, index) => `<img alt="Image ${index + 1} from ${escapeHtml(testimonial.name)}" src="${escapeHtml(image.url)}" loading="lazy" style="width:100%;height:auto;max-height:320px;object-fit:contain;border-radius:8px">`).join("")}</div>`
      : "";
  const body =
    testimonial.type === "video"
      ? video
      : `<div class="content p-5${menuMount ? " pr-12" : ""}">${text}${attachments}<div class="identity mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">${avatarMarkup(testimonial)}<div class="person min-w-[7rem] flex-1"><p class="name truncate text-[13px] leading-[1.125rem] font-semibold">${escapeHtml(testimonial.name)}</p>${meta}</div>${starsMarkup(testimonial.rating)}</div></div>`;

  const menu = menuMount
    ? '<span class="absolute right-3 top-3 z-20" data-gsp-card-menu=""></span>'
    : "";

  return `<article class="card relative mb-5 break-inside-avoid overflow-hidden rounded-lg border bg-card text-card-foreground${testimonial.type === "video" ? " video-card" : ""}" data-gsp-card="" style="--wall-accent:${escapeHtml(accentColor)};--wall-accent-ink:${accentInk(accentColor)};--wall-accent-soft:${accentSoft(accentColor)}">${menu}${body}</article>`;
}
