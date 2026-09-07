(() => {
  "use strict";

  const runtimeKey = "__getSomeProofEmbedV1";
  const selector = "[data-gsp-wall][data-public-slug]";
  const currentScript = document.currentScript;
  const apiOrigin = new URL(
    currentScript?.dataset.apiOrigin || currentScript?.src || location.href,
    location.href,
  ).origin;

  if (window[runtimeKey]) {
    window[runtimeKey].mountAll();
    return;
  }

  const mounted = new WeakSet();
  const styles = `
    :host {
      display: block;
      width: 100%;
      color: inherit;
      font-family: inherit;
      line-height: 1.5;
      /* Warm neutrals, hex copies of the OKLCH tokens in globals.css. */
      --gsp-accent: #ffbb16;
      --gsp-accent-ink: #2e2a25;
      --gsp-surface: #ffffff;
      --gsp-text: #2e2a25;
      --gsp-muted: #6b655c;
      --gsp-border: #e6e0d5;
      --gsp-promo-surface: #2e2a25;
      --gsp-promo-text: #fcfaf5;
      --gsp-promo-cta: #ffbb16;
      --gsp-promo-cta-hover: #e5a500;
      --gsp-promo-cta-text: #2e2a25;
      background: var(--gsp-surface);
    }
    :host([data-transparent-embed="true"]) { background: transparent; }
    :host([data-theme="dark"]) {
      --gsp-surface: #211c18;
      --gsp-text: #eeebe4;
      --gsp-muted: #a9a49c;
      --gsp-border: rgb(255 255 255 / 0.1);
      --gsp-promo-surface: #eeebe4;
      --gsp-promo-text: #17130f;
    }
    @media (prefers-color-scheme: dark) {
      :host([data-theme="system"]) {
        --gsp-surface: #211c18;
        --gsp-text: #eeebe4;
        --gsp-muted: #a9a49c;
        --gsp-border: rgb(255 255 255 / 0.1);
        --gsp-promo-surface: #eeebe4;
        --gsp-promo-text: #17130f;
      }
    }
    *, *::before, *::after { box-sizing: border-box; }
    .wall {
      container-type: inline-size;
      width: 100%;
      max-width: 72rem;
      margin-inline: auto;
      font-family: inherit;
    }
    .grid { column-count: 1; column-gap: 16px; }
    .card {
      display: inline-block;
      width: 100%;
      margin: 0 0 20px;
      padding: 0;
      break-inside: avoid;
      overflow: hidden;
      border: 1px solid var(--gsp-border);
      border-radius: 12px;
      background: var(--gsp-surface);
      color: var(--gsp-text);
      font-family: inherit;
      letter-spacing: normal;
      text-align: left;
      text-transform: none;
    }
    .card.video-card { padding: 0; }
    .content { padding: 20px; }
    .promo-card {
      padding: 24px;
      border-color: transparent;
      background: var(--gsp-promo-surface);
      color: var(--gsp-promo-text);
    }
    .promo-title, .promo-copy { margin: 0; color: var(--gsp-promo-text); font-family: inherit; }
    .promo-title {
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -0.025em;
      line-height: 1.2;
    }
    .promo-copy {
      margin-top: 20px;
      color: var(--gsp-promo-text);
      font-size: 18px;
      line-height: 1.55;
    }
    .promo-cta {
      display: flex;
      width: 100%;
      min-height: 44px;
      align-items: center;
      justify-content: center;
      margin-top: 28px;
      padding: 10px 20px;
      border-radius: 8px;
      background: var(--gsp-promo-cta);
      color: var(--gsp-promo-cta-text);
      font-family: inherit;
      font-size: 16px;
      font-weight: 600;
      line-height: 1.5;
      text-align: center;
      text-decoration: none;
      transition: background-color 120ms ease;
    }
    .promo-cta:hover { background: var(--gsp-promo-cta-hover); }
    .promo-cta:focus-visible {
      outline: 3px solid var(--gsp-promo-cta);
      outline-offset: 3px;
    }
    .video-shell {
      position: relative;
      width: 100%;
      overflow: hidden;
      cursor: pointer;
      background: #000;
    }
    .video-shell mux-player {
      display: block;
      width: 100%;
      height: 100%;
      --controls: none;
      --loading-indicator: none;
      --media-object-fit: cover;
    }
    .player-layer { position: absolute; z-index: 0; inset: 0; }
    .video-loader {
      position: absolute;
      z-index: 5;
      inset: 0;
      display: none;
      place-items: center;
      background: rgb(0 0 0 / 0.35);
      color: #fff;
      pointer-events: none;
    }
    .video-loader svg { width: 40px; height: 40px; animation: gsp-spin 800ms linear infinite; }
    .video-shell[data-loading="true"] .video-loader { display: grid; }
    @keyframes gsp-spin { to { transform: rotate(360deg); } }
    .play {
      display: grid;
      width: 48px;
      height: 48px;
      flex: 0 0 48px;
      place-items: center;
      padding: 0;
      cursor: pointer;
      border: 0;
      border-radius: 999px;
      background: rgb(255 255 255 / 0.92);
      color: #2e2a25;
      box-shadow: 0 1px 2px rgb(46 42 37 / 0.06), 0 12px 32px rgb(46 42 37 / 0.12);
      pointer-events: auto;
      transition: transform 200ms ease;
    }
    .play:hover, .play:focus-visible { transform: scale(1.05); }
    .play:focus-visible { outline: 3px solid var(--gsp-accent); outline-offset: 3px; }
    .play:disabled { cursor: wait; }
    .poster {
      position: absolute;
      z-index: 1;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: opacity 200ms ease;
    }
    .video-shell[data-video-active] .poster { opacity: 0; }
    .video-shade {
      position: absolute;
      z-index: 2;
      inset: 0;
      background: linear-gradient(to top, rgb(0 0 0 / 0.92), rgb(0 0 0 / 0.35) 42%, transparent 72%);
      pointer-events: none;
      transition: opacity 200ms ease-out;
    }
    .video-overlay {
      position: absolute;
      z-index: 3;
      right: 0;
      bottom: 0;
      left: 0;
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
      padding: 20px;
      color: #fff;
      pointer-events: none;
      transition: opacity 200ms ease-out;
    }
    @media (hover: hover) and (pointer: fine) {
      .video-shell[data-video-playing] .video-shade,
      .video-shell[data-video-playing] .video-overlay { opacity: 0; }
      .video-shell[data-video-playing]:hover .video-shade,
      .video-shell[data-video-playing]:hover .video-overlay,
      .video-shell[data-video-playing]:has(.play:focus-visible) .video-shade,
      .video-shell[data-video-playing]:has(.play:focus-visible) .video-overlay { opacity: 1; }
    }
    .video-overlay .stars { margin-top: 0; margin-bottom: 8px; }
    .video-name {
      display: block;
      overflow: hidden;
      color: #fff;
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.025em;
      line-height: 1.25;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .video-meta {
      display: block;
      overflow: hidden;
      margin-top: 2px;
      color: rgb(255 255 255 / 0.75);
      font-size: 14px;
      line-height: 1.4;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .play-icon {
      display: contents;
    }
    .play-icon svg { width: 20px; height: 20px; }
    .play-icon [data-gsp-play-icon] { margin-left: 2px; }
    .play-icon .hidden { display: none; }
    .identity { display: flex; min-width: 0; align-items: center; gap: 12px; }
    .avatar {
      display: grid;
      width: 44px;
      height: 44px;
      flex: 0 0 44px;
      place-items: center;
      overflow: hidden;
      border-radius: 999px;
      background: color-mix(in srgb, var(--gsp-accent) 12%, var(--gsp-surface));
      color: var(--gsp-text);
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
    }
    .avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .person { min-width: 0; }
    .name, .meta, .stars, blockquote { margin: 0; }
    .name {
      overflow: hidden;
      color: var(--gsp-text);
      font-family: inherit;
      font-size: 16px;
      font-weight: 600;
      line-height: 1.4;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta {
      overflow: hidden;
      margin-top: 2px;
      color: var(--gsp-muted);
      font-family: inherit;
      font-size: 14px;
      line-height: 1.4;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .stars { display: flex; gap: 4px; margin-top: 20px; color: var(--gsp-accent); }
    .star { width: 16px; height: 16px; }
    .star[data-filled="false"] { color: color-mix(in srgb, var(--gsp-muted) 25%, transparent); }
    blockquote {
      margin-top: 20px;
      color: var(--gsp-text);
      font-family: inherit;
      font-size: 15px;
      font-weight: 500;
      letter-spacing: -0.01em;
      line-height: 1.75;
    }
    @container (min-width: 42rem) { .grid { column-count: 2; } }
    @media (prefers-reduced-motion: reduce) {
      .play, .play-icon, .promo-cta, .video-shade, .video-overlay { transition: none; }
      .video-loader svg { animation: none; }
    }
  `;

  /** AA ink on a Brand accent; mirrors convex/domain/color-contrast. */
  function accentInk(hex) {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!match) return "#2e2a25";
    const channel = (offset) => {
      const value = parseInt(match[1].slice(offset, offset + 2), 16) / 255;
      return value <= 0.03928
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminance =
      0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
    const darkContrast = (luminance + 0.05) / (0.023703424946320904 + 0.05);
    const lightContrast = 1.05 / (luminance + 0.05);
    if (darkContrast >= 4.5) return "#2e2a25";
    if (lightContrast >= 4.5) return "#ffffff";
    return "#000000";
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  let muxPlayerPromise;
  let videoPlayerPolicyPromise;
  function loadMuxPlayer() {
    if (customElements.get("mux-player")) return Promise.resolve();
    if (!muxPlayerPromise) {
      muxPlayerPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = new URL("/embed/mux-player.js", apiOrigin).toString();
        script.onload = () =>
          customElements.whenDefined("mux-player").then(resolve);
        script.onerror = () => reject(new Error("PLAYER_UNAVAILABLE"));
        document.head.append(script);
      });
    }
    return muxPlayerPromise;
  }

  function loadVideoPlayerPolicy() {
    if (window.__GSP_VIDEO_PLAYER_POLICY__) {
      return Promise.resolve(window.__GSP_VIDEO_PLAYER_POLICY__);
    }
    if (!videoPlayerPolicyPromise) {
      videoPlayerPolicyPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = new URL(
          "/embed/video-player-policy.js",
          apiOrigin,
        ).toString();
        script.onload = () => {
          if (!window.__GSP_VIDEO_PLAYER_POLICY__) {
            reject(new Error("PLAYER_POLICY_UNAVAILABLE"));
            return;
          }
          resolve(window.__GSP_VIDEO_PLAYER_POLICY__);
        };
        script.onerror = () => reject(new Error("PLAYER_POLICY_UNAVAILABLE"));
        document.head.append(script);
      });
    }
    return videoPlayerPolicyPromise;
  }

  function hydrateVideo(card, testimonial, brand) {
    const shell = card.querySelector(".video-shell");
    const button = card.querySelector("[data-gsp-play]");
    const poster = card.querySelector(".poster");
    if (!shell || !button || !poster) throw new Error("INVALID_CARD_HTML");
    let playerPromise;
    const setPlaying = (playing) => {
      shell.toggleAttribute("data-video-playing", playing);
      button.toggleAttribute("data-playing", playing);
      button.setAttribute(
        "aria-label",
        playing ? button.dataset.pauseLabel : button.dataset.playLabel,
      );
      button
        .querySelector("[data-gsp-play-icon]")
        ?.classList.toggle("hidden", playing);
      button
        .querySelector("[data-gsp-pause-icon]")
        ?.classList.toggle("hidden", !playing);
    };
    const restorePlayButton = () => {
      setPlaying(false);
      delete shell.dataset.videoActive;
      delete shell.dataset.loading;
      button.removeAttribute("aria-busy");
      button.disabled = false;
      shell
        .querySelector("[data-gsp-video-loader]")
        ?.setAttribute("aria-hidden", "true");
      shell.querySelector("mux-player")?.setAttribute("inert", "");
    };
    const preparePlayer = () => {
      if (!playerPromise) {
        playerPromise = Promise.all([loadMuxPlayer(), loadVideoPlayerPolicy()])
          .then(([, videoPlayerPolicy]) => {
            const player = element("mux-player");
            player.className = "player-layer";
            player.setAttribute("inert", "");
            player.setAttribute("accent-color", brand.accentColor);
            if (videoPlayerPolicy.disableCookies) {
              player.setAttribute("disable-cookies", "");
            }
            player.setAttribute("metadata-video-id", testimonial.id);
            player.setAttribute(
              "metadata-video-title",
              `${testimonial.name}${videoPlayerPolicy.metadataTitleSuffix}`,
            );
            player.setAttribute("playback-id", testimonial.playbackId);
            player.setAttribute("prefer-playback", "mse");
            player.setAttribute("stream-type", "on-demand");
            if (videoPlayerPolicy.playsInline) {
              player.setAttribute("playsinline", "");
            }
            player.setAttribute("poster", poster.src);
            player.setAttribute("preload", videoPlayerPolicy.preload);
            if (videoPlayerPolicy.autoplay) {
              player.setAttribute("autoplay", "");
            }
            if (videoPlayerPolicy.hideCaptions) {
              player.setAttribute("default-hidden-captions", "");
            }
            player.addEventListener("playing", () => {
              setPlaying(true);
              delete shell.dataset.loading;
              button.removeAttribute("aria-busy");
              button.disabled = false;
              shell
                .querySelector("[data-gsp-video-loader]")
                ?.setAttribute("aria-hidden", "true");
            });
            const handlePaused = () => {
              setPlaying(false);
              delete shell.dataset.loading;
              button.removeAttribute("aria-busy");
              button.disabled = false;
              shell
                .querySelector("[data-gsp-video-loader]")
                ?.setAttribute("aria-hidden", "true");
            };
            player.addEventListener("pause", handlePaused);
            player.addEventListener("ended", handlePaused);
            player.addEventListener("waiting", () => {
              shell.dataset.loading = "true";
              shell
                .querySelector("[data-gsp-video-loader]")
                ?.removeAttribute("aria-hidden");
            });
            player.addEventListener("error", restorePlayButton);
            shell.prepend(player);
            return player;
          })
          .catch((error) => {
            playerPromise = undefined;
            restorePlayButton();
            throw error;
          });
      }
      return playerPromise;
    };

    const prepareAfterIntent = () => {
      void preparePlayer().catch(() => undefined);
    };
    shell.addEventListener("pointerenter", prepareAfterIntent);
    button.addEventListener("focus", prepareAfterIntent);
    shell.addEventListener("touchstart", prepareAfterIntent, {
      passive: true,
    });
    shell.addEventListener("click", () => {
      const currentPlayer = shell.querySelector("mux-player");
      if (button.hasAttribute("data-playing") && currentPlayer) {
        currentPlayer.pause();
        return;
      }
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      shell.dataset.videoActive = "true";
      shell.dataset.loading = "true";
      shell
        .querySelector("[data-gsp-video-loader]")
        ?.removeAttribute("aria-hidden");
      void preparePlayer()
        .then((player) => {
          return player.play();
        })
        .catch(restorePlayButton);
    });
  }

  function renderCard(testimonial, brand) {
    if (typeof testimonial.html !== "string") {
      throw new Error("INVALID_CARD_HTML");
    }
    const template = element("template");
    template.innerHTML = testimonial.html;
    const card = template.content.querySelector("[data-gsp-card]");
    if (!card || !card.classList.contains("card")) {
      throw new Error("INVALID_CARD_HTML");
    }
    if (testimonial.type === "video") hydrateVideo(card, testimonial, brand);
    return card;
  }

  function renderPromotionCard() {
    const card = element("aside", "card promo-card");
    card.dataset.gspPromotion = "";
    card.setAttribute("aria-label", "Get Some Proof");
    const title = element("h2", "promo-title", "Testimonials made easy");
    const copy = element(
      "p",
      "promo-copy",
      "Collect text and video testimonials. Share them everywhere! Free, forever.",
    );
    const link = element("a", "promo-cta", "Sign up for free");
    const href = new URL("/sign-up", apiOrigin);
    href.searchParams.set("utm_source", "embedded_wall");
    href.searchParams.set("utm_medium", "referral");
    href.searchParams.set("utm_campaign", "powered_by");
    link.href = href.toString();
    link.rel = "sponsored nofollow";
    card.append(title, copy, link);
    return card;
  }

  function setState(host, state) {
    host.dataset.gspState = state;
    host.style.setProperty(
      "display",
      state === "ready" ? "block" : "none",
      "important",
    );
    host.style.setProperty("width", "100%", "important");
  }

  function reportError(host, code) {
    setState(host, "error");
    host.dispatchEvent(
      new CustomEvent("gsp:error", {
        bubbles: true,
        composed: true,
        detail: { code },
      }),
    );
    console.error(`[Get Some Proof embed] ${code}`);
  }

  async function fetchProjection(publicSlug) {
    const testimonials = [];
    const seenCursors = new Set();
    let brand = null;
    let cursor = null;
    do {
      const url = new URL(
        `/api/public-wall/${encodeURIComponent(publicSlug)}`,
        apiOrigin,
      );
      if (cursor) url.searchParams.set("cursor", cursor);
      const response = await fetch(url, {
        credentials: "omit",
        headers: { Accept: "application/json" },
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) {
        const error = new Error(`HTTP_${response.status}`);
        error.code = `HTTP_${response.status}`;
        throw error;
      }
      const payload = await response.json();
      if (
        payload.schemaVersion !== 1 ||
        !payload.brand ||
        !Array.isArray(payload.testimonials)
      ) {
        const error = new Error("INVALID_RESPONSE");
        error.code = "INVALID_RESPONSE";
        throw error;
      }
      brand ||= payload.brand;
      testimonials.push(...payload.testimonials);
      cursor = payload.pagination?.cursor || null;
      if (cursor && seenCursors.has(cursor)) {
        const error = new Error("INVALID_PAGINATION");
        error.code = "INVALID_PAGINATION";
        throw error;
      }
      if (cursor) seenCursors.add(cursor);
    } while (cursor);
    return { brand, testimonials };
  }

  async function mount(host) {
    if (mounted.has(host)) return;
    mounted.add(host);
    setState(host, "loading");
    const publicSlug = host.dataset.publicSlug?.trim().toLowerCase();
    if (!publicSlug) {
      reportError(host, "MISSING_PUBLIC_SLUG");
      return;
    }
    const shadow = host.attachShadow({ mode: "open" });
    const style = element("style", "", styles);
    const wall = element("section", "wall");
    wall.setAttribute("aria-label", "Customer testimonials");
    const grid = element("div", "grid");
    wall.append(grid);
    shadow.append(style, wall);
    try {
      const projection = await fetchProjection(publicSlug);
      if (projection.testimonials.length === 0) {
        setState(host, "empty");
        return;
      }
      host.style.setProperty("--gsp-accent", projection.brand.accentColor);
      host.style.setProperty(
        "--gsp-accent-ink",
        projection.brand.accentInk || accentInk(projection.brand.accentColor),
      );
      host.dataset.theme = projection.brand.theme;
      host.dataset.transparentEmbed = String(
        projection.brand.transparentEmbed === true,
      );
      const cards = projection.testimonials.map((testimonial) =>
        renderCard(testimonial, projection.brand),
      );
      if (projection.brand.attributionRequired === true) {
        cards.splice(1, 0, renderPromotionCard());
      }
      grid.replaceChildren(...cards);
      wall.setAttribute("aria-label", `${projection.brand.name} testimonials`);
      setState(host, "ready");
    } catch (error) {
      reportError(host, error?.code || "NETWORK_ERROR");
    }
  }

  function mountAll() {
    document.querySelectorAll(selector).forEach((host) => void mount(host));
  }

  window[runtimeKey] = Object.freeze({ mountAll });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAll, { once: true });
  } else {
    mountAll();
  }
})();
