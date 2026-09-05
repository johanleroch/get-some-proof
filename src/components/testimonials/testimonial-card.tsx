"use client";

import {
  forwardRef,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import MuxPlayer from "@mux/mux-player-react/lazy";

import {
  type TestimonialCardValue,
  testimonialAspectRatio,
  testimonialCardHtml,
  testimonialPoster,
} from "@/components/testimonials/testimonial-card-markup";
import videoPlayerPolicy from "../../../public/embed/video-player-policy.json";

export type {
  TestimonialCardValue,
  TestimonialCardTextValue,
  TestimonialCardVideoValue,
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

function setVideoLoading(cardRoot: HTMLElement | null, loading: boolean) {
  const shell = cardRoot?.querySelector<HTMLElement>(".video-shell");
  const loader = shell?.querySelector<HTMLElement>("[data-gsp-video-loader]");
  shell?.toggleAttribute("data-loading", loading);
  loader?.classList.toggle("hidden", !loading);
  loader?.classList.toggle("grid", loading);
  if (loading) loader?.removeAttribute("aria-hidden");
  else loader?.setAttribute("aria-hidden", "true");
}

function setVideoActive(cardRoot: HTMLElement | null, active: boolean) {
  const shell = cardRoot?.querySelector<HTMLElement>(".video-shell");
  const poster = shell?.querySelector<HTMLElement>("[data-gsp-video-poster]");
  shell?.toggleAttribute("data-video-active", active);
  poster?.classList.toggle("opacity-0", active);
}

function setVideoPlaying(cardRoot: HTMLElement | null, playing: boolean) {
  const shell = cardRoot?.querySelector<HTMLElement>(".video-shell");
  const button = cardRoot?.querySelector<HTMLButtonElement>("[data-gsp-play]");
  const playIcon = button?.querySelector<HTMLElement>("[data-gsp-play-icon]");
  const pauseIcon = button?.querySelector<HTMLElement>("[data-gsp-pause-icon]");
  shell?.toggleAttribute("data-video-playing", playing);
  button?.toggleAttribute("data-playing", playing);
  button?.setAttribute(
    "aria-label",
    playing
      ? (button.dataset.pauseLabel ?? "Pause video testimonial")
      : (button.dataset.playLabel ?? "Play video testimonial"),
  );
  playIcon?.classList.toggle("hidden", playing);
  pauseIcon?.classList.toggle("hidden", !playing);
}

export function TestimonialCard({
  accentColor,
  menu,
  testimonial,
}: {
  accentColor: string;
  menu?: ReactNode;
  testimonial: TestimonialCardValue;
}) {
  const [playerTarget, setPlayerTarget] = useState<HTMLElement | null>(null);
  const [menuTarget, setMenuTarget] = useState<HTMLElement | null>(null);
  const hasMenu = Boolean(menu);
  const cardRootRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<React.ElementRef<typeof MuxPlayer>>(null);
  const playRequestedRef = useRef(false);
  const restorePlayButton = useCallback(() => {
    const button =
      cardRootRef.current?.querySelector<HTMLButtonElement>("[data-gsp-play]");
    setVideoPlaying(cardRootRef.current, false);
    setVideoActive(cardRootRef.current, false);
    button?.removeAttribute("aria-busy");
    setVideoLoading(cardRootRef.current, false);
    if (button) button.disabled = false;
    playerRef.current?.parentElement?.setAttribute("inert", "");
    playRequestedRef.current = false;
  }, []);
  const html = useMemo(
    () =>
      testimonialCardHtml({
        accentColor,
        menuMount: hasMenu,
        testimonial,
      }),
    [accentColor, hasMenu, testimonial],
  );

  useEffect(() => {
    setMenuTarget(
      cardRootRef.current?.querySelector<HTMLElement>("[data-gsp-card-menu]") ??
        null,
    );
  }, [html]);

  useEffect(() => {
    const button =
      cardRootRef.current?.querySelector<HTMLButtonElement>("[data-gsp-play]");
    const shell =
      cardRootRef.current?.querySelector<HTMLElement>(".video-shell");
    if (!button || !shell) return;
    setPlayerTarget(null);
    const preparePlayer = () => setPlayerTarget(shell);
    const toggleVideo = () => {
      const player = playerRef.current;
      if (button.hasAttribute("data-playing") && player) {
        player.pause();
        return;
      }
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      setVideoActive(cardRootRef.current, true);
      setVideoLoading(cardRootRef.current, true);
      if (!player) {
        playRequestedRef.current = true;
        preparePlayer();
        return;
      }
      void player.play().catch(restorePlayButton);
    };
    shell.addEventListener("pointerenter", preparePlayer);
    button.addEventListener("focus", preparePlayer);
    shell.addEventListener("touchstart", preparePlayer, { passive: true });
    shell.addEventListener("click", toggleVideo);
    return () => {
      shell.removeEventListener("pointerenter", preparePlayer);
      button.removeEventListener("focus", preparePlayer);
      shell.removeEventListener("touchstart", preparePlayer);
      shell.removeEventListener("click", toggleVideo);
    };
  }, [html, restorePlayButton]);

  useEffect(() => {
    if (!playerTarget || !playRequestedRef.current || !playerRef.current)
      return;
    playRequestedRef.current = false;
    void playerRef.current.play().catch(restorePlayButton);
  }, [playerTarget, restorePlayButton]);

  const handlePlaying = () => {
    const button =
      cardRootRef.current?.querySelector<HTMLButtonElement>("[data-gsp-play]");
    setVideoPlaying(cardRootRef.current, true);
    button?.removeAttribute("aria-busy");
    if (button) button.disabled = false;
    setVideoLoading(cardRootRef.current, false);
  };

  const handlePaused = () => {
    const button =
      cardRootRef.current?.querySelector<HTMLButtonElement>("[data-gsp-play]");
    setVideoPlaying(cardRootRef.current, false);
    button?.removeAttribute("aria-busy");
    if (button) button.disabled = false;
    setVideoLoading(cardRootRef.current, false);
  };

  const handleWaiting = () => {
    setVideoLoading(cardRootRef.current, true);
  };

  const videoContent =
    testimonial.type === "video" && playerTarget ? (
      <div
        className="absolute inset-0 z-0 h-full w-full"
        data-autoplay={videoPlayerPolicy.autoplay}
        data-captions={testimonial.captionsAvailable ? "hidden" : "unavailable"}
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
          defaultHiddenCaptions={videoPlayerPolicy.hideCaptions}
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
          onEnded={handlePaused}
          onPause={handlePaused}
          onPlaying={handlePlaying}
          onWaiting={handleWaiting}
          style={{
            "--controls": "none",
            "--loading-indicator": "none",
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
      {menu && menuTarget ? createPortal(menu, menuTarget) : null}
      {videoContent && playerTarget
        ? createPortal(videoContent, playerTarget)
        : null}
    </>
  );
}
