export type PublicTextTestimonial = {
  avatarUrl: string | null;
  avatarVisible?: boolean;
  company?: string;
  id: string;
  name: string;
  publishedAt: number;
  rating?: number;
  role?: string;
  text: string;
  type: "text";
};

export type PublicVideoTestimonial = Omit<
  PublicTextTestimonial,
  "text" | "type"
> & {
  aspectRatio?: string;
  captionsAvailable: boolean;
  playbackId: string;
  posterTimeSeconds?: number;
  type: "video";
};

export type PublicTestimonial = PublicTextTestimonial | PublicVideoTestimonial;

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

export function testimonialPoster(testimonial: PublicVideoTestimonial) {
  return `https://image.mux.com/${encodeURIComponent(testimonial.playbackId)}/thumbnail.webp?width=960&time=${testimonial.posterTimeSeconds ?? 0.5}`;
}

export function testimonialAspectRatio(testimonial: PublicVideoTestimonial) {
  const match = /^(\d{1,5}):(\d{1,5})$/.exec(testimonial.aspectRatio ?? "");
  if (!match || Number(match[1]) <= 0 || Number(match[2]) <= 0) {
    return "9 / 16";
  }
  return `${Number(match[1])} / ${Number(match[2])}`;
}

function avatarMarkup(testimonial: PublicTestimonial) {
  if (testimonial.avatarVisible === false) return "";
  if (testimonial.avatarUrl) {
    return `<span class="avatar"><img alt="" class="size-11 rounded-full object-cover" height="44" loading="lazy" src="${escapeHtml(testimonial.avatarUrl)}" width="44"></span>`;
  }
  return `<span aria-hidden="true" class="avatar bg-muted grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold">${escapeHtml(initials(testimonial.name))}</span>`;
}

function starIconsMarkup(rating: number) {
  return Array.from({ length: 5 }, (_, index) => {
    const filled = index < rating;
    return `<svg aria-hidden="true" class="star ${filled ? "fill-current" : "text-muted-foreground/35"} size-4" data-filled="${filled}" fill="none" height="24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.12 2.12 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16z"></path></svg>`;
  }).join("");
}

function starsMarkup(rating?: number) {
  if (!rating) return "";
  return `<div aria-label="${rating} out of 5 stars" class="stars flex gap-1 text-(--wall-accent)" role="img">${starIconsMarkup(rating)}</div>`;
}

export function testimonialCardHtml({
  accentColor,
  attributionHref,
  attributionRequired,
  testimonial,
}: {
  accentColor: string;
  attributionHref: string;
  attributionRequired: boolean;
  testimonial: PublicTestimonial;
}) {
  const identity = [testimonial.role, testimonial.company]
    .filter(Boolean)
    .join(" · ");
  const attribution = attributionRequired
    ? `<a class="attribution text-muted-foreground hover:text-foreground inline-flex text-xs underline underline-offset-4" href="${escapeHtml(attributionHref)}" rel="sponsored nofollow">Powered by Get Some Proof</a>`
    : "";
  const video =
    testimonial.type === "video"
      ? `<div class="video-shell relative w-full overflow-hidden bg-black" data-video-aspect-ratio="${escapeHtml(testimonial.aspectRatio ?? "9:16")}" style="aspect-ratio:${testimonialAspectRatio(testimonial)}"><button aria-label="Play ${escapeHtml(testimonial.name)}&#39;s testimonial" class="play group absolute inset-0 z-10 cursor-pointer text-left transition-opacity duration-200 data-[playing=true]:pointer-events-none data-[playing=true]:opacity-0" data-gsp-play="" type="button"><img alt="Video from ${escapeHtml(testimonial.name)}" class="poster absolute inset-0 h-full w-full object-cover" loading="lazy" src="${escapeHtml(testimonialPoster(testimonial))}"><span aria-hidden="true" class="video-shade absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent"></span><span class="video-overlay absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white"><span class="min-w-0">${testimonial.rating ? `<span class="stars mb-2 flex gap-1 text-(--wall-accent)" aria-label="${testimonial.rating} out of 5 stars" role="img">${starIconsMarkup(testimonial.rating)}</span>` : ""}<span class="video-name block truncate text-xl font-semibold tracking-tight">${escapeHtml(testimonial.name)}</span>${identity ? `<span class="video-meta mt-0.5 block truncate text-sm text-white/75">${escapeHtml(identity)}</span>` : ""}</span><span class="play-icon grid size-11 shrink-0 place-items-center rounded-full bg-white/92 text-black shadow-lg transition-transform group-hover:scale-105 group-focus-visible:scale-105"><svg aria-hidden="true" class="ml-0.5 size-5 fill-current" fill="none" height="24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="24"><path d="m6 3 14 9-14 9z"></path></svg></span></span></button></div>`
      : "";
  const meta = identity
    ? `<p class="meta text-muted-foreground truncate text-sm">${escapeHtml(identity)}</p>`
    : "";
  const text =
    testimonial.type === "text"
      ? `<blockquote class="text-[15px] leading-7 font-medium tracking-[-0.01em]">${escapeHtml(testimonial.text)}</blockquote>`
      : "";
  const body =
    testimonial.type === "video"
      ? `${video}${attribution ? `<div class="video-attribution px-5 py-3">${attribution}</div>` : ""}`
      : `<div class="content space-y-5 p-5 sm:p-6"><div class="identity flex items-center gap-3">${avatarMarkup(testimonial)}<div class="person min-w-0"><p class="name truncate font-semibold">${escapeHtml(testimonial.name)}</p>${meta}</div></div>${starsMarkup(testimonial.rating)}${text}${attribution}</div>`;

  return `<article class="card mb-5 break-inside-avoid overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs${testimonial.type === "video" ? " video-card" : ""}" data-gsp-card="" style="--wall-accent:${escapeHtml(accentColor)}">${body}</article>`;
}
