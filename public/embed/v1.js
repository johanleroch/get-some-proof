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
      --gsp-accent: #6d5dfc;
      --gsp-surface: #ffffff;
      --gsp-text: #18181b;
      --gsp-muted: #71717a;
      --gsp-border: #e4e4e7;
    }
    :host([data-theme="dark"]) {
      --gsp-surface: #18181b;
      --gsp-text: #fafafa;
      --gsp-muted: #a1a1aa;
      --gsp-border: #3f3f46;
    }
    @media (prefers-color-scheme: dark) {
      :host([data-theme="system"]) {
        --gsp-surface: #18181b;
        --gsp-text: #fafafa;
        --gsp-muted: #a1a1aa;
        --gsp-border: #3f3f46;
      }
    }
    *, *::before, *::after { box-sizing: border-box; }
    .wall { container-type: inline-size; width: 100%; font-family: inherit; }
    .grid { column-count: 1; column-gap: 16px; }
    .card {
      display: inline-block;
      width: 100%;
      margin: 0 0 16px;
      padding: 20px;
      break-inside: avoid;
      overflow: hidden;
      border: 1px solid var(--gsp-border);
      border-radius: 12px;
      background: var(--gsp-surface);
      color: var(--gsp-text);
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
      font-family: inherit;
      letter-spacing: normal;
      text-align: left;
      text-transform: none;
    }
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
    .star[data-filled="false"] { color: color-mix(in srgb, var(--gsp-muted) 35%, transparent); }
    blockquote {
      margin-top: 20px;
      color: var(--gsp-text);
      font-family: inherit;
      font-size: 15px;
      font-weight: 500;
      letter-spacing: -0.01em;
      line-height: 1.75;
    }
    .attribution {
      display: inline-flex;
      margin-top: 20px;
      border-radius: 4px;
      color: var(--gsp-muted);
      font-family: inherit;
      font-size: 12px;
      line-height: 1.4;
      text-decoration: underline;
      text-underline-offset: 4px;
      transition: color 120ms ease;
    }
    .attribution:hover { color: var(--gsp-text); }
    .attribution:focus-visible {
      outline: 3px solid var(--gsp-accent);
      outline-offset: 4px;
    }
    @container (min-width: 42rem) { .grid { column-count: 2; } }
    @container (min-width: 64rem) { .grid { column-count: 3; } }
    @media (prefers-reduced-motion: reduce) { .attribution { transition: none; } }
  `;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function initials(name) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }

  function renderAvatar(testimonial) {
    const avatar = element("span", "avatar", initials(testimonial.name));
    avatar.setAttribute("aria-hidden", "true");
    if (testimonial.avatarUrl && testimonial.avatarUrl.startsWith("https://")) {
      const image = element("img");
      image.alt = "";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      image.src = testimonial.avatarUrl;
      avatar.replaceChildren(image);
    }
    return avatar;
  }

  function renderStars(rating) {
    const stars = element("div", "stars");
    stars.setAttribute("aria-label", `${rating} out of 5 stars`);
    stars.setAttribute("role", "img");
    for (let index = 0; index < 5; index += 1) {
      const star = element("span", "star", "★");
      star.dataset.filled = String(index < rating);
      star.setAttribute("aria-hidden", "true");
      stars.append(star);
    }
    return stars;
  }

  function renderCard(testimonial, brand, origin) {
    const card = element("article", "card");
    const identity = element("div", "identity");
    const person = element("div", "person");
    person.append(element("p", "name", testimonial.name));
    const meta = [testimonial.role, testimonial.company]
      .filter(Boolean)
      .join(" · ");
    if (meta) person.append(element("p", "meta", meta));
    identity.append(renderAvatar(testimonial), person);
    card.append(identity);
    if (testimonial.rating) card.append(renderStars(testimonial.rating));
    card.append(element("blockquote", "", testimonial.text));
    if (brand.attributionRequired) {
      const attribution = element(
        "a",
        "attribution",
        "Powered by Get Some Proof",
      );
      attribution.href = new URL(
        "/?utm_source=embedded_wall&utm_medium=referral&utm_campaign=powered_by",
        origin,
      ).toString();
      attribution.rel = "sponsored nofollow";
      card.append(attribution);
    }
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
      grid.replaceChildren(
        ...projection.testimonials.map((testimonial) =>
          renderCard(testimonial, projection.brand, apiOrigin),
        ),
      );
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
