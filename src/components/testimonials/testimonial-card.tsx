"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { Play, Star } from "lucide-react";
import MuxPlayer from "@mux/mux-player-react/lazy";
import Image from "next/image";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import videoPlayerPolicy from "../../../public/embed/video-player-policy.json";

export type PublicTextTestimonial = {
  avatarUrl: string | null;
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
  captionsAvailable: boolean;
  playbackId: string;
  posterTimeSeconds?: number;
  type: "video";
};

export type PublicTestimonial = PublicTextTestimonial | PublicVideoTestimonial;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function TestimonialCard({
  accentColor,
  attributionRequired,
  testimonial,
}: {
  accentColor: string;
  attributionRequired: boolean;
  testimonial: PublicTestimonial;
}) {
  const identity = [testimonial.role, testimonial.company]
    .filter(Boolean)
    .join(" · ");
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const playerRef = useRef<React.ElementRef<typeof MuxPlayer>>(null);
  useEffect(() => {
    if (playerLoaded) void playerRef.current?.play().catch(() => undefined);
  }, [playerLoaded]);
  const poster =
    testimonial.type === "video"
      ? `https://image.mux.com/${encodeURIComponent(testimonial.playbackId)}/thumbnail.png?width=720&height=1280&fit_mode=smartcrop&time=${testimonial.posterTimeSeconds ?? 0.5}`
      : undefined;

  return (
    <Card
      className="mb-4 break-inside-avoid overflow-hidden rounded-xl shadow-xs"
      style={{ "--wall-accent": accentColor } as CSSProperties}
    >
      {testimonial.type === "video" ? (
        <div className="relative aspect-[9/16] w-full overflow-hidden bg-black">
          {playerLoaded ? (
            <div
              className="h-full w-full"
              data-captions={
                testimonial.captionsAvailable ? "visible" : "unavailable"
              }
              data-autoplay={videoPlayerPolicy.autoplay}
              data-disable-cookies={videoPlayerPolicy.disableCookies}
              data-playback-id={testimonial.playbackId}
              data-preload="none"
              data-testid="mux-video-player"
            >
              <MuxPlayer
                accentColor={accentColor}
                autoPlay={videoPlayerPolicy.autoplay}
                className="block h-full w-full"
                defaultHiddenCaptions={
                  videoPlayerPolicy.hideCaptionsWhenUnavailable &&
                  !testimonial.captionsAvailable
                }
                disableCookies={videoPlayerPolicy.disableCookies}
                metadata={{
                  video_id: testimonial.id,
                  video_title: `${testimonial.name}${videoPlayerPolicy.metadataTitleSuffix}`,
                }}
                playbackId={testimonial.playbackId}
                playsInline={videoPlayerPolicy.playsInline}
                poster={poster}
                preload={videoPlayerPolicy.preload as "none"}
                ref={playerRef}
                style={{ aspectRatio: "9 / 16", height: "100%", width: "100%" }}
              />
            </div>
          ) : (
            <button
              aria-label={`Play ${testimonial.name}'s testimonial`}
              className="group absolute inset-0 cursor-pointer"
              onClick={() => setPlayerLoaded(true)}
              type="button"
            >
              <Image
                alt={`Video from ${testimonial.name}`}
                className="object-cover"
                fill
                priority={false}
                sizes="(min-width: 1280px) 360px, (min-width: 768px) 50vw, 100vw"
                src={poster!}
                unoptimized
              />
              <span className="bg-background/90 text-foreground absolute top-1/2 left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-lg transition-transform group-hover:scale-105 group-focus-visible:scale-105">
                <Play
                  aria-hidden="true"
                  className="ml-0.5 size-6 fill-current"
                />
              </span>
            </button>
          )}
        </div>
      ) : null}
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          {testimonial.avatarUrl ? (
            <Image
              alt=""
              className="size-11 rounded-full object-cover"
              height={44}
              src={testimonial.avatarUrl}
              unoptimized
              width={44}
            />
          ) : (
            <span
              aria-hidden="true"
              className="bg-muted grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold"
            >
              {initials(testimonial.name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold">{testimonial.name}</p>
            {identity ? (
              <p className="text-muted-foreground truncate text-sm">
                {identity}
              </p>
            ) : null}
          </div>
        </div>

        {testimonial.rating ? (
          <div
            aria-label={`${testimonial.rating} out of 5 stars`}
            className="flex gap-1 text-(--wall-accent)"
            role="img"
          >
            {Array.from({ length: 5 }, (_, index) => (
              <Star
                aria-hidden="true"
                className={
                  index < testimonial.rating!
                    ? "size-4 fill-current"
                    : "text-muted-foreground/35 size-4"
                }
                key={index}
              />
            ))}
          </div>
        ) : null}

        {testimonial.type === "text" ? (
          <blockquote className="text-[15px] leading-7 font-medium tracking-[-0.01em]">
            {testimonial.text}
          </blockquote>
        ) : null}

        {attributionRequired ? (
          <Link
            className="text-muted-foreground hover:text-foreground inline-flex text-xs underline underline-offset-4"
            href="/?utm_source=public_wall&utm_medium=referral&utm_campaign=powered_by"
            rel="sponsored nofollow"
          >
            Powered by Get Some Proof
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
