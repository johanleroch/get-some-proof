import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

const projection = [
  {
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
  const avatar =
    testimonial.avatarVisible === false
      ? ""
      : `<span class="avatar" aria-hidden="true">${testimonial.name
          .split(" ")
          .map((part) => part[0])
          .join("")}</span>`;
  const video =
    testimonial.type === "video"
      ? `<div class="video-shell"><button aria-label="Play ${testimonial.name}'s testimonial" class="play" data-gsp-play type="button"><img alt="Video from ${testimonial.name}" class="poster" src="https://image.mux.com/${testimonial.playbackId}/thumbnail.png?width=720&amp;height=1280&amp;fit_mode=smartcrop&amp;time=0.5"><span class="play-icon">Play</span></button></div>`
      : "";
  const text =
    testimonial.type === "text"
      ? `<blockquote>${testimonial.text}</blockquote>`
      : "";
  const stars = testimonial.rating
    ? `<div aria-label="${testimonial.rating} out of 5 stars" class="stars" role="img">★★★★★</div>`
    : "";

  return `<article class="card${testimonial.type === "video" ? " video-card" : ""}" data-gsp-card style="--wall-accent:#7c3aed">${video}<div class="content"><div class="identity">${avatar}<div class="person"><p class="name">${testimonial.name}</p></div></div>${stars}${text}<a class="attribution" href="https://proof.example/?utm_source=embedded_wall&amp;utm_medium=referral&amp;utm_campaign=powered_by" rel="sponsored nofollow">Powered by Get Some Proof</a></div></article>`;
}

function response(
  testimonials = projection,
  brandOverrides: Partial<{
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
      };
    });
    expect(computed.cardFont).toContain(fixture.font);
    expect(computed.cardRadius).toBe("12px");
    expect(computed.columns).toBe("3");

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
    const attribution = walls.first().locator("a").first();
    await expect(attribution).toBeFocused();
    await expect(attribution).toHaveAttribute("rel", "sponsored nofollow");
    await expect(attribution).toHaveAttribute(
      "href",
      /utm_source=embedded_wall.*utm_medium=referral.*utm_campaign=powered_by/,
    );
    const linkStyle = await walls
      .first()
      .locator("a")
      .first()
      .evaluate((link) => ({
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
        /mux|analytics|segment|posthog/i.test(url),
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
    "rgb(24, 24, 27)",
  );
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

test("reserves a 9:16 video card and loads Mux only after explicit play", async ({
  baseURL,
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.route("**/api/public-wall/acme-proof*", (route) =>
    route.fulfill({
      body: JSON.stringify(
        response([
          {
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
  await expect(video).toHaveCSS("aspect-ratio", "9 / 16");
  await expect(
    wall.getByRole("button", { name: "Play Camille Test's testimonial" }),
  ).toBeVisible();
  expect(
    requests.some((url) => /mux-player\.js|stream\.mux\.com/i.test(url)),
  ).toBe(false);

  await wall
    .getByRole("button", { name: "Play Camille Test's testimonial" })
    .click();
  const player = wall.locator("mux-player");
  await expect(player).toHaveAttribute("playback-id", "public-playback-id");
  await expect(player).toHaveAttribute("preload", "none");
  await expect(player).not.toHaveAttribute("autoplay", "");
  await expect(player).not.toHaveAttribute("default-hidden-captions", "");
  await expect(wall.locator("[data-testid='testimonial-banner']")).toHaveCount(
    0,
  );
});
