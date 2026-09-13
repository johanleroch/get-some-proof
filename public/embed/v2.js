(() => {
  "use strict";

  const runtimeKey = "__getSomeProofEmbedV2";
  const selector = "[data-gsp-wall][data-public-slug], [data-gsp-widget]";
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
    .content { padding: 24px; }
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
      /* The panel flips between ink and paper per theme; the promo text token
         flips with it, so the ring keeps its contrast (WCAG 2.2 SC 1.4.11). */
      outline: 3px solid var(--gsp-promo-text);
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
    .video-loader svg { width: 48px; height: 48px; }
    .video-shell[data-loading="true"] .video-loader { display: grid; }
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
      padding: 24px;
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
    /* On the shade, the stars sit right above the signature row, which mirrors the text card: mark, name, role. */
    .video-overlay .stars { margin-bottom: 12px; }
    .video-identity { display: flex; min-width: 0; align-items: center; gap: 12px; }
    .video-name {
      display: block;
      overflow: hidden;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.008em;
      line-height: 20px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .video-meta {
      display: block;
      overflow: hidden;
      color: rgb(255 255 255 / 0.75);
      font-size: 13px;
      letter-spacing: -0.004em;
      line-height: 18px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .play-icon {
      display: contents;
    }
    .play-icon svg { width: 20px; height: 20px; }
    .play-icon [data-gsp-play-icon] { margin-left: 2px; }
    .play-icon .hidden { display: none; }
    .content > .stars { margin-bottom: 16px; }
    .identity { display: flex; align-items: center; gap: 12px; margin-top: 20px; }
    .quote-mark {
      display: block;
      flex: 0 0 auto;
      color: var(--gsp-accent);
      font-family: inherit;
      font-size: 48px;
      font-weight: 700;
      line-height: 0;
      transform: translateY(0.18em);
      user-select: none;
    }
    .avatar {
      display: grid;
      width: 32px;
      height: 32px;
      flex: 0 0 32px;
      place-items: center;
      overflow: hidden;
      border-radius: 999px;
      background: color-mix(in srgb, var(--gsp-accent) 12%, var(--gsp-surface));
      color: var(--gsp-text);
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
    }
    .avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .person { min-width: 0; flex: 1; }
    .name, .meta, .stars, blockquote { margin: 0; }
    .name {
      overflow: hidden;
      color: var(--gsp-text);
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      line-height: 20px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta {
      overflow: hidden;
      margin-top: 1px;
      color: var(--gsp-muted);
      font-family: inherit;
      font-size: 13px;
      line-height: 1.4;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .stars { display: flex; flex-shrink: 0; gap: 4px; color: var(--gsp-accent); }
    .star { width: 14px; height: 14px; }
    .star[data-filled="true"] { fill: currentColor; }
    .star[data-filled="false"] { color: color-mix(in srgb, var(--gsp-muted) 25%, transparent); }
    /* Mirrors the quote type style in globals.css; keep the four in step. */
    blockquote {
      color: var(--gsp-text);
      font-family: inherit;
      font-size: 17px;
      font-weight: 400;
      letter-spacing: -0.011em;
      line-height: 26px;
      text-wrap: pretty;
    }
    @container (min-width: 42rem) { .grid { column-count: 2; } }
    @media (prefers-reduced-motion: reduce) {
      .play, .play-icon, .promo-cta, .video-shade, .video-overlay { transition: none; }
      .video-loader svg { animation: none; }
    }
  `;

  /** AA ink on a Brand accent; mirrors convex/domain/colorContrast. */
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

  const widgetStyles = `
    .widget { color:var(--gsp-text); padding:20px; }
    .widget h2 { font-family:inherit; color:inherit; margin:0 0 24px; font-size:28px; line-height:1.2; }
    .widget .grid { column-count:1; }
    .widget[data-layout="wall"] .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr)); gap:20px; }
    .widget[data-layout="wall"] .card { margin:0; height:100%; }
    .widget[data-layout="individual"] .grid { max-width:520px; margin:auto; }
    .widget[data-layout="carousel"] .grid { display:flex; overflow-x:auto; gap:20px; scroll-snap-type:x mandatory; overscroll-behavior-inline:contain; padding-bottom:8px; }
    .widget[data-layout="carousel"] .grid > .card { flex:0 0 min(100%,340px); scroll-snap-align:start; margin:0; align-self:flex-start; }
    .widget[data-layout="highlights"] .grid { display:grid; gap:20px; }
    .widget[data-layout="highlights"] .card { border:0; margin:0; }
    .widget[data-layout="highlights"] .quote { font-size:24px; }
    .widget .controls { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }
    .widget button { min-width:44px; min-height:44px; padding:8px 12px; background:var(--gsp-surface); color:var(--gsp-text); border:1px solid var(--gsp-border); border-radius:8px; font:inherit; cursor:pointer; }
    .widget button:disabled { opacity:.4; cursor:default; }
    .widget button:focus-visible,.widget a:focus-visible { outline:3px solid var(--gsp-accent); outline-offset:3px; }
    .faces { display:flex; flex-wrap:wrap; padding-left:10px; align-items:center; }
    .face { margin-left:-10px; border:3px solid var(--gsp-surface); width:52px; height:52px; border-radius:50%; display:grid; place-items:center; background:var(--gsp-border); color:var(--gsp-text); overflow:hidden; }
    .face img { width:100%; height:100%; object-fit:cover; }
    .widget .avatar-copy { margin:12px 0 0; }
    .widget > .promo-card { display:block; max-width:340px; margin:24px 0 0; }
    .widget[data-layout="masonry"] .grid { display:flex; align-items:flex-start; gap:20px; column-count:auto; }
    .widget[data-layout="masonry"] .grid > .column { flex:1 1 0; min-width:0; display:flex; flex-direction:column; gap:20px; }
    .widget[data-layout="masonry"] .card { margin:0; }
    @container (min-width:576px) { .widget[data-layout="highlights"] .grid {grid-template-columns:repeat(2,1fr);} }
  `;

  /**
   * Masonry that answers the content: every card goes to whichever column is
   * shortest when it is placed, so a tall card never drags its neighbours down
   * and no column is left with a hole under it. CSS `column-count` cannot do
   * this — it pours each column full in document order, which put the first
   * and third testimonials in one column under a tall card and left the second
   * alone beside them.
   *
   * The cards are measured once, all inside the first column, which already
   * has its final width because the columns share the row equally whatever
   * they hold.
   */
  function balanceMasonry(grid, cards) {
    const width = grid.clientWidth;
    const count = width >= 850 ? 3 : width >= 576 ? 2 : 1;
    const columns = [];
    for (let index = 0; index < count; index += 1)
      columns.push(element("div", "column"));
    grid.replaceChildren(...columns);
    columns[0].append(...cards);
    const heights = cards.map((card) => card.getBoundingClientRect().height);
    const filled = new Array(count).fill(0);
    cards.forEach((card, index) => {
      let target = 0;
      for (let column = 1; column < count; column += 1)
        if (filled[column] < filled[target] - 0.5) target = column;
      columns[target].append(card);
      filled[target] += heights[index] + 20;
    });
  }

  const widgetCleanups = new WeakMap();
  const widgetFontRequests = new WeakMap();
  const widgetFontLoads = new Map();
  function renderWidget(host, payload) {
    widgetCleanups.get(host)?.();
    host.querySelectorAll?.("mux-player").forEach((player) => player.pause?.());
    const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    shadow.querySelectorAll("mux-player").forEach((player) => player.pause?.());
    const config = payload.config;
    host.style.setProperty("--gsp-accent", config.accentColor);
    host.style.setProperty("--gsp-accent-ink", payload.brand.accentInk);
    host.style.setProperty("--gsp-surface", config.backgroundColor);
    host.style.setProperty("--gsp-text", config.textColor);
    host.style.setProperty("--gsp-muted", config.textColor);
    const fonts = {
      inherit: "inherit",
      sans: "Arial, sans-serif",
      serif: "Georgia, serif",
      mono: "monospace",
    };
    host.style.fontFamily = fonts[config.font] || "inherit";
    const fontRequest = {};
    widgetFontRequests.set(host, fontRequest);
    const customFont = payload.customFont;
    if (
      customFont &&
      /^[a-zA-Z0-9_-]+$/.test(customFont.id) &&
      typeof FontFace !== "undefined"
    ) {
      try {
        const fontUrl = new URL(customFont.url);
        if (
          fontUrl.protocol === "https:" ||
          fontUrl.origin === location.origin
        ) {
          const family = `gsp-custom-${customFont.id}`;
          let loading = widgetFontLoads.get(family);
          if (!loading) {
            const face = new FontFace(
              family,
              `url(${JSON.stringify(fontUrl.href)})`,
              { display: "swap" },
            );
            loading = face.load().then((loaded) => {
              document.fonts.add(loaded);
              return loaded;
            });
            widgetFontLoads.set(family, loading);
            loading.catch(() => widgetFontLoads.delete(family));
          }
          void loading
            .then(() => {
              if (widgetFontRequests.get(host) !== fontRequest) return;
              host.style.fontFamily = `"${family}", ${fonts[config.font] === "inherit" ? "sans-serif" : fonts[config.font] || "sans-serif"}`;
            })
            .catch(() => {});
        }
      } catch {
        /* Keep the selected fallback when a font is unavailable. */
      }
    }

    if (
      !customFont &&
      typeof payload.googleFont === "string" &&
      /^[\w -]{1,100}$/.test(payload.googleFont)
    ) {
      const family = payload.googleFont;
      const key = `google:${family}`;
      let loading = widgetFontLoads.get(key);
      if (!loading) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
        loading = new Promise((resolve, reject) => {
          link.onload = () => {
            document.fonts
              .load(`16px ${JSON.stringify(family)}`)
              .then(resolve, reject);
          };
          link.onerror = () => reject(new Error("Google font unavailable"));
          document.head.append(link);
        });
        widgetFontLoads.set(key, loading);
        loading.catch(() => {
          widgetFontLoads.delete(key);
          link.remove();
        });
      }
      void loading
        .then(() => {
          if (widgetFontRequests.get(host) !== fontRequest) return;
          host.style.fontFamily = `${JSON.stringify(family)}, ${fonts[config.font] === "inherit" ? "sans-serif" : fonts[config.font] || "sans-serif"}`;
        })
        .catch(() => {});
    }
    const wall = element("section", "wall widget");
    wall.dataset.layout = config.layout;
    wall.setAttribute("aria-label", `${payload.brand.name} testimonials`);
    if (config.layout === "wall")
      wall.append(element("h2", "", payload.brand.name));
    const grid = element("div", "grid");
    let masonryCards = null;
    if (!payload.testimonials.length) {
      grid.append(element("p", "", "No testimonials to display yet."));
    } else if (config.layout === "avatars") {
      const faces = element("div", "faces");
      payload.testimonials.forEach((testimonial) => {
        if (testimonial.avatarVisible === false) return;
        const face = element("span", "face");
        face.setAttribute("title", testimonial.name);
        face.setAttribute("aria-label", testimonial.name);
        if (testimonial.avatarUrl) {
          const img = element("img");
          img.src = testimonial.avatarUrl;
          img.alt = "";
          img.loading = "lazy";
          face.append(img);
        } else
          face.textContent = testimonial.name
            .split(/\s+/)
            .map((part) => part[0])
            .slice(0, 2)
            .join("");
        faces.append(face);
      });
      grid.append(
        faces,
        element(
          "p",
          "avatar-copy",
          `${payload.testimonials.length} customer testimonials`,
        ),
      );
    } else {
      const cards = payload.testimonials.map((testimonial) =>
        renderCard(testimonial, payload.brand),
      );
      if (config.layout === "masonry") masonryCards = cards;
      grid.append(...cards);
    }
    wall.append(grid);
    if (config.layout === "carousel" && payload.testimonials.length > 1) {
      const controls = element("div", "controls");
      const previous = element("button", "", "←");
      previous.setAttribute("aria-label", "Previous testimonials");
      const next = element("button", "", "→");
      next.setAttribute("aria-label", "Next testimonials");
      const sync = () => {
        previous.disabled = grid.scrollLeft < 2;
        next.disabled =
          grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 2;
      };
      const move = (direction) => {
        shadow
          .querySelectorAll("mux-player")
          .forEach((player) => player.pause?.());
        grid.scrollBy({
          left:
            direction *
            (grid.firstElementChild?.getBoundingClientRect().width + 20 ||
              grid.clientWidth),
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        });
      };
      previous.onclick = () => move(-1);
      next.onclick = () => move(1);
      grid.tabIndex = 0;
      grid.setAttribute(
        "aria-label",
        "Swipe or use arrow keys to browse testimonials",
      );
      grid.addEventListener("keydown", (event) => {
        if (event.target !== grid) return;
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          move(event.key === "ArrowRight" ? 1 : -1);
        }
      });
      grid.addEventListener(
        "scroll",
        () => {
          shadow
            .querySelectorAll("mux-player")
            .forEach((player) => player.pause?.());
          sync();
        },
        { passive: true },
      );
      const resize = new ResizeObserver(sync);
      resize.observe(grid);
      widgetCleanups.set(host, () => resize.disconnect());
      controls.append(previous, next);
      wall.append(controls);
      requestAnimationFrame(sync);
    }
    if (payload.brand.attributionRequired && payload.testimonials.length)
      wall.append(renderPromotionCard());
    shadow.replaceChildren(element("style", "", styles + widgetStyles), wall);
    if (masonryCards) {
      const cards = masonryCards;
      // Balancing moves cards between columns, which changes the grid's own
      // height, which wakes the observer watching it: only a change of WIDTH
      // may trigger a rebalance, or the two feed each other forever. Chromium
      // breaks that loop after a pass; Firefox keeps running it and starves
      // the frames the page needs to paint.
      let lastWidth = -1;
      const rebalance = (force) => {
        const width = grid.clientWidth;
        if (!force && width === lastWidth) return;
        lastWidth = width;
        balanceMasonry(grid, cards);
      };
      rebalance(true);
      const resize = new ResizeObserver(() => rebalance(false));
      resize.observe(grid);
      // A card grows when its image or video finishes loading, and those
      // arrive in bursts: one rebalance per frame is enough.
      let pending = 0;
      const onLoad = () => {
        if (pending) return;
        pending = requestAnimationFrame(() => {
          pending = 0;
          rebalance(true);
        });
      };
      grid.addEventListener("load", onLoad, { capture: true });
      widgetCleanups.set(host, () => {
        resize.disconnect();
        if (pending) cancelAnimationFrame(pending);
        grid.removeEventListener("load", onLoad, { capture: true });
      });
    }
    setState(host, "ready");
  }

  const widgetRequests = new Map();
  function fetchWidget(id) {
    if (!widgetRequests.has(id)) {
      const promise = fetch(
        new URL(`/api/widgets/${encodeURIComponent(id)}`, apiOrigin),
        {
          credentials: "omit",
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
          referrerPolicy: "no-referrer",
        },
      ).then(async (response) => {
        if (!response.ok) throw new Error("WIDGET_UNAVAILABLE");
        const payload = await response.json();
        if (
          payload.schemaVersion !== 1 ||
          !payload.config ||
          !Array.isArray(payload.testimonials)
        )
          throw new Error("INVALID_WIDGET");
        return payload;
      });
      widgetRequests.set(id, promise);
      setTimeout(() => widgetRequests.delete(id), 1000);
    }
    return widgetRequests.get(id);
  }
  async function mountWidget(host) {
    host.dataset.gspState = "loading";
    const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    shadow.replaceChildren(element("p", "", "Loading testimonials…"));
    try {
      renderWidget(host, await fetchWidget(host.dataset.gspWidget));
      // Fail closed when an open page exceeds the existing privacy freshness bound.
      // A visitor may explicitly reload; no polling loop or stale-on-error fallback.
      setTimeout(() => {
        shadow
          .querySelectorAll("mux-player")
          .forEach((player) => player.pause?.());
        const reload = element("button", "", "Reload testimonials");
        reload.onclick = () => void mountWidget(host);
        shadow.replaceChildren(reload);
        host.dataset.gspState = "expired";
      }, 60000);
    } catch {
      shadow.replaceChildren(
        element("p", "", "Testimonials are currently unavailable."),
      );
      host.dataset.gspState = "error";
    }
  }
  const widgetObserver =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                widgetObserver.unobserve(entry.target);
                void mountWidget(entry.target);
              }
            });
          },
          { rootMargin: "200px" },
        )
      : null;
  function observeWidget(host) {
    if (mounted.has(host)) return;
    mounted.add(host);
    if (widgetObserver) widgetObserver.observe(host);
    else void mountWidget(host);
  }

  function mountAll() {
    document.querySelectorAll(selector).forEach((host) => {
      if (host.hasAttribute("data-gsp-widget")) observeWidget(host);
      else void mount(host);
    });
  }

  window[runtimeKey] = Object.freeze({ mountAll, renderWidget });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAll, { once: true });
  } else {
    mountAll();
  }
})();
