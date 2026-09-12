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
      container-type: inline-size;
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
    .video-overlay > span { min-width: 0; }
    /* The white chip behind a brand mark earns its place over a video poster
       and nowhere else; on paper it reads as a sticker. */
    .card:not(.video-card) [data-gsp-source] svg { background: none !important; padding: 0 !important; }
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
    /* The shell is its own container, so a video card that narrowed to keep
       its shape tightens its overlay instead of crushing it. Placed last:
       these match the base rules' specificity and win on order alone. */
    @container (max-width: 300px) {
      .video-overlay { gap: 10px; padding: 14px; }
      .video-overlay .stars { margin-bottom: 8px; }
      .star { width: 12px; height: 12px; }
      .play { width: 40px; height: 40px; flex-basis: 40px; }
      .play-icon svg { width: 17px; height: 17px; }
    }
    @container (max-width: 220px) {
      .video-overlay { gap: 8px; padding: 12px; }
      .video-overlay .quote-mark { display: none; }
      .video-meta { display: none; }
      .play { width: 36px; height: 36px; flex-basis: 36px; }
      .play-icon svg { width: 15px; height: 15px; }
    }
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
    .widget[data-layout="carousel"] .grid > .card { flex:0 0 min(100%,340px); scroll-snap-align:start; margin:0; }
    .widget[data-layout="carousel"] .content { display:flex; height:100%; flex-direction:column; }
    .widget[data-layout="carousel"] .identity { margin-top:auto; }
    .widget[data-layout="carousel"] .card.video-card { align-self:center; }
    .widget[data-layout="highlights"] .grid { display:grid; gap:20px; }
    .widget[data-layout="highlights"] .card { border:0; margin:0; }
    .widget[data-layout="highlights"] .quote { font-size:24px; }
    .widget .controls { display:flex; justify-content:flex-end; gap:8px; margin-top:16px; }
    .widget button { min-width:44px; min-height:44px; padding:8px 12px; background:var(--gsp-surface); color:var(--gsp-text); border:1px solid var(--gsp-border); border-radius:8px; font:inherit; cursor:pointer; }
    .widget button:disabled { opacity:.4; cursor:default; }
    .widget button:focus-visible,.widget a:focus-visible { outline:3px solid var(--gsp-accent); outline-offset:3px; }
    .faces { display:flex; flex-wrap:wrap; padding-left:10px; align-items:center; }
    .face { position:relative; margin-left:-10px; border:3px solid var(--gsp-surface); width:52px; height:52px; border-radius:50%; display:grid; place-items:center; background:var(--gsp-border); color:var(--gsp-text); overflow:hidden; transition:transform 200ms cubic-bezier(0.22,1,0.36,1), margin-left 200ms cubic-bezier(0.22,1,0.36,1); }
    .face img { width:100%; height:100%; object-fit:cover; }
    /* The row opens as the cursor arrives, and the face under it steps out
       in front of its neighbours. */
    .faces:hover .face { margin-left:-4px; }
    .face:hover { z-index:1; transform:translateY(-4px) scale(1.06); }
    .face.more { background:color-mix(in srgb, var(--gsp-text) 8%, var(--gsp-surface)); color:var(--gsp-muted); font-size:13px; font-weight:600; }
    .widget .avatar-copy { margin:16px 0 0; color:var(--gsp-muted); font-size:15px; }
    .avatar-names { color:var(--gsp-text); font-weight:600; }
    .widget > .promo-card { display:block; max-width:340px; margin:24px 0 0; }
    @container (min-width:576px) { .widget[data-layout="masonry"] .grid {column-count:2;} .widget[data-layout="highlights"] .grid {grid-template-columns:repeat(2,1fr);} }
    @container (min-width:850px) { .widget[data-layout="masonry"] .grid {column-count:3;} }
  `;

  /**
   * The widget families beyond the first five, plus the "drawn" hand that can
   * be turned on for any of them. Layout and hand are orthogonal: a layout
   * never styles itself as drawn, it reads the shared `[data-hand="drawn"]`
   * layer below, so a new layout inherits the hand for free.
   */
  const widgetFamilyStyles = `
    /* --- A. Section blocks ------------------------------------------ */

    /* Editorial: one narrow column, rules instead of cards, so the quote
       reads like a pull quote in an article rather than a tile. */
    .widget[data-layout="editorial"] .grid { display:block; column-count:1; max-width:640px; margin-inline:auto; }
    .widget[data-layout="editorial"] .card { display:block; margin:0; padding:32px 0; overflow:visible; border:0; border-top:1px solid var(--gsp-border); border-radius:0; background:transparent; }
    .widget[data-layout="editorial"] .card:first-child { padding-top:0; border-top:0; }
    .widget[data-layout="editorial"] .content { padding:0; }
    .widget[data-layout="editorial"] .quote { font-size:20px; line-height:32px; }
    .widget[data-layout="editorial"] .identity { margin-top:24px; }
    .widget[data-layout="editorial"] .video-shell { border-radius:12px; }

    /* Mosaic: a dense grid where a marked card takes two columns and video
       takes two rows, so the block never falls into three equal tiles. */
    .widget[data-layout="mosaic"] .grid { display:grid; grid-auto-flow:dense; grid-template-columns:1fr; gap:16px; }
    .widget[data-layout="mosaic"] .card { margin:0; height:100%; }

    /* Video gallery: posters first, every tile the same shape. */
    .widget[data-layout="videos"] .grid { display:flex; flex-wrap:wrap; gap:12px; column-count:1; }
    .widget[data-layout="videos"] .card { flex:0 0 auto; margin:0; }

    /* --- B. Supporting proof ---------------------------------------- */

    .widget[data-layout="rating"], .widget[data-layout="metric"] { padding:0; }
    .widget[data-layout="rating"] .grid, .widget[data-layout="metric"] .grid { display:block; column-count:1; }
    .badge {
      display:inline-flex; align-items:center; gap:16px;
      padding:16px 20px;
      border:1px solid var(--gsp-border); border-radius:12px;
      background:var(--gsp-surface); color:var(--gsp-text);
    }
    .badge-score { position:relative; font-size:40px; font-weight:700; line-height:1; letter-spacing:-0.02em; }
    .badge-body { display:flex; flex-direction:column; gap:6px; min-width:0; }
    .badge-stars { display:flex; gap:4px; color:var(--gsp-accent); }
    .badge-stars svg { width:18px; height:18px; }
    .badge-copy { margin:0; color:var(--gsp-muted); font-size:14px; line-height:1.4; }

    .metric-block { display:inline-flex; flex-direction:column; gap:18px; text-align:left; }
    .metric { display:flex; align-items:baseline; gap:16px; }
    .metric-value { position:relative; font-size:64px; font-weight:700; line-height:1; letter-spacing:-0.03em; color:var(--gsp-text); }
    .metric-copy { margin:0; max-width:22ch; color:var(--gsp-muted); font-size:16px; line-height:1.45; }
    .metric-foot { display:flex; align-items:center; gap:24px; flex-wrap:wrap; }
    .metric-foot .faces { padding-left:8px; }
    .metric-foot .face { width:34px; height:34px; margin-left:-8px; border-width:2px; font-size:12px; }
    .metric-foot .face.more { background:color-mix(in srgb, var(--gsp-text) 8%, var(--gsp-surface)); color:var(--gsp-muted); font-size:12px; font-weight:600; letter-spacing:-0.01em; }
    .metric-score { display:flex; align-items:center; gap:8px; }
    .metric-score .badge-stars svg { width:15px; height:15px; }
    .metric-average { color:var(--gsp-text); font-size:15px; font-weight:600; }

    /* --- C. Proof that moves ---------------------------------------- */

    /* Marquee: one continuous row. The track is duplicated so the loop has
       no seam; the copy is inert so a clone can never swallow a click. */
    .widget[data-layout="marquee"] { padding-inline:0; }
    .widget[data-layout="marquee"] .track { overflow:hidden; -webkit-mask-image:linear-gradient(to right,transparent,#000 64px,#000 calc(100% - 64px),transparent); mask-image:linear-gradient(to right,transparent,#000 64px,#000 calc(100% - 64px),transparent); }
    .widget[data-layout="marquee"] .grid { display:flex; width:max-content; gap:16px; column-count:1; animation:gsp-marquee 64s linear infinite; }
    .widget[data-layout="marquee"] .card { flex:0 0 340px; height:200px; margin:0; align-self:flex-start; }
    .widget[data-layout="marquee"] .content { display:flex; height:100%; flex-direction:column; padding:20px; }
    .widget[data-layout="marquee"] .content > .stars { margin-bottom:12px; }
    .widget[data-layout="marquee"] .quote { display:-webkit-box; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:4; font-size:15px; line-height:23px; }
    .widget[data-layout="marquee"] .identity { margin-top:auto; padding-top:12px; }
    .widget[data-layout="marquee"] .testimonial-images { display:none !important; }

    .widget[data-layout="marquee"] .track:hover .grid, .widget[data-layout="marquee"] .track:focus-within .grid { animation-play-state:paused; }
    .widget[data-layout="marquee"] .grid > [aria-hidden="true"] { pointer-events:none; }
    @keyframes gsp-marquee { from { transform:translateX(0); } to { transform:translateX(-50%); } }

    /* Spotlight: the cards are stacked in one grid cell and cross-fade, so
       the block keeps the height of the tallest and never jumps. */
    /* Shared by spotlight and bubble: every card in one cell, one visible. */
    .grid.stack { display:grid; column-count:1; transition:height 320ms cubic-bezier(0.22,1,0.36,1); }
    .grid.stack > .card { grid-area:1 / 1; align-self:start; margin:0; opacity:0; visibility:hidden; transition:opacity 400ms ease; }
    .grid.stack > .card[data-active="true"] { opacity:1; visibility:visible; }
    .widget[data-layout="spotlight"] .grid { max-width:560px; margin-inline:auto; }
    .widget[data-layout="spotlight"] .dots { display:flex; justify-content:center; gap:8px; margin-top:16px; }
    .widget[data-layout="spotlight"] .dot { width:8px; height:8px; min-width:0; min-height:0; padding:0; border:0; border-radius:999px; background:var(--gsp-border); cursor:pointer; transition:background-color 200ms ease; }
    .widget[data-layout="spotlight"] .dot[aria-current="true"] { background:var(--gsp-accent); }

    /* Bubble: the corner of the client's page. Inline mode exists only so a
       review page can show it inside a frame instead of over the viewport. */
    .widget[data-layout="bubble"] { padding:0; }
    .widget[data-layout="bubble"] .bubble {
      position:fixed; z-index:2147483000; bottom:24px; left:24px;
      width:min(320px,calc(100vw - 48px));
      opacity:0; transform:translateY(12px) scale(0.98);
      transition:opacity 240ms ease, transform 240ms cubic-bezier(0.22,1,0.36,1);
    }
    .widget[data-layout="bubble"][data-inline="true"] .bubble { position:absolute; z-index:1; }
    .widget[data-layout="bubble"] .bubble[data-shown="true"] { opacity:1; transform:none; }
    .widget[data-layout="bubble"] .card { margin:0; box-shadow:0 1px 2px rgb(46 42 37 / 0.06), 0 12px 32px rgb(46 42 37 / 0.12); }
    .widget[data-layout="bubble"] .content { padding:20px; }
    .widget[data-layout="bubble"] .quote { display:-webkit-box; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:3; font-size:15px; line-height:23px; }
    .widget[data-layout="bubble"] .content > .stars { margin-bottom:12px; }
    .widget[data-layout="bubble"] .identity { margin-top:16px; }
    .widget[data-layout="bubble"] .testimonial-images { display:none !important; }
    .widget[data-layout="bubble"] .video-overlay { padding:16px; }
    .widget[data-layout="bubble"] .bubble-close {
      position:absolute; top:-10px; right:-10px; z-index:2;
      display:grid; width:28px; height:28px; min-width:0; min-height:0;
      place-items:center; padding:0;
      border:1px solid var(--gsp-border); border-radius:999px;
      background:var(--gsp-surface); color:var(--gsp-muted);
      font-size:15px; line-height:1; cursor:pointer;
    }
    .widget[data-layout="bubble"] .bubble-close:hover { color:var(--gsp-text); }

    /* --- D. Where the proof came from -------------------------------- */

    /* Social feed: the platform mark leads the card instead of trailing it,
       because on this layout the origin is the argument. */
    .widget[data-layout="social"] .grid { column-count:1; }
    .widget[data-layout="social"] .card { border-radius:12px; }
    .widget[data-layout="social"] .content { display:flex; flex-direction:column; padding:20px; }
    .widget[data-layout="social"] .identity { order:-1; margin:0 0 16px; }
    .widget[data-layout="social"] .content > .stars { order:1; margin:16px 0 0; }
    .widget[data-layout="social"] .quote { order:0; font-size:16px; line-height:25px; }
    .widget[data-layout="social"] .testimonial-images { order:2; }
    @container (min-width:576px) { .widget[data-layout="social"] .grid { column-count:2; } }
    @container (min-width:850px) { .widget[data-layout="social"] .grid { column-count:3; } }

    @container (min-width:576px) {
      .widget[data-layout="mosaic"] .grid { grid-template-columns:repeat(2,1fr); }
      .widget[data-layout="mosaic"] .card[data-span="wide"] { grid-column:span 2; }
      .widget[data-layout="mosaic"] .card.video-card { grid-row:span 2; }
    }
    @container (min-width:850px) {
      .widget[data-layout="mosaic"] .grid { grid-template-columns:repeat(3,1fr); }
    }


    @media (prefers-reduced-motion: reduce) {
      .widget[data-layout="marquee"] .grid { animation:none; }
      .widget[data-layout="marquee"] .track { overflow-x:auto; }
      .grid.stack > .card, .widget[data-layout="bubble"] .bubble, .widget[data-layout="spotlight"] .dot { transition:none; }
    }

    /* --- The drawn hand ---------------------------------------------- */
    /* One layer, every layout. Nothing here changes structure: corners stop
       being machined, rules become strokes, and the key figure gets circled.
       DESIGN.md section 4 - restraint is the rule, so this is the whole of it. */

    .widget[data-hand="drawn"] .card { border-radius:14px 10px 16px 11px; }
    .widget[data-hand="drawn"] .grid > .card:nth-child(2n) { border-radius:11px 15px 10px 14px; }
    .widget[data-hand="drawn"] .grid > .card:nth-child(3n) { border-radius:16px 12px 13px 10px; }
    .widget[data-hand="drawn"] .video-shell, .widget[data-hand="drawn"] .testimonial-images img { border-radius:12px 9px 13px 10px; }
    .widget[data-hand="drawn"] .quote-mark { font-size:52px; transform:translateY(0.2em) rotate(-4deg); }
    .widget[data-hand="drawn"] .avatar { border-radius:48% 52% 50% 47%; }
    .widget[data-hand="drawn"] .face { border-radius:49% 51% 48% 52%; }
    .widget[data-hand="drawn"] .badge { border-radius:16px 11px 15px 12px; }
    .widget[data-hand="drawn"] .badge-score, .widget[data-hand="drawn"] .metric-value { color:var(--gsp-text); }
    .widget[data-hand="drawn"] .ring { position:absolute; top:50%; left:50%; width:calc(100% + 34px); height:calc(100% + 22px); translate:-50% -50%; color:var(--gsp-accent); pointer-events:none; }
    .widget[data-hand="drawn"] .ring svg { display:block; width:100%; height:100%; overflow:visible; }
    /* Editorial swaps its machined rule for a drawn one. */
    .widget[data-hand="drawn"][data-layout="editorial"] .card { border-top:0; position:relative; }
    .widget[data-hand="drawn"][data-layout="editorial"] .card + .card::before {
      content:""; position:absolute; top:0; left:0; width:100%; height:9px;
      color:var(--gsp-border);
      background:no-repeat center/100% 9px url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 9' preserveAspectRatio='none'%3E%3Cpath d='M2 5.4C74 2.6 146 6.8 218 4.4c72-2.4 144 2.6 216 .6s108-3 164-1.2' fill='none' stroke='%23d8d0c2' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E");
    }
    .widget[data-hand="drawn"] .dot { border-radius:48% 52% 51% 49%; }
    .widget[data-hand="drawn"] .stars { gap:3px; }
    .widget[data-hand="drawn"] .star { rotate:-7deg; }
    .widget[data-hand="drawn"] .star:nth-child(2n) { rotate:5deg; translate:0 -1px; }
    .widget[data-hand="drawn"] .star:nth-child(3n) { rotate:-3deg; translate:0 1px; scale:1.08; }
    .widget[data-hand="drawn"] .star:nth-child(5n) { rotate:9deg; scale:0.94; }
    /* The families with no border to soften get the hand on the signature
       instead: a stroke under the name, drawn once and a bit past the end. */
    .widget[data-hand="drawn"][data-layout="hero"] .name,
    .widget[data-hand="drawn"][data-layout="editorial"] .name {
      display:inline-block;
      padding-bottom:5px;
      background:no-repeat left bottom/100% 6px url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 6' preserveAspectRatio='none'%3E%3Cpath d='M2 4.1C22 2.2 42 4.6 62 3.2c20-1.4 38 1.9 56 .4' fill='none' stroke='%23d8d0c2' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E");
    }

    /* --- E. The families the competition made us look at ------------- */

    /* Hero: one quote at the scale of a headline. At this size the marker
       swash is the design - the words the Owner marked carry the accent in a
       drawn stroke, where the competitor reaches for bold black. */
    .widget[data-layout="hero"] .grid { column-count:1; max-width:760px; margin-inline:auto; }
    .widget[data-layout="hero"] .card { margin:0; border:0; background:transparent; }
    .widget[data-layout="hero"] .content { padding:0; }
    .widget[data-layout="hero"] .content > .stars { margin-bottom:20px; }
    .widget[data-layout="hero"] .quote { font-size:clamp(26px,4.4cqi,42px); font-weight:600; letter-spacing:-0.02em; line-height:1.25; text-wrap:balance; }
    .widget[data-layout="hero"] .identity { gap:14px; }
    .widget[data-layout="hero"] [data-gsp-source] { width:32px !important; height:32px !important; }
    .widget[data-layout="hero"] .identity { margin-top:28px; }
    .widget[data-layout="hero"] .person { flex:0 1 auto; text-align:left; }
    .widget[data-layout="hero"] .quote-mark { display:none; }
    .widget[data-layout="hero"] .avatar { width:44px; height:44px; flex-basis:44px; }
    .widget[data-layout="hero"] .name { font-size:15px; }

    /* Band: the photo runs the full height on the left, the quote reads on
       the right. display:contents lifts the signature row out of its own
       box so the face can become a column of the card's grid. */
    .widget[data-layout="band"] .grid { display:grid; max-width:720px; margin-inline:auto; column-count:1; gap:16px; }
    .widget[data-layout="band"] .card { margin:0; }
    .widget[data-layout="band"] .content {
      display:grid; align-items:start; gap:4px 20px; padding:20px;
      grid-template-areas:"photo stars source" "photo quote quote" "photo person person";
      grid-template-columns:112px minmax(0,1fr) auto;
    }
    .widget[data-layout="band"] .identity { display:contents; }
    .widget[data-layout="band"] .avatar { width:112px; height:100%; flex-basis:auto; align-self:stretch; border-radius:12px; grid-area:photo; }
    /* Without a face there is no left column to fill, and an empty one reads
       as a missing image rather than as a choice. */
    .widget[data-layout="band"] .card[data-no-photo] .content { grid-template-areas:"stars source" "quote quote" "person person"; grid-template-columns:minmax(0,1fr) auto; }
    .widget[data-layout="band"] .card[data-no-photo] .quote-mark { display:none; }
    .widget[data-layout="band"] .quote-mark { align-self:center; justify-self:center; font-size:64px; grid-area:photo; }
    .widget[data-layout="band"] .content > .stars { margin:0 0 8px; grid-area:stars; }
    .widget[data-layout="band"] .quote { grid-area:quote; }
    .widget[data-layout="band"] .person { grid-area:person; margin-top:8px; }
    .widget[data-layout="band"] [data-gsp-source] { grid-area:source; }
    .widget[data-layout="band"] .testimonial-images { display:none !important; }

    /* Chips: the marked words alone, as pills, on two rows that pass each
       other in opposite directions. */
    .widget[data-layout="chips"] { padding-inline:0; }
    .widget[data-layout="chips"] .rows { display:grid; gap:12px; }
    .widget[data-layout="chips"] .track { overflow:hidden; -webkit-mask-image:linear-gradient(to right,transparent,#000 64px,#000 calc(100% - 64px),transparent); mask-image:linear-gradient(to right,transparent,#000 64px,#000 calc(100% - 64px),transparent); }
    .widget[data-layout="chips"] .row { display:flex; width:max-content; gap:12px; animation:gsp-marquee 52s linear infinite; }
    .widget[data-layout="chips"] .row[data-direction="reverse"] { animation-direction:reverse; }
    .widget[data-layout="chips"] .track:hover .row, .widget[data-layout="chips"] .track:focus-within .row { animation-play-state:paused; }
    .widget[data-layout="chips"] .card { display:flex; width:auto; max-width:min(420px,70cqi); flex:0 0 auto; margin:0; border-radius:999px; }
    .widget[data-layout="chips"] .content { display:flex; align-items:center; gap:12px; padding:10px 20px 10px 10px; }
    .widget[data-layout="chips"] .identity { display:contents; }
    .widget[data-layout="chips"] .content > .stars, .widget[data-layout="chips"] .person, .widget[data-layout="chips"] .quote-mark, .widget[data-layout="chips"] [data-gsp-source] { display:none !important; }
    .widget[data-layout="chips"] .avatar { order:-1; width:32px; height:32px; flex-basis:32px; }
    .widget[data-layout="chips"] .quote { font-size:15px; line-height:22px; white-space:nowrap; }
    .widget[data-layout="chips"] .row > [aria-hidden="true"] { pointer-events:none; }

    /* Blocks: edge to edge, no gutter, no radius, and the tone alternates -
       paper, ink, accent. The competitor does this in neon on black; the
       system has one accent and warm neutrals, so it reads as print. */
    .widget[data-layout="blocks"] { padding:0; }
    .widget[data-layout="blocks"] .grid { display:grid; grid-auto-flow:dense; grid-template-columns:1fr; gap:0; column-count:1; }
    .widget[data-layout="blocks"] .card { height:100%; margin:0; border:0; border-radius:0; }
    .widget[data-layout="blocks"] .content { padding:32px; }
    .widget[data-layout="blocks"] .card.video-card { display:flex; align-items:center; background:#000; }
    .widget[data-layout="blocks"] .video-shell { flex:1; }
    /* An attached screenshot brings its own colours into a wall built on
       three tones, so this family shows the words alone. */
    .widget[data-layout="blocks"] .testimonial-images { display:none !important; }
    .widget[data-layout="blocks"] .quote { font-size:19px; font-weight:600; line-height:28px; }
    .widget[data-layout="blocks"] .card:nth-child(3n+2):not(.video-card) { background:var(--gsp-promo-surface); }
    .widget[data-layout="blocks"] .card:nth-child(3n+2) .quote, .widget[data-layout="blocks"] .card:nth-child(3n+2) .name { color:var(--gsp-promo-text); }
    .widget[data-layout="blocks"] .card:nth-child(3n+2) .meta { color:color-mix(in srgb, var(--gsp-promo-text) 72%, transparent); }
    .widget[data-layout="blocks"] .card:nth-child(3n+2) .avatar { background:color-mix(in srgb, var(--gsp-promo-text) 16%, transparent); color:var(--gsp-promo-text); }
    .widget[data-layout="blocks"] .card:nth-child(6n+4):not(.video-card) { background:var(--gsp-accent); }
    .widget[data-layout="blocks"] .card:nth-child(6n+4) .quote, .widget[data-layout="blocks"] .card:nth-child(6n+4) .name, .widget[data-layout="blocks"] .card:nth-child(6n+4) .meta { color:var(--gsp-accent-ink); }
    .widget[data-layout="blocks"] .card:nth-child(6n+4) .stars, .widget[data-layout="blocks"] .card:nth-child(6n+4) .quote-mark { color:var(--gsp-accent-ink); }
    .widget[data-layout="blocks"] .card:nth-child(6n+4) .avatar { background:color-mix(in srgb, var(--gsp-accent-ink) 14%, transparent); }
    .widget[data-layout="blocks"] .card:nth-child(6n+4) mark { background:none !important; color:inherit; }

    /* Faces: the grid of customers is the navigation, not an ornament. */
    .widget[data-layout="faces"] .face-grid { display:flex; flex-wrap:wrap; gap:8px; }
    .widget[data-layout="faces"] .face-button {
      display:grid; overflow:hidden; width:56px; height:56px; flex:0 0 56px;
      min-width:0; min-height:0; place-items:center;
      padding:0; border:0; border-radius:999px;
      background:color-mix(in srgb, var(--gsp-text) 8%, var(--gsp-surface));
      color:var(--gsp-muted); font:inherit; font-size:14px; font-weight:600;
      cursor:pointer;
      opacity:0.6; transition:opacity 200ms ease, transform 200ms ease;
    }
    .widget[data-layout="faces"] .face-button img { display:block; width:100%; height:100%; object-fit:cover; }
    .widget[data-layout="faces"] .face-button:hover { opacity:1; transform:translateY(-2px); }
    .widget[data-layout="faces"] .face-button[aria-pressed="true"] { opacity:1; color:var(--gsp-text); outline:2px solid var(--gsp-accent); outline-offset:2px; }
    .widget[data-layout="faces"] .panel { margin-top:20px; }
    .widget[data-layout="faces"] .grid { max-width:560px; }

    /* The poster quote's three elements, aligned as one. */
    .widget[data-layout="hero"] .person { flex:0 1 auto; }
    .widget[data-layout="hero"][data-align="center"] .card { text-align:center; }
    .widget[data-layout="hero"][data-align="center"] .content > .stars,
    .widget[data-layout="hero"][data-align="center"] .identity { justify-content:center; }
    .widget[data-layout="hero"][data-align="right"] .card { text-align:right; }
    .widget[data-layout="hero"][data-align="right"] .content > .stars { justify-content:flex-end; }
    /* The signature mirrors, so the face hugs the strong edge. Reversing the
       row reverses the axis too: start is now the right. */
    .widget[data-layout="hero"][data-align="right"] .identity { flex-direction:row-reverse; justify-content:flex-start; }

    /* The entrance, orthogonal like the hand: proof that arrives as the
       visitor reaches it reads as accumulation rather than decoration. */
    .widget[data-entrance="stagger"] .grid > .card { opacity:0; transform:translateY(14px); transition:opacity 320ms cubic-bezier(0.22,1,0.36,1), transform 320ms cubic-bezier(0.22,1,0.36,1); }
    .widget[data-entrance="stagger"] .grid > .card[data-entered="true"] { opacity:1; transform:none; }

    @container (min-width:576px) {
      .widget[data-layout="blocks"] .grid { grid-template-columns:repeat(2,1fr); }
      .widget[data-layout="blocks"] .card.video-card { grid-row:span 2; }
    }
    @container (min-width:850px) {
      .widget[data-layout="blocks"] .grid { grid-template-columns:repeat(3,1fr); }
    }
    @container (max-width:479px) {
      .widget[data-layout="band"] .content { grid-template-areas:"photo stars source" "quote quote quote" "person person person"; grid-template-columns:72px minmax(0,1fr) auto; }
      .widget[data-layout="band"] .avatar { width:72px; height:72px; }
      .widget[data-layout="band"] .quote { margin-top:12px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .face { transition:none; }
      .faces:hover .face { margin-left:-10px; }
      .face:hover { transform:none; }
      .widget[data-layout="chips"] .row { animation:none; }
      .widget[data-layout="chips"] .track { overflow-x:auto; }
      .widget[data-layout="faces"] .face-button { transition:none; }
      .widget[data-entrance="stagger"] .grid > .card { opacity:1; transform:none; transition:none; }
    }
  `;

  const svgNS = "http://www.w3.org/2000/svg";
  function svgElement(tag, attributes) {
    const node = document.createElementNS(svgNS, tag);
    Object.entries(attributes).forEach(([name, value]) =>
      node.setAttribute(name, value),
    );
    return node;
  }
  /** The same star the card markup draws, rebuilt for the summary badges. */
  function starSvg(filled) {
    const svg = svgElement("svg", {
      "aria-hidden": "true",
      fill: filled ? "currentColor" : "none",
      stroke: "currentColor",
      "stroke-linejoin": "round",
      "stroke-width": "2",
      viewBox: "0 0 24 24",
    });
    if (!filled) svg.style.opacity = "0.3";
    svg.append(
      svgElement("path", {
        d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.12 2.12 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16z",
      }),
    );
    return svg;
  }
  /** Two passes of a ring that never quite closes (DESIGN.md, circle around). */
  function ringMark() {
    const ring = element("span", "ring");
    const svg = svgElement("svg", {
      "aria-hidden": "true",
      fill: "none",
      preserveAspectRatio: "none",
      viewBox: "0 0 120 76",
    });
    [
      [
        "M62 6.2C31 4.4 10 19.4 9 36.4 8.1 52.6 27 69.4 58.6 70.4c29.7.9 51.6-13.8 52.2-31.6C111.4 21.4 91 7.6 60 6.2",
        "2.4",
      ],
      ["M53 9.6C28 10.6 13.4 23.8 12.6 38.6", "1.5"],
    ].forEach(([d, width]) =>
      svg.append(
        svgElement("path", {
          d,
          stroke: "currentColor",
          "stroke-linecap": "round",
          "stroke-width": width,
        }),
      ),
    );
    ring.append(svg);
    return ring;
  }
  /** The average of the ratings that exist, ignoring Testimonials without one. */
  function averageRating(testimonials) {
    const rated = testimonials.filter(
      (testimonial) =>
        typeof testimonial.rating === "number" && testimonial.rating > 0,
    );
    if (!rated.length) return 0;
    return (
      rated.reduce((total, testimonial) => total + testimonial.rating, 0) /
      rated.length
    );
  }
  function ratingBadge(payload, drawn) {
    const average = averageRating(payload.testimonials);
    const badge = element("div", "badge");
    const score = element(
      "span",
      "badge-score",
      average ? average.toFixed(1) : "—",
    );
    if (drawn) score.append(ringMark());
    const stars = element("div", "badge-stars");
    stars.setAttribute("role", "img");
    stars.setAttribute("aria-label", `${average.toFixed(1)} out of 5 stars`);
    for (let index = 0; index < 5; index += 1)
      stars.append(starSvg(index < Math.round(average)));
    const body = element("div", "badge-body");
    const count = payload.testimonials.length;
    body.append(
      stars,
      element(
        "p",
        "badge-copy",
        `from ${count} ${count === 1 ? "testimonial" : "testimonials"}`,
      ),
    );
    badge.append(score, body);
    return badge;
  }
  /**
   * A number on its own is an assertion. The row of faces under it is the
   * evidence, and the average turns the count into a verdict - which is why
   * this reads as proof where a bare figure reads as marketing.
   */
  function metricBlock(payload, drawn) {
    const block = element("div", "metric-block");
    const metric = element("div", "metric");
    const count = payload.testimonials.length;
    const value = element("span", "metric-value", String(count));
    if (drawn) value.append(ringMark());
    metric.append(
      value,
      element(
        "p",
        "metric-copy",
        `${count === 1 ? "customer has" : "customers have"} told their story`,
      ),
    );
    block.append(metric);
    const shown = payload.testimonials.filter(
      (testimonial) => testimonial.avatarVisible !== false,
    );
    if (shown.length > 1) {
      const foot = element("div", "metric-foot");
      /* Four faces and a chip saying how many more. The overflow belongs in
         the row it overflows, not in a sentence beside the rating: one
         string carrying a count and a score is two facts and no meaning. */
      const faces = faceStack(shown, 4);
      const rest = shown.length - Math.min(shown.length, 4);
      if (rest > 0) faces.append(moreFace(rest));
      foot.append(faces);
      const average = averageRating(payload.testimonials);
      if (average) {
        const score = element("div", "metric-score");
        const stars = element("div", "badge-stars");
        stars.setAttribute("role", "img");
        stars.setAttribute(
          "aria-label",
          `${average.toFixed(1)} out of 5 stars`,
        );
        for (let index = 0; index < 5; index += 1)
          stars.append(starSvg(index < Math.round(average)));
        score.append(
          stars,
          element("span", "metric-average", average.toFixed(1)),
        );
        foot.append(score);
      }
      block.append(foot);
    }
    return block;
  }
  /** The shape the Customer filmed, carried on the shell by the card markup. */
  function cardAspect(card) {
    const shell = card.querySelector("[data-video-aspect-ratio]");
    const match = /^(\d{1,5}):(\d{1,5})$/.exec(
      shell?.dataset.videoAspectRatio ?? "",
    );
    if (!match || Number(match[1]) <= 0 || Number(match[2]) <= 0)
      return undefined;
    return [Number(match[1]), Number(match[2])];
  }
  /**
   * Keeps a tall video from running away with a wide column WITHOUT touching
   * its shape. A video is shown as it was filmed, never re-cropped to suit a
   * layout, so the card narrows until the height its own ratio gives fits the
   * cap. A landscape video asks for a max-width wider than the column, which
   * simply never binds.
   */
  function boundVideoCards(cards, maxHeight) {
    cards.forEach((card) => {
      const aspect = cardAspect(card);
      if (!aspect) return;
      card.style.maxWidth = `${Math.round((maxHeight * aspect[0]) / aspect[1])}px`;
      card.style.marginInline = "auto";
    });
  }
  /** The overlapping row of customers, shared by the avatars row and the figure. */
  function faceStack(testimonials, limit) {
    const faces = element("div", "faces");
    const shown = testimonials.filter(
      (testimonial) => testimonial.avatarVisible !== false,
    );
    shown.slice(0, limit ?? shown.length).forEach((testimonial) => {
      const face = element("span", "face");
      face.setAttribute("title", testimonial.name);
      face.setAttribute("aria-label", testimonial.name);
      if (testimonial.avatarUrl) {
        const image = element("img");
        image.src = testimonial.avatarUrl;
        image.alt = "";
        image.loading = "lazy";
        face.append(image);
      } else
        face.textContent = testimonial.name
          .split(/\s+/)
          .map((part) => part[0])
          .slice(0, 2)
          .join("");
      faces.append(face);
    });
    return faces;
  }
  /** The face-shaped chip that says how many the row did not show. */
  function moreFace(rest) {
    const more = element("span", "face more", `+${rest}`);
    more.setAttribute(
      "aria-label",
      `${rest} more ${rest === 1 ? "customer" : "customers"}`,
    );
    return more;
  }
  /**
   * "Priya, Alice, Alex and 6 others" rather than "9 customer testimonials".
   * A count is a statistic; first names are people, which is the whole point
   * of a row of faces sitting beside a call to action.
   */
  function nameList(testimonials, limit) {
    const names = [
      ...new Set(
        testimonials
          .map((testimonial) => testimonial.name.trim().split(/\s+/)[0])
          .filter(Boolean),
      ),
    ];
    const lead = names.slice(0, limit);
    const rest = names.length - lead.length;
    if (!lead.length) return undefined;
    if (rest > 0)
      return {
        lead: lead.join(", "),
        tail: ` and ${rest} ${rest === 1 ? "other" : "others"}`,
      };
    if (lead.length === 1) return { lead: lead[0], tail: "" };
    return {
      lead: `${lead.slice(0, -1).join(", ")} and ${lead[lead.length - 1]}`,
      tail: "",
    };
  }
  /** One baseline height, each poster as wide as its own shape asks. */
  function contactSheet(cards, tileHeight) {
    cards.forEach((card) => {
      const aspect = cardAspect(card);
      if (!aspect) return;
      card.style.width = `${Math.round((tileHeight * aspect[0]) / aspect[1])}px`;
      card.style.maxWidth = "100%";
    });
  }
  /**
   * A wall of blocks that ends mid-row is a wall with a hole in it, and the
   * whole point of this family is the flush edge. The last block takes the
   * cells the row has left. Recomputed only when the column count actually
   * changes, so growing the block cannot feed the observer its own result.
   */
  function fillBlockRow(grid, cards) {
    let columnCount = 0;
    const apply = () => {
      const columns = getComputedStyle(grid)
        .gridTemplateColumns.split(" ")
        .filter(Boolean).length;
      if (columns === columnCount) return;
      columnCount = columns;
      const last = cards[cards.length - 1];
      last.style.gridColumn = "";
      if (columns < 2 || last.classList.contains("video-card")) return;
      /* A video block spans two rows, so it eats two cells of the flow. */
      const cells = cards.reduce(
        (total, card) =>
          total + (card.classList.contains("video-card") ? 2 : 1),
        0,
      );
      const remainder = cells % columns;
      if (remainder) last.style.gridColumn = `span ${columns - remainder + 1}`;
    };
    apply();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(apply);
    observer.observe(grid);
    return () => observer.disconnect();
  }
  /** The kind of Testimonial a family can honestly show, when it is not all. */
  const familySelection = { band: "text", marquee: "text", videos: "video" };
  const reducedMotion = () =>
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  /**
   * Two rows that pass each other. A short set would leave a gap at the seam,
   * so the set repeats until the row is wide enough, then the whole row is
   * doubled because the loop translates by half its width.
   */
  function chipRows(cards, rows) {
    const even = cards.filter((_, index) => index % 2 === 0);
    const odd = cards.filter((_, index) => index % 2 === 1);
    [even, odd.length ? odd : []].forEach((set, index) => {
      if (!set.length) return;
      const track = element("div", "track");
      const row = element("div", "row");
      if (index) row.dataset.direction = "reverse";
      const copies = Math.max(2, Math.ceil(8 / set.length));
      for (let copy = 0; copy < copies; copy += 1)
        row.append(
          ...set.map((card) => {
            if (!copy) return card;
            const clone = card.cloneNode(true);
            clone.setAttribute("aria-hidden", "true");
            return clone;
          }),
        );
      row.append(
        ...[...row.children].map((node) => {
          const clone = node.cloneNode(true);
          clone.setAttribute("aria-hidden", "true");
          return clone;
        }),
      );
      track.append(row);
      rows.append(track);
    });
  }
  /** The face a Customer shows, read back off the card the server rendered. */
  function faceButton(card, index) {
    const button = element("button", "face-button");
    button.type = "button";
    const name = (
      card.querySelector(".name")?.textContent ||
      card.querySelector(".video-name")?.textContent ||
      ""
    ).trim();
    button.setAttribute("aria-label", name || `Testimonial ${index + 1}`);
    button.setAttribute("aria-pressed", "false");
    const source = card.querySelector(".avatar img")?.getAttribute("src");
    if (source) {
      const image = element("img");
      image.src = source;
      image.alt = "";
      image.loading = "lazy";
      button.append(image);
    } else
      button.textContent = name
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join("");
    return button;
  }
  /**
   * Proof that arrives as the visitor reaches it. Each batch the observer
   * hands over is staggered from its own first card, so a wall fills in
   * rather than appearing whole, and a visitor who lands mid-page is not
   * made to wait for a queue they never saw.
   */
  function applyEntrance(cards) {
    if (reducedMotion() || typeof IntersectionObserver === "undefined") {
      cards.forEach((card) => {
        card.dataset.entered = "true";
      });
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        let position = 0;
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          entry.target.style.transitionDelay = `${Math.min(position, 6) * 60}ms`;
          position += 1;
          entry.target.dataset.entered = "true";
        });
      },
      { threshold: 0.15 },
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }
  /**
   * One card on show at a time, the block only ever as tall as that card.
   * Shared by the living wall, the bubble and the face wall: reserving the
   * height of the tallest member leaves a short quote sitting above a few
   * hundred pixels of nothing, and pushes a bubble out of its own corner.
   */
  function stackController(grid, cards, onShow) {
    grid.classList.add("stack");
    let index = 0;
    const fit = () => {
      const active = cards[index];
      if (active.offsetHeight) grid.style.height = `${active.offsetHeight}px`;
    };
    const show = (next) => {
      index = (next + cards.length) % cards.length;
      cards.forEach((card, position) => {
        card.dataset.active = String(position === index);
      });
      onShow?.(index);
      fit();
    };
    /* Cards measure short until the sheet and the posters have landed. */
    requestAnimationFrame(fit);
    let width = 0;
    const resize =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver((entries) => {
            /* Height is ours to set, so only a change of width - which
               reflows the quote - may trigger a remeasure. */
            const next = Math.round(entries[0].contentRect.width);
            if (next === width) return;
            width = next;
            requestAnimationFrame(fit);
          });
    resize?.observe(grid);
    return { at: () => index, show, stop: () => resize?.disconnect() };
  }
  /**
   * The layouts whose behaviour is not CSS alone. Each returns its own cleanup
   * so renderWidget can hand a single teardown to widgetCleanups.
   */
  function decorateFamily({ cards, config, grid, shadow, wall }) {
    const pauseVideos = () =>
      shadow
        .querySelectorAll("mux-player")
        .forEach((player) => player.pause?.());
    /* The height caps, per family. None of them change a video's shape. */
    const caps = {
      carousel: 520,
      bubble: 360,
      editorial: 520,
      faces: 440,
      hero: 520,
      individual: 520,
      spotlight: 440,
    };
    if (caps[config.layout]) boundVideoCards(cards, caps[config.layout]);
    if (config.layout === "videos") contactSheet(cards, 340);
    if (config.layout === "band")
      cards.forEach((card) => {
        if (!card.querySelector(".avatar")) card.dataset.noPhoto = "";
      });
    if (config.layout === "blocks" && cards.length)
      return fillBlockRow(grid, cards);
    if (config.layout === "chips" && cards.length) {
      const rows = element("div", "rows");
      grid.replaceWith(rows);
      chipRows(cards, rows);
      return undefined;
    }
    if (config.layout === "faces" && cards.length) {
      const faceGrid = element("div", "face-grid");
      const panel = element("div", "panel");
      grid.replaceWith(faceGrid);
      faceGrid.after(panel);
      panel.append(grid);
      const buttons = cards.map((card, index) => faceButton(card, index));
      const stack = stackController(grid, cards, (position) =>
        buttons.forEach((button, at) =>
          button.setAttribute("aria-pressed", String(at === position)),
        ),
      );
      buttons.forEach((button, index) => {
        button.onclick = () => {
          pauseVideos();
          stack.show(index);
        };
        faceGrid.append(button);
      });
      stack.show(0);
      return stack.stop;
    }
    if (config.layout === "marquee" && cards.length) {
      const track = element("div", "track");
      grid.replaceWith(track);
      track.append(grid);
      grid.append(
        ...cards.map((card) => {
          const clone = card.cloneNode(true);
          clone.setAttribute("aria-hidden", "true");
          clone
            .querySelectorAll("a, button")
            .forEach((node) => node.setAttribute("tabindex", "-1"));
          return clone;
        }),
      );
      return undefined;
    }
    if (
      (config.layout === "spotlight" || config.layout === "bubble") &&
      cards.length
    ) {
      let timer;
      const dots =
        config.layout === "spotlight" ? element("div", "dots") : null;
      const stack = stackController(grid, cards, (position) => {
        if (dots)
          [...dots.children].forEach((dot, at) =>
            dot.setAttribute("aria-current", String(at === position)),
          );
      });
      const show = (next) => {
        pauseVideos();
        stack.show(next);
      };
      const play = () => {
        clearInterval(timer);
        if (cards.length > 1 && !reducedMotion())
          timer = setInterval(() => {
            /* Someone watching a Testimonial is not interrupted by the turn;
               the queue waits until the video is done or paused. */
            if (wall.querySelector("[data-video-playing]")) return;
            show(stack.at() + 1);
          }, 6000);
      };
      if (dots) {
        cards.forEach((_, position) => {
          const dot = element("button", "dot");
          dot.type = "button";
          dot.setAttribute("aria-label", `Testimonial ${position + 1}`);
          dot.onclick = () => {
            show(position);
            play();
          };
          dots.append(dot);
        });
        if (cards.length > 1) wall.append(dots);
      }
      show(0);
      play();
      if (config.layout === "bubble") {
        const bubble = element("div", "bubble");
        grid.replaceWith(bubble);
        const close = element("button", "bubble-close", "×");
        close.type = "button";
        close.setAttribute("aria-label", "Close");
        close.onclick = () => {
          clearInterval(timer);
          pauseVideos();
          bubble.remove();
        };
        bubble.append(close, grid);
        const reveal = setTimeout(() => {
          bubble.dataset.shown = "true";
        }, 1200);
        return () => {
          clearInterval(timer);
          clearTimeout(reveal);
          stack.stop();
        };
      }
      return () => {
        clearInterval(timer);
        stack.stop();
      };
    }
    return undefined;
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
    /* A widget lives on someone else's page: it paints a ground only when
       the Owner asked for one, and otherwise lets the page show through. */
    host.dataset.transparentEmbed = String(
      payload.brand.transparentEmbed === true,
    );
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
    const drawn = config.hand === "drawn";
    if (drawn) wall.dataset.hand = "drawn";
    if (config.entrance === "stagger") wall.dataset.entrance = "stagger";
    /* The poster quote alone takes an alignment, and its three elements -
       stars, quote, signature - move together or not at all. */
    if (config.layout === "hero") wall.dataset.align = config.align ?? "center";
    if (payload.inlineOverlay === true) wall.dataset.inline = "true";
    wall.setAttribute("aria-label", `${payload.brand.name} testimonials`);
    if (config.layout === "wall")
      wall.append(element("h2", "", payload.brand.name));
    const grid = element("div", "grid");
    let cards = [];
    if (!payload.testimonials.length) {
      grid.append(element("p", "", "No testimonials to display yet."));
    } else if (config.layout === "avatars") {
      const shown = payload.testimonials.filter(
        (testimonial) => testimonial.avatarVisible !== false,
      );
      const faces = faceStack(shown, 5);
      const rest = shown.length - Math.min(shown.length, 5);
      if (rest > 0) faces.append(moreFace(rest));
      grid.append(faces);
      const names = nameList(shown, 3);
      if (names) {
        const copy = element("p", "avatar-copy");
        copy.append(element("span", "avatar-names", names.lead));
        if (names.tail) copy.append(element("span", "", names.tail));
        grid.append(copy);
      }
    } else if (config.layout === "rating") {
      grid.append(ratingBadge(payload, drawn));
    } else if (config.layout === "metric") {
      grid.append(metricBlock(payload, drawn));
    } else {
      /* Two families cannot show every kind of Testimonial. A band that
         never stops moving has nothing to press, and a poster there would
         promise a play already sliding out of reach, so it takes text only.
         The gallery is the mirror case. Both say so when they come up empty
         rather than rendering a convincing nothing. */
      const only = familySelection[config.layout];
      const chosen = only
        ? payload.testimonials.filter(
            (testimonial) => testimonial.type === only,
          )
        : payload.testimonials;
      cards = chosen.map((testimonial) =>
        renderCard(testimonial, payload.brand),
      );
      if (!cards.length)
        grid.append(
          element(
            "p",
            "",
            only === "video"
              ? "No video testimonials to display yet."
              : only === "text"
                ? "No written testimonials to display yet."
                : "No testimonials to display yet.",
          ),
        );
      if (config.layout === "mosaic")
        cards.forEach((card, index) => {
          if (index % 4 === 0 && !card.classList.contains("video-card"))
            card.dataset.span = "wide";
        });
      grid.append(...cards);
    }
    wall.append(grid);
    const familyCleanup = decorateFamily({ cards, config, grid, shadow, wall });
    /* The stacking families drive card opacity themselves, so the entrance
       stays out of their way. */
    const entranceCleanup =
      config.entrance === "stagger" &&
      cards.length &&
      !grid.classList.contains("stack")
        ? applyEntrance(cards)
        : undefined;
    if (familyCleanup || entranceCleanup)
      widgetCleanups.set(host, () => {
        familyCleanup?.();
        entranceCleanup?.();
      });
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
    shadow.replaceChildren(
      element("style", "", styles + widgetStyles + widgetFamilyStyles),
      wall,
    );
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
