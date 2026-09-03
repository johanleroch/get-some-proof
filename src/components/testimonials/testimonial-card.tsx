"use client";

import { forwardRef, memo, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MuxPlayer from "@mux/mux-player-react/lazy";

import {
  type PublicTestimonial,
  testimonialCardHtml,
  testimonialPoster,
} from "@/components/testimonials/testimonial-card-markup";
import videoPlayerPolicy from "../../../public/embed/video-player-policy.json";

export type {
  PublicTestimonial,
  PublicTextTestimonial,
  PublicVideoTestimonial,
} from "@/components/testimonials/testimonial-card-markup";

const StaticCardMarkup = memo(
  forwardRef<HTMLDivElement, { html: string }>(function StaticCardMarkup(
    { html },
    ref,
  ) {
    return (
      <div
        className="contents"
        dangerouslySetInnerHTML={{ __html: html }}
        ref={ref}
      />
    );
  }),
);

export function TestimonialCard({
  accentColor,
  attributionRequired,
  testimonial,
}: {
  accentColor: string;
  attributionRequired: boolean;
  testimonial: PublicTestimonial;
}) {
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const [playerTarget, setPlayerTarget] = useState<HTMLElement | null>(null);
  const cardRootRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<React.ElementRef<typeof MuxPlayer>>(null);
  const html = useMemo(
    () =>
      testimonialCardHtml({
        accentColor,
        attributionHref:
          "/?utm_source=public_wall&utm_medium=referral&utm_campaign=powered_by",
        attributionRequired,
        testimonial,
      }),
    [accentColor, attributionRequired, testimonial],
  );

  useEffect(() => {
    const button =
      cardRootRef.current?.querySelector<HTMLButtonElement>("[data-gsp-play]");
    if (!button) return;
    const loadPlayer = () => {
      const shell =
        cardRootRef.current?.querySelector<HTMLElement>(".video-shell");
      if (!shell) return;
      shell.replaceChildren();
      setPlayerTarget(shell);
      setPlayerLoaded(true);
    };
    button.addEventListener("click", loadPlayer);
    return () => button.removeEventListener("click", loadPlayer);
  }, [html]);

  useEffect(() => {
    if (playerLoaded) void playerRef.current?.play().catch(() => undefined);
  }, [playerLoaded]);

  const videoContent =
    testimonial.type === "video" && playerLoaded && playerTarget ? (
      <div
        className="h-full w-full"
        data-autoplay={videoPlayerPolicy.autoplay}
        data-captions={
          testimonial.captionsAvailable ? "visible" : "unavailable"
        }
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
          poster={testimonialPoster(testimonial)}
          preload={videoPlayerPolicy.preload as "none"}
          ref={playerRef}
          style={{ aspectRatio: "9 / 16", height: "100%", width: "100%" }}
        />
      </div>
    ) : undefined;

  return (
    <>
      <StaticCardMarkup html={html} ref={cardRootRef} />
      {videoContent && playerTarget
        ? createPortal(videoContent, playerTarget)
        : null}
    </>
  );
}
