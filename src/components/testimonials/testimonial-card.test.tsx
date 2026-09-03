import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { TestimonialCard } from "./testimonial-card";

describe("TestimonialCard", () => {
  beforeEach(cleanup);

  it("renders the approved text anatomy without an astro-lp banner", () => {
    render(
      <TestimonialCard
        accentColor="#123abc"
        attributionRequired
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
    const attribution = screen.getByRole("link", {
      name: "Powered by Get Some Proof",
    });
    expect(attribution).toHaveAttribute("rel", "sponsored nofollow");
    expect(attribution).toHaveAttribute(
      "href",
      "/?utm_source=public_wall&utm_medium=referral&utm_campaign=powered_by",
    );
    expect(screen.queryByTestId("testimonial-banner")).not.toBeInTheDocument();
  });

  it("loads a vertical video player only after visitor intent", async () => {
    render(
      <TestimonialCard
        accentColor="#123abc"
        attributionRequired={false}
        testimonial={{
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

    fireEvent.click(play);
    const player = await screen.findByTestId("mux-video-player");
    expect(player).toHaveAttribute("data-playback-id", "public-playback-id");
    expect(player).toHaveAttribute("data-autoplay", "false");
    expect(player).toHaveAttribute("data-captions", "visible");
    expect(player).toHaveAttribute("data-disable-cookies", "true");
    expect(player).toHaveAttribute("data-preload", "none");
    expect(screen.queryByTestId("testimonial-banner")).toBeNull();
  });

  it("does not render an image or initials when avatar visibility is off", () => {
    const { container } = render(
      <TestimonialCard
        accentColor="#123abc"
        attributionRequired={false}
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
        attributionRequired={false}
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
