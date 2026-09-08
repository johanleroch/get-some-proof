import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const projection = [
  {
    aspectRatio: "16:9",
    avatarUrl: null,
    avatarVisible: true,
    captionsAvailable: true,
    id: "projection-video",
    name: "Video Person",
    playbackId: "public-playback-id",
    publishedAt: 3,
    rating: 5,
    role: "Founder",
    type: "video" as const,
  },
  {
    avatarUrl: null,
    avatarVisible: false,
    company: "Example Studio",
    id: "projection-1",
    name: "Camille Test",
    publishedAt: 2,
    rating: 5,
    role: "Founder",
    text: "First published proof.",
    type: "text",
  },
  {
    avatarUrl: null,
    id: "projection-2",
    name: "Noah Test",
    publishedAt: 1,
    text: "Second published proof with a longer line for masonry sizing.",
    type: "text",
  },
];

function testimonialHtml(testimonial: (typeof projection)[number]) {
  const signature =
    testimonial.avatarVisible !== false && testimonial.avatarUrl
      ? `<span class="avatar"><img alt="" src="${testimonial.avatarUrl}"></span>`
      : '<span class="quote-mark" aria-hidden="true">\u201c</span>';
  const video =
    testimonial.type === "video"
      ? `<div class="video-shell" data-video-aspect-ratio="${testimonial.aspectRatio}" style="aspect-ratio:${testimonial.aspectRatio.replace(":", " / ")}"><span aria-hidden="true" aria-label="Loading video" class="video-loader" data-gsp-video-loader role="status"></span><img alt="Video from ${testimonial.name}" class="poster" data-gsp-video-poster src="https://image.mux.com/${testimonial.playbackId}/thumbnail.webp?width=960&amp;time=0.5"><span class="video-shade"></span><span class="video-overlay"><span><span class="video-name">${testimonial.name}</span></span><button aria-label="Play ${testimonial.name}'s testimonial" class="play" data-gsp-play data-pause-label="Pause ${testimonial.name}'s testimonial" data-play-label="Play ${testimonial.name}'s testimonial" type="button"><span class="play-icon"><svg data-gsp-play-icon fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24"><path d="m6 3 14 9-14 9z"></path></svg><svg class="hidden" data-gsp-pause-icon fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"></path></svg></span></button></span></div>`
      : "";
  const text =
    testimonial.type === "text"
      ? `<blockquote>${testimonial.text}</blockquote>`
      : "";
  const stars = testimonial.rating
    ? `<div aria-label="${testimonial.rating} out of 5 stars" class="stars" role="img">★★★★★</div>`
    : "";

  // Mirrors testimonialCardHtml: the stars open the card, the quote reads, then
  // the signature row where a face or the quote mark stands beside the name.
  return `<article class="card${testimonial.type === "video" ? " video-card" : ""}" data-gsp-card style="--wall-accent:#7c3aed">${video}<div class="content">${stars}${text}<div class="identity">${signature}<div class="person"><p class="name">${testimonial.name}</p></div></div></div></article>`;
}

function response(
  testimonials = projection,
  brandOverrides: Partial<{
    attributionRequired: boolean;
    theme: "light" | "dark" | "system";
    transparentEmbed: boolean;
  }> = {},
) {
  return {
    brand: {
      accentColor: "#7c3aed",
      attributionRequired: true,
      name: "Acme Studio",
      publicSlug: "acme-proof",
      theme: "system",
      transparentEmbed: false,
      ...brandOverrides,
    },
    pagination: { cursor: null },
    schemaVersion: 1,
    testimonials: testimonials.map((testimonial) => ({
      ...testimonial,
      html: testimonialHtml(testimonial),
    })),
  };
}

const hosts = {
  plain: {
    css: ".stage { font-family: Georgia, serif; }",
    font: "Georgia",
  },
  wordpress: {
    css: ".stage { font-family: system-ui; } .stage article, .stage p, .stage a { all: unset !important; color: lime !important; }",
    font: "system-ui",
  },
  webflow: {
    css: ".stage { font-family: Arial, sans-serif; } .stage * { border-radius: 0 !important; text-transform: uppercase !important; }",
    font: "Arial",
  },
  framer: {
    css: ".stage { font-family: 'Courier New', monospace; } .stage article, .stage a { all: unset !important; }",
    font: "Courier New",
  },
} as const;

test("renders isolated, responsive, ordered walls in every approved host fixture", async ({
  baseURL,
  browserName,
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.route("**/api/public-wall/acme-proof*", (route) =>
    route.fulfill({
      body: JSON.stringify(response()),
      contentType: "application/json",
    }),
  );

  for (const [host, fixture] of Object.entries(hosts)) {
    await page.setContent(`
      <style>${fixture.css}</style>
      <div class="stage" style="width: 1120px">
        <p class="sentinel">Host sentinel</p>
        <div data-gsp-wall data-public-slug="acme-proof"></div>
        <div data-gsp-wall data-public-slug="acme-proof"></div>
      </div>
      <script async src="${baseURL}/embed/v1.js" data-api-origin="${baseURL}"></script>
      <script async src="${baseURL}/embed/v1.js" data-api-origin="${baseURL}"></script>
    `);
    const walls = page.locator("[data-gsp-wall]");
    await expect(walls).toHaveCount(2);
    await expect(walls.first()).toHaveAttribute("data-gsp-state", "ready");
    await expect(walls.nth(1)).toHaveAttribute("data-gsp-state", "ready");
    await expect(page.locator("iframe")).toHaveCount(0);

    const proofTexts = await walls
      .first()
      .locator("blockquote")
      .allTextContents();
    expect(proofTexts).toEqual([
      "First published proof.",
      "Second published proof with a longer line for masonry sizing.",
    ]);
    await expect(
      walls
        .first()
        .locator("blockquote")
        .first()
        .locator("xpath=../..")
        .locator(".avatar"),
    ).toHaveCount(0);
    const computed = await walls.first().evaluate((wall) => {
      const shadow = wall.shadowRoot!;
      return {
        cardFont: getComputedStyle(shadow.querySelector("article")!).fontFamily,
        cardRadius: getComputedStyle(shadow.querySelector("article")!)
          .borderRadius,
        columns: getComputedStyle(shadow.querySelector(".grid")!).columnCount,
        wallMaxWidth: getComputedStyle(shadow.querySelector(".wall")!).maxWidth,
      };
    });
    expect(computed.cardFont).toContain(fixture.font);
    expect(computed.cardRadius).toBe("12px");
    expect(computed.columns).toBe("2");
    expect(computed.wallMaxWidth).toBe("1152px");

    await page.locator(".stage").evaluate((element) => {
      (element as HTMLElement).style.width = "720px";
    });
    await expect
      .poll(() =>
        walls
          .first()
          .evaluate(
            (wall) =>
              getComputedStyle(wall.shadowRoot!.querySelector(".grid")!)
                .columnCount,
          ),
      )
      .toBe("2");

    await page.locator(".stage").evaluate((element) => {
      (element as HTMLElement).style.width = "360px";
    });
    await expect
      .poll(() =>
        walls
          .first()
          .evaluate(
            (wall) =>
              getComputedStyle(wall.shadowRoot!.querySelector(".grid")!)
                .columnCount,
          ),
      )
      .toBe("1");

    await page.locator(".sentinel").focus();
    const tabKey = browserName === "webkit" ? "Alt+Tab" : "Tab";
    await page.keyboard.press(tabKey);
    await expect(
      walls.first().getByRole("button", {
        name: "Play Video Person's testimonial",
      }),
    ).toBeFocused();
    await page.keyboard.press(tabKey);
    const promotionLink = walls.first().getByRole("link", {
      name: "Sign up for free",
    });
    await expect(promotionLink).toBeFocused();
    await expect(promotionLink).toHaveAttribute("rel", "sponsored nofollow");
    await expect(promotionLink).toHaveAttribute(
      "href",
      /utm_source=embedded_wall.*utm_medium=referral.*utm_campaign=powered_by/,
    );
    await expect(walls.first().locator("[data-gsp-promotion]")).toHaveCount(1);
    await expect(walls.first()).not.toContainText("Powered by Get Some Proof");
    const linkStyle = await promotionLink.evaluate((link) => ({
      outline: getComputedStyle(link).outlineStyle,
      transition: getComputedStyle(link).transitionDuration,
    }));
    expect(linkStyle).toEqual({ outline: "solid", transition: "0s" });

    const evidenceRoot = process.env.EMBED_EVIDENCE_DIR;
    const screenshotPath = evidenceRoot
      ? path.join(evidenceRoot, testInfo.project.name, `${host}-embed.png`)
      : testInfo.outputPath(`${host}-embed.png`);
    await mkdir(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });
  }

  expect(
    requests.some(
      (url) =>
        !url.startsWith("https://image.mux.com/") &&
        /stream\.mux\.com|analytics|segment|posthog/i.test(url),
    ),
  ).toBe(false);
  expect(await page.context().cookies()).toEqual([]);
});

test("applies the configured theme and transparent embed background", async ({
  baseURL,
  page,
}) => {
  await page.route("**/api/public-wall/acme-proof*", (route) =>
    route.fulfill({
      body: JSON.stringify(
        response(projection, { theme: "dark", transparentEmbed: true }),
      ),
      contentType: "application/json",
    }),
  );
  await page.setContent(`
    <div data-gsp-wall data-public-slug="acme-proof"></div>
    <script src="${baseURL}/embed/v1.js" data-api-origin="${baseURL}"></script>
  `);
  const wall = page.locator("[data-gsp-wall]");
  await expect(wall).toHaveAttribute("data-theme", "dark");
  await expect(wall).toHaveAttribute("data-transparent-embed", "true");
  await expect(wall).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(wall.locator("article").first()).toHaveCSS(
    "background-color",
    "rgb(33, 28, 24)",
  );
});

test("does not render the promotion card for Pro", async ({
  baseURL,
  page,
}) => {
  await page.route("**/api/public-wall/acme-proof*", (route) =>
    route.fulfill({
      body: JSON.stringify(
        response(projection, { attributionRequired: false }),
      ),
      contentType: "application/json",
    }),
  );
  await page.setContent(`
    <div data-gsp-wall data-public-slug="acme-proof"></div>
    <script src="${baseURL}/embed/v1.js" data-api-origin="${baseURL}"></script>
  `);

  const wall = page.locator("[data-gsp-wall]");
  await expect(wall).toHaveAttribute("data-gsp-state", "ready");
  await expect(wall.locator("[data-gsp-promotion]")).toHaveCount(0);
  await expect(
    wall.getByRole("link", { name: "Sign up for free" }),
  ).toHaveCount(0);
});

test("keeps empty and failed embeds at zero height with explicit state", async ({
  baseURL,
  page,
}) => {
  await page.route("**/api/public-wall/empty-proof*", (route) =>
    route.fulfill({
      body: JSON.stringify(response([])),
      contentType: "application/json",
    }),
  );
  await page.route("**/api/public-wall/broken-proof*", (route) =>
    route.abort(),
  );
  await page.setContent(`
    <script>window.embedErrors = []; document.addEventListener('gsp:error', (event) => window.embedErrors.push(event.detail.code));</script>
    <div data-gsp-wall data-public-slug="empty-proof"></div>
    <div data-gsp-wall data-public-slug="broken-proof"></div>
    <script src="${baseURL}/embed/v1.js" data-api-origin="${baseURL}"></script>
  `);

  const empty = page.locator('[data-public-slug="empty-proof"]');
  const broken = page.locator('[data-public-slug="broken-proof"]');
  await expect(empty).toHaveAttribute("data-gsp-state", "empty");
  await expect(broken).toHaveAttribute("data-gsp-state", "error");
  expect(
    await empty.evaluate((element) => element.getBoundingClientRect().height),
  ).toBe(0);
  expect(
    await broken.evaluate((element) => element.getBoundingClientRect().height),
  ).toBe(0);
  expect(
    await page.evaluate(
      () => (window as never as { embedErrors: string[] }).embedErrors,
    ),
  ).toEqual(["NETWORK_ERROR"]);
});

test("reserves the source ratio and prepares Mux without preloading media", async ({
  baseURL,
  page,
}, testInfo) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.route("**/api/public-wall/acme-proof*", (route) =>
    route.fulfill({
      body: JSON.stringify(
        response([
          {
            aspectRatio: "4:3",
            avatarUrl: null,
            captionsAvailable: true,
            company: "Example Studio",
            id: "video-projection",
            name: "Camille Test",
            playbackId: "public-playback-id",
            publishedAt: 3,
            role: "Founder",
            type: "video",
          },
        ]),
      ),
      contentType: "application/json",
    }),
  );
  await page.route("https://*.mux.com/**", (route) => route.abort());
  await page.setContent(`
    <div style="width: 360px"><div data-gsp-wall data-public-slug="acme-proof"></div></div>
    <script src="${baseURL}/embed/v1.js" data-api-origin="${baseURL}"></script>
  `);

  const wall = page.locator("[data-gsp-wall]");
  await expect(wall).toHaveAttribute("data-gsp-state", "ready");
  const video = wall.locator(".video-shell");
  await expect(video).toHaveCSS("aspect-ratio", "4 / 3");
  await expect(video).toHaveCSS("cursor", "pointer");
  const player = wall.locator("mux-player");
  await expect(player).toHaveCount(0);
  const playButton = wall.getByRole("button", {
    name: "Play Camille Test's testimonial",
  });
  await expect(playButton).toBeVisible();
  await playButton.hover();
  await expect(player).toHaveAttribute("playback-id", "public-playback-id");
  await expect(player).toHaveAttribute("prefer-playback", "mse");
  await expect(player).toHaveAttribute("preload", "none");
  expect(requests.some((url) => /stream\.mux\.com/i.test(url))).toBe(false);

  const loadingState = await playButton.evaluate((button) => {
    const shell = button.closest<HTMLElement>(".video-shell");
    shell?.click();
    const loader = shell?.querySelector<HTMLElement>("[data-gsp-video-loader]");
    return {
      active: shell?.hasAttribute("data-video-active"),
      ariaHidden: loader?.getAttribute("aria-hidden"),
      loading: shell?.dataset.loading,
      playing: (button as HTMLElement).dataset.playing,
    };
  });
  expect(loadingState).toEqual({
    active: true,
    ariaHidden: null,
    loading: "true",
    playing: undefined,
  });
  await expect(player).toHaveAttribute("stream-type", "on-demand");
  await expect(player).toHaveCSS("--controls", "none");
  await player.dispatchEvent("playing");
  await expect(video).not.toHaveAttribute("data-loading");
  await expect(video.locator("[data-gsp-video-loader]")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  const pauseButton = wall.getByRole("button", {
    name: "Pause Camille Test's testimonial",
  });
  await expect(pauseButton).toBeVisible();
  await expect(video).toHaveAttribute("data-video-playing");
  const overlay = video.locator(".video-overlay");
  const shade = video.locator(".video-shade");
  await expect(overlay).toHaveCSS("opacity", "1");
  await expect(overlay).toHaveCSS("transition-property", "opacity");
  const supportsHover = await page.evaluate(
    () => matchMedia("(hover: hover) and (pointer: fine)").matches,
  );
  const evidenceRoot = process.env.EMBED_EVIDENCE_DIR;
  if (evidenceRoot) {
    await player.evaluate((element) => {
      (element as HTMLElement).style.setProperty(
        "display",
        "none",
        "important",
      );
    });
    await video.evaluate((shell) => {
      shell.style.background = "#64748b";
      const poster = shell.querySelector<HTMLElement>(".poster");
      if (poster) poster.style.display = "none";
    });
  }
  if (supportsHover) {
    await page.mouse.move(0, 0);
    await expect(overlay).toHaveCSS("opacity", "0");
    await expect(shade).toHaveCSS("opacity", "0");
    if (evidenceRoot) {
      const hiddenPath = path.join(
        evidenceRoot,
        testInfo.project.name,
        "video-overlay-hidden.png",
      );
      await mkdir(path.dirname(hiddenPath), { recursive: true });
      await video.screenshot({ path: hiddenPath });
    }
    await video.hover();
    await expect(overlay).toHaveCSS("opacity", "1");
    await expect(shade).toHaveCSS("opacity", "1");
    if (evidenceRoot) {
      await video.screenshot({
        path: path.join(
          evidenceRoot,
          testInfo.project.name,
          "video-overlay-hover.png",
        ),
      });
    }
  } else {
    await expect(overlay).toHaveCSS("opacity", "1");
    await expect(shade).toHaveCSS("opacity", "1");
    if (evidenceRoot) {
      const touchPath = path.join(
        evidenceRoot,
        testInfo.project.name,
        "video-overlay-touch.png",
      );
      await mkdir(path.dirname(touchPath), { recursive: true });
      await video.screenshot({ path: touchPath });
    }
  }
  await expect(
    wall.locator(".video-name", { hasText: "Camille Test" }),
  ).toBeVisible();
  await player.dispatchEvent("pause");
  await expect(video).not.toHaveAttribute("data-video-playing");
  await expect(playButton).toBeVisible();
  await player.dispatchEvent("playing");
  await player.dispatchEvent("waiting");
  await expect(video).toHaveAttribute("data-loading", "true");
  await expect(video.locator("[data-gsp-video-loader]")).not.toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await player.dispatchEvent("error");
  await expect(video).not.toHaveAttribute("data-loading");
  await expect(playButton).toBeEnabled();
  await expect(playButton).not.toHaveAttribute("aria-busy");
  await expect(playButton).not.toHaveAttribute("data-playing");
  await expect(player).not.toHaveAttribute("autoplay", "");
  await expect(player).toHaveAttribute("default-hidden-captions", "");
  await expect(wall.locator("[data-testid='testimonial-banner']")).toHaveCount(
    0,
  );
});
