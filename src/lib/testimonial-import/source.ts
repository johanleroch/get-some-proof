import { load } from "cheerio/slim";
import JSON5 from "json5";
import type { TestimonialRichText } from "../../../convex/domain/testimonialRichText";
import { testimonialTextIdentities } from "./testimonial-text-identity";

export type WallProvider = "testimonial-to" | "senja";

export type WallCandidate = {
  sourceId: string;
  type: "text" | "video";
  authorName: string;
  text: string;
  richText?: TestimonialRichText;
  tagline?: string;
  avatarUrl?: string;
  videoUrl?: string;
  unavailableReason?: "VIDEO_SOURCE_UNAVAILABLE";
};

export class WallSourceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WallSourceError";
  }
}

function supportedSource(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw unsupported();
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw unsupported();
  }
  let provider: WallProvider;
  if (
    url.hostname === "testimonial.to" &&
    /^\/[a-zA-Z0-9_-]+\/all\/?$/.test(url.pathname)
  ) {
    provider = "testimonial-to";
  } else if (
    (url.hostname === "senja.io" &&
      /^\/p\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)) ||
    (url.hostname === "love.senja.io" && url.pathname === "/")
  ) {
    provider = "senja";
  } else {
    throw unsupported();
  }
  url.hash = "";
  url.search = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
  return { provider, url: url.toString() };
}

function unsupported() {
  return new WallSourceError(
    "UNSUPPORTED_WALL_URL",
    "Enter a public Senja or Testimonial.to wall URL.",
  );
}

/** Only reads provider-owned public walls. Never forwards caller credentials. */
export async function readWallSource(input: string) {
  const source = supportedSource(input);
  const response = await fetch(source.url, {
    headers: { Accept: "text/html" },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new WallSourceError(
      "WALL_UNAVAILABLE",
      "The wall could not be read. Check that it is public and try again.",
    );
  }
  const reader = response.body?.getReader();
  if (!reader) {
    throw new WallSourceError(
      "WALL_UNAVAILABLE",
      "The wall response is empty.",
    );
  }
  const decoder = new TextDecoder();
  let bytes = 0;
  let html = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 4_000_000) {
        await reader.cancel();
        throw new WallSourceError(
          "WALL_TOO_LARGE",
          "This wall is too large to preview in one import.",
        );
      }
      html += decoder.decode(chunk.value, { stream: true });
    }
    html += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  return { ...source, html };
}

export async function previewWall(input: string) {
  const source = await readWallSource(input);
  const $ = load(source.html);
  const items: WallCandidate[] = [];
  if (source.provider === "testimonial-to") {
    let flight = "";
    $("script").each((_, element) => {
      const script = $(element).text();
      const start = script.indexOf("self.__next_f.push(");
      if (start < 0) return;
      try {
        const chunk: unknown = JSON.parse(
          arrayLiteral(script, start + "self.__next_f.push(".length),
        );
        if (
          Array.isArray(chunk) &&
          chunk[0] === 1 &&
          typeof chunk[1] === "string"
        )
          flight += chunk[1];
      } catch {
        /* Non-data script: never execute it. */
      }
    });
    const textIdentities = testimonialTextIdentities(flight);
    $(".testimonial-card.text-testimonial").each((_, element) => {
      const card = $(element);
      const authorName = card.find("span.font-bold").first().text().trim();
      const quote = card.find(".show-more-text").first().clone();
      quote.find("script,style,input,button").remove();
      quote.find("br").replaceWith("\n");
      quote.find("p").append("\n");
      const text = quote.text().trim();
      if (!authorName || !text) return;
      const tagline = card.find("p.text-sm").first().text().trim();
      const avatarUrl = card.find("img").first().attr("src");
      const controlId = card.find("input.show-more-toggle").first().attr("id");
      const sourceId = controlId ? textIdentities.get(controlId) : undefined;
      if (!sourceId) throw formatChanged();
      items.push({
        sourceId,
        type: "text",
        authorName,
        text,
        ...(tagline ? { tagline } : {}),
        ...(avatarUrl?.startsWith("https://") ? { avatarUrl } : {}),
      });
    });
    const visibleVideoIds = new Set(
      $(".testimonial-card [id^='unified-video-']")
        .toArray()
        .map((element) =>
          $(element).attr("id")!.slice("unified-video-".length),
        ),
    );
    const videoMetadata = new Map<string, Record<string, unknown>>();
    for (const line of flight.split("\n")) {
      const separator = line.indexOf(":");
      if (separator < 0) continue;
      try {
        const data: unknown = JSON.parse(line.slice(separator + 1));
        const pending = [data];
        while (pending.length) {
          const value = pending.pop();
          if (Array.isArray(value)) pending.push(...value);
          else if (value && typeof value === "object") {
            const object = record(value);
            if (
              typeof object.testimonialId === "string" &&
              visibleVideoIds.has(object.testimonialId) &&
              typeof object.authorName === "string"
            )
              videoMetadata.set(object.testimonialId, object);
            pending.push(...Object.values(object));
          }
        }
      } catch {
        /* Other RSC record kinds are not JSON and are not needed. */
      }
    }
    for (const sourceId of visibleVideoIds) {
      const metadata = videoMetadata.get(sourceId);
      const videoUrl =
        typeof metadata?.mp4Fallback === "string" &&
        /^https:\/\/stream\.mux\.com\/[a-zA-Z0-9]+\/[a-zA-Z0-9_-]+\.mp4$/.test(
          metadata.mp4Fallback,
        )
          ? metadata.mp4Fallback
          : undefined;
      items.push({
        sourceId,
        type: "video",
        authorName:
          typeof metadata?.authorName === "string" ? metadata.authorName : "",
        text: "",
        ...(videoUrl
          ? { videoUrl }
          : { unavailableReason: "VIDEO_SOURCE_UNAVAILABLE" as const }),
      });
    }
  } else {
    const script = $("script")
      .toArray()
      .map((entry) => $(entry).text())
      .find((text) => /reviews:\s*\[/.test(text));
    if (!script) throw formatChanged();
    const match = /reviews:\s*(\[)/.exec(script)!;
    const start = match.index + match[0].length - 1;
    let reviews: unknown;
    try {
      reviews = JSON5.parse<unknown>(arrayLiteral(script, start));
    } catch {
      throw formatChanged();
    }
    if (!Array.isArray(reviews)) throw formatChanged();
    for (const entry of reviews) {
      const review = record(entry);
      const customer = record(review.customer);
      if (
        (review.type !== "text" && review.type !== "video") ||
        typeof review.id !== "string" ||
        typeof customer.name !== "string"
      )
        continue;
      const videoUrl =
        review.type === "video" ? senjaVideoUrl(review.media_asset) : undefined;
      items.push({
        sourceId: review.id,
        type: review.type,
        ...senjaQuote(typeof review.text === "string" ? review.text : ""),
        authorName: customer.name,
        ...(review.type === "video"
          ? videoUrl
            ? { videoUrl }
            : { unavailableReason: "VIDEO_SOURCE_UNAVAILABLE" as const }
          : {}),
        ...(typeof customer.tagline === "string" && customer.tagline
          ? { tagline: customer.tagline }
          : {}),
        ...(typeof customer.avatar === "string" &&
        customer.avatar.startsWith("https://")
          ? { avatarUrl: customer.avatar }
          : {}),
      });
    }
  }
  return { provider: source.provider, sourceUrl: source.url, items };
}

/** Translate source HTML to our portable document; never render source HTML. */
function senjaQuote(html: string): {
  text: string;
  richText?: TestimonialRichText;
} {
  const $ = load(html);
  $("script,style").remove();
  $("br").replaceWith("\n");
  $("p,div").append("\n");
  const richText: TestimonialRichText = [{ type: "p", children: [] }];
  function visit(nodes: ReturnType<typeof $>, highlighted = false) {
    nodes.each((_, node) => {
      if (node.type === "text") {
        node.data.split("\n").forEach((text, index) => {
          if (index) richText.push({ type: "p", children: [] });
          const children = richText[richText.length - 1]!.children;
          const previous = children[children.length - 1];
          if (previous && !!previous.highlight === highlighted)
            previous.text += text;
          else
            children.push({
              text,
              ...(highlighted ? { highlight: true } : {}),
            });
        });
      } else if ("name" in node) {
        visit($(node).contents(), highlighted || node.name === "mark");
      }
    });
  }
  visit($.root().contents());
  for (const block of richText)
    if (!block.children.length) block.children.push({ text: "" });
  // Remove only the separator introduced after a closing block element.
  if (
    /<\/(?:p|div)>\s*$/i.test(html) &&
    richText[richText.length - 1]?.children.every((leaf) => !leaf.text)
  )
    richText.pop();
  const text = richText
    .map((block) => block.children.map((leaf) => leaf.text).join(""))
    .join("\n");
  return {
    text,
    ...(richText.some((block) => block.children.some((leaf) => leaf.highlight))
      ? { richText }
      : {}),
  };
}

function senjaVideoUrl(asset: unknown) {
  const metadata = record(record(asset).metadata);
  const playback = Array.isArray(metadata.playback_ids)
    ? metadata.playback_ids
        .map(record)
        .find(
          (entry) =>
            entry.policy === "public" &&
            typeof entry.id === "string" &&
            /^[a-zA-Z0-9]+$/.test(entry.id),
        )
    : undefined;
  const renditions = record(metadata.static_renditions);
  const file =
    renditions.status === "ready" && Array.isArray(renditions.files)
      ? renditions.files
          .map(record)
          .find(
            (entry) =>
              entry.ext === "mp4" &&
              typeof entry.name === "string" &&
              /^[a-zA-Z0-9_-]+\.mp4$/.test(entry.name),
          )
      : undefined;
  return playback && file
    ? `https://stream.mux.com/${playback.id}/${file.name}`
    : undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function formatChanged() {
  return new WallSourceError(
    "SOURCE_FORMAT_CHANGED",
    "The source format could not be read. No testimonials were imported.",
  );
}

/** Isolate serialized data without running any source script. */
function arrayLiteral(script: string, start: number) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = start; i < script.length; i++) {
    const character = script[i]!;
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
    } else if (character === '"' || character === "'") quote = character;
    else if (character === "[" || character === "{") {
      depth++;
      if (depth > 64) throw formatChanged();
    } else if (character === "]" || character === "}") {
      depth--;
      if (depth === 0) return script.slice(start, i + 1);
    }
  }
  throw formatChanged();
}
