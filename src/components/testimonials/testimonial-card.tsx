"use client";

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import MuxPlayer from "@mux/mux-player-react/lazy";

import {
  type PublicTestimonial,
  testimonialAspectRatio,
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
  const [playerTarget, setPlayerTarget] = useState<HTMLElement | null>(null);
  const cardRootRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<React.ElementRef<typeof MuxPlayer>>(null);
  const playRequestedRef = useRef(false);
  const restorePlayButton = useCallback(() => {
    const button =
      cardRootRef.current?.querySelector<HTMLButtonElement>("[data-gsp-play]");
    button?.removeAttribute("data-playing");
    button?.removeAttribute("aria-busy");
    if (button) button.disabled = false;
    playerRef.current?.parentElement?.setAttribute("inert", "");
    playRequestedRef.current = false;
  }, []);
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
    const shell =
      cardRootRef.current?.querySelector<HTMLElement>(".video-shell");
    if (!button || !shell) return;
    setPlayerTarget(null);
    const preparePlayer = () => setPlayerTarget(shell);
    const playVideo = () => {
      const player = playerRef.current;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      if (!player) {
        playRequestedRef.current = true;
        preparePlayer();
        return;
      }
      player.parentElement?.removeAttribute("inert");
      void player.play().catch(restorePlayButton);
    };
    button.addEventListener("pointerenter", preparePlayer);
    button.addEventListener("focus", preparePlayer);
    button.addEventListener("touchstart", preparePlayer, { passive: true });
    button.addEventListener("click", playVideo);
    return () => {
      button.removeEventListener("pointerenter", preparePlayer);
      button.removeEventListener("focus", preparePlayer);
      button.removeEventListener("touchstart", preparePlayer);
      button.removeEventListener("click", playVideo);
    };
  }, [html, restorePlayButton]);

  useEffect(() => {
    if (!playerTarget || !playRequestedRef.current || !playerRef.current)
      return;
    playRequestedRef.current = false;
    playerRef.current.parentElement?.removeAttribute("inert");
    void playerRef.current.play().catch(restorePlayButton);
  }, [playerTarget, restorePlayButton]);

  const handlePlaying = () => {
    const button =
      cardRootRef.current?.querySelector<HTMLButtonElement>("[data-gsp-play]");
    button?.setAttribute("data-playing", "true");
    button?.removeAttribute("aria-busy");
    playerRef.current?.parentElement?.removeAttribute("inert");
  };

  const videoContent =
    testimonial.type === "video" && playerTarget ? (
      <div
        className="absolute inset-0 z-0 h-full w-full"
        data-autoplay={videoPlayerPolicy.autoplay}
        data-captions={
          testimonial.captionsAvailable ? "visible" : "unavailable"
        }
        data-disable-cookies={videoPlayerPolicy.disableCookies}
        data-playback-id={testimonial.playbackId}
        data-prefer-playback="mse"
        data-preload="none"
        data-testid="mux-video-player"
        inert
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
          preferPlayback="mse"
          preload={videoPlayerPolicy.preload as "none"}
          ref={playerRef}
          onError={restorePlayButton}
          onPlaying={handlePlaying}
          style={{
            "--media-object-fit": "cover",
            "--seek-backward-button": "none",
            "--seek-forward-button": "none",
            aspectRatio: testimonialAspectRatio(testimonial),
            height: "100%",
            width: "100%",
          }}
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
