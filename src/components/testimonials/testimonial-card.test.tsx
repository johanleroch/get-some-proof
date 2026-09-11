import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const muxMedia = vi.hoisted(() => ({
  pause: vi.fn(),
  play: vi.fn(() => Promise.resolve()),
}));

vi.mock("@mux/mux-player-react/lazy", async () => {
  const { forwardRef } = await import("react");

  return {
    default: forwardRef<
      HTMLVideoElement,
      {
        onError?: () => void;
        onEnded?: () => void;
        onPause?: () => void;
        onPlaying?: () => void;
        onWaiting?: () => void;
        defaultHiddenCaptions?: boolean;
        style?: Record<string, string>;
      }
    >(function MockMuxPlayer(
      {
        defaultHiddenCaptions,
        onEnded,
        onError,
        onPause,
        onPlaying,
        onWaiting,
        style,
      },
      ref,
    ) {
      return (
        <video
          aria-label="Mock video player"
          data-controls={style?.["--controls"]}
          data-default-hidden-captions={defaultHiddenCaptions}
          data-testid="mux-event-source"
          onEnded={onEnded}
          onError={onError}
          onPause={onPause}
          onPlaying={onPlaying}
          onWaiting={onWaiting}
          ref={(node) => {
            if (node) {
              Object.defineProperty(node, "play", {
                configurable: true,
                value: muxMedia.play,
              });
              Object.defineProperty(node, "pause", {
                configurable: true,
                value: muxMedia.pause,
              });
            }
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
        />
      );
    }),
  };
});

import { TestimonialCard } from "./testimonial-card";
import { testimonialAspectRatio } from "./testimonial-card-markup";

describe("TestimonialCard", () => {
  beforeEach(() => {
    cleanup();
    muxMedia.pause.mockClear();
    muxMedia.play.mockClear();
  });

  it("keeps legacy portrait recordings in their expected frame", () => {
    expect(
      testimonialAspectRatio({
        avatarUrl: null,
        captionsAvailable: false,
        id: "legacy-video",
        name: "Legacy portrait",
        playbackId: "legacy-playback",
        publishedAt: 1,
        type: "video",
      }),
    ).toBe("9 / 16");
  });

  it("renders the approved text anatomy without an astro-lp banner", () => {
    render(
      <TestimonialCard
        accentColor="#123abc"
        testimonial={{
          avatarUrl: null,
          company: "Example Studio",
          id: "projection-1",
          name: "Camille Test",
          publishedAt: 1,
          rating: 5,
          role: "Founder",
          text: "A specific customer outcome belongs here.",
          type: "text",
        }}
      />,
    );

    expect(screen.getByText("Camille Test")).toBeInTheDocument();
    expect(screen.getByText("Founder · Example Studio")).toBeInTheDocument();
    expect(
      screen.getByText("A specific customer outcome belongs here."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("5 out of 5 stars")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByTestId("testimonial-banner")).not.toBeInTheDocument();
  });

  it("prepares a ratio-aware video player only after visitor intent", async () => {
    const { container } = render(
      <TestimonialCard
        accentColor="#123abc"
        testimonial={{
          aspectRatio: "4:3",
          avatarUrl: null,
          captionsAvailable: true,
          company: "Example Studio",
          id: "projection-video",
          name: "Camille Test",
          playbackId: "public-playback-id",
          publishedAt: 1,
          rating: 5,
          role: "Founder",
          type: "video",
        }}
      />,
    );

    const play = screen.getByRole("button", {
      name: "Play Camille Test's testimonial",
    });
    expect(screen.queryByTestId("mux-video-player")).toBeNull();
    expect(
      screen.getByRole("img", { name: "Video from Camille Test" }),
    ).toHaveAttribute(
      "src",
      expect.stringContaining("image.mux.com/public-playback-id/thumbnail"),
    );
    expect(play.closest(".video-shell")).toHaveAttribute(
      "style",
      "aspect-ratio:4 / 3",
    );
    expect(play.closest(".video-shell")).toHaveClass("cursor-pointer");
    expect(container.querySelector(".video-overlay")).toHaveClass(
      "transition-opacity",
    );
    expect(screen.getByLabelText("5 out of 5 stars")).toBeInTheDocument();
    expect(container.querySelector(".video-accent")).toBeNull();
    expect(play).toHaveClass("size-12");
    expect(screen.queryByRole("status", { name: "Loading video" })).toBeNull();

    fireEvent.pointerEnter(play.closest(".video-shell")!);
    const player = await screen.findByTestId("mux-video-player");
    fireEvent.click(play.closest(".video-shell")!);
    expect(screen.getByRole("status", { name: "Loading video" })).toBeVisible();
    expect(
      screen
        .getByRole("status", { name: "Loading video" })
        .querySelector('svg[id^="blob-anim-"]'),
    ).not.toBeNull();
    expect(play).not.toHaveAttribute("data-playing");
    expect(play.closest(".video-shell")).toHaveAttribute("data-video-active");
    expect(play).toBeInTheDocument();
    expect(player).toHaveAttribute("data-playback-id", "public-playback-id");
    expect(player).toHaveAttribute("data-autoplay", "false");
    expect(player).toHaveAttribute("data-captions", "hidden");
    expect(screen.getByTestId("mux-event-source")).toHaveAttribute(
      "data-default-hidden-captions",
      "true",
    );
    expect(player).toHaveAttribute("data-disable-cookies", "true");
    expect(player).toHaveAttribute("data-prefer-playback", "mse");
    expect(player).toHaveAttribute("data-preload", "none");
    const eventSource = screen.getByTestId("mux-event-source");
    expect(eventSource).toHaveAttribute("data-controls", "none");
    fireEvent.playing(eventSource);
    expect(screen.queryByRole("status", { name: "Loading video" })).toBeNull();
    const pause = screen.getByRole("button", {
      name: "Pause Camille Test's testimonial",
    });
    expect(pause).toHaveAttribute("data-playing");
    expect(pause.closest(".video-shell")).toHaveAttribute("data-video-playing");
    expect(screen.getByText("Camille Test")).toBeVisible();
    expect(screen.getByText("Founder · Example Studio")).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Video from Camille Test" }),
    ).toHaveClass("opacity-0");
    fireEvent.click(pause);
    expect(muxMedia.pause).toHaveBeenCalledOnce();
    fireEvent.pause(eventSource);
    expect(play.closest(".video-shell")).not.toHaveAttribute(
      "data-video-playing",
    );
    expect(
      screen.getByRole("button", {
        name: "Play Camille Test's testimonial",
      }),
    ).toBeEnabled();
    fireEvent.click(play);
    fireEvent.playing(eventSource);
    fireEvent.waiting(eventSource);
    expect(screen.getByRole("status", { name: "Loading video" })).toBeVisible();
    expect(
      screen
        .getByRole("status", { name: "Loading video" })
        .querySelector('svg[id^="blob-anim-"]'),
    ).not.toBeNull();
    fireEvent.error(eventSource);
    expect(screen.queryByRole("status", { name: "Loading video" })).toBeNull();
    expect(play).toBeEnabled();
    expect(play).not.toHaveAttribute("aria-busy");
    expect(play).not.toHaveAttribute("data-playing");
    expect(screen.queryByTestId("testimonial-banner")).toBeNull();
  });

  it("mounts an optional private menu without changing the shared card", async () => {
    render(
      <TestimonialCard
        accentColor="#123abc"
        menu={<button type="button">Private options</button>}
        testimonial={{
          avatarUrl: null,
          id: "testimonial-with-menu",
          name: "Camille Test",
          publishedAt: 1,
          text: "A specific customer outcome belongs here.",
          type: "text",
        }}
      />,
    );

    expect(
      await screen.findByRole("button", { name: "Private options" }),
    ).toBeVisible();
    expect(document.querySelectorAll("[data-gsp-card]")).toHaveLength(1);
    expect(
      document
        .querySelector("[data-gsp-card-menu]")
        ?.closest("[data-gsp-card]"),
    ).toBeInTheDocument();
  });

  it("keeps a private menu click isolated from video playback", async () => {
    render(
      <TestimonialCard
        accentColor="#123abc"
        menu={<button type="button">Private options</button>}
        testimonial={{
          aspectRatio: "16:9",
          avatarUrl: null,
          captionsAvailable: true,
          id: "video-with-menu",
          name: "Camille Test",
          playbackId: "playback-with-menu",
          publishedAt: 1,
          type: "video",
        }}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Private options" }),
    );
    expect(screen.queryByTestId("mux-video-player")).toBeNull();
  });

  it("never puts Get Some Proof promotion inside a video card", () => {
    render(
      <TestimonialCard
        accentColor="#123abc"
        testimonial={{
          avatarUrl: null,
          captionsAvailable: true,
          id: "projection-video-attribution",
          name: "Camille Test",
          playbackId: "public-playback-id",
          publishedAt: 1,
          role: "Founder",
          type: "video",
        }}
      />,
    );

    expect(screen.queryByText("Powered by Get Some Proof")).toBeNull();
    expect(screen.queryByText("Testimonials made easy")).toBeNull();
  });

  it("does not render an image or initials when avatar visibility is off", () => {
    const { container } = render(
      <TestimonialCard
        accentColor="#123abc"
        testimonial={{
          avatarUrl: null,
          avatarVisible: false,
          id: "projection-hidden-avatar",
          name: "Camille Test",
          publishedAt: 1,
          text: "Avatar-free proof.",
          type: "text",
        }}
      />,
    );

    expect(container.querySelector(".avatar")).toBeNull();
    expect(screen.getByText("Camille Test")).toBeInTheDocument();
  });

  it("renders public content as text instead of executable markup", () => {
    const { container } = render(
      <TestimonialCard
        accentColor="#123abc"
        testimonial={{
          avatarUrl: 'https://example.com/avatar.png" onerror="alert(1)',
          id: "projection-untrusted",
          name: "<script>alert(1)</script>",
          publishedAt: 1,
          text: '<img src=x onerror="alert(1)">',
          type: "text",
        }}
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("blockquote img")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(container.querySelector(".avatar img")).not.toHaveAttribute(
      "onerror",
    );
  });
});

it("renders safe inline links and drops unsafe destinations without treating text as HTML", () => {
  render(
    <TestimonialCard
      accentColor="#b86a08"
      testimonial={{
        id: "safe-links",
        type: "text",
        name: "Camille",
        avatarUrl: null,
        publishedAt: 1,
        text: "@atelier <script> @unsafe",
        richText: [
          {
            type: "p",
            children: [
              {
                text: "@atelier",
                href: 'https://example.com/?q="hello"&x=1',
                highlight: true,
              },
              { text: " <script> " },
              { text: "@unsafe", href: "javascript:alert(1)" },
            ],
          },
        ],
      }}
    />,
  );
  const link = screen.getByRole("link", { name: "@atelier" });
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "ugc nofollow noopener noreferrer");
  expect(link.querySelector("mark")).toHaveTextContent("@atelier");
  expect(screen.queryByRole("link", { name: "@unsafe" })).toBeNull();
  expect(document.querySelector("blockquote script")).toBeNull();
  expect(document.querySelector("blockquote")).toHaveTextContent("<script>");
});
