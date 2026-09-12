import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { fetchMutation, fetchQuery } from "convex/nextjs";

import { api } from "@convex/_generated/api";
import { getPublicEnvironment } from "@/lib/env/public-env";
import { testimonialCardHtml } from "@/components/testimonials/testimonial-card-markup";

const publicCacheControl = "public, max-age=0, must-revalidate";
const noStoreHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function json(body: unknown, status: number, cacheable = false, etag?: string) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...noStoreHeaders,
      ...(cacheable ? { "Cache-Control": publicCacheControl } : {}),
      ...(etag ? { ETag: etag } : {}),
    },
    status,
  });
}

function signCursor(cursor: string, publicSlug: string, secret: string) {
  const encoded = Buffer.from(cursor, "utf8").toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`${publicSlug}\0${encoded}`)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyCursor(token: string, publicSlug: string, secret: string) {
  if (token.length > 1500) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;
  const expected = createHmac("sha256", secret)
    .update(`${publicSlug}\0${encoded}`)
    .digest("base64url");
  const receivedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (
    receivedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(receivedBytes, expectedBytes)
  ) {
    return null;
  }
  const cursor = Buffer.from(encoded, "base64url").toString("utf8");
  if (
    !cursor ||
    cursor.length > 1_024 ||
    Buffer.from(cursor, "utf8").toString("base64url") !== encoded
  ) {
    return null;
  }
  return cursor;
}

function projectionEtag(body: unknown) {
  return `"${createHash("sha256").update(JSON.stringify(body)).digest("hex")}"`;
}

export function authorizedGateway(request: Request) {
  const expected = process.env.PUBLIC_WALL_ORIGIN_GATEWAY_SECRET;
  if (!expected || expected.length < 32) return false;
  const actual = request.headers.get("x-gsp-origin-secret") ?? "";
  const received = Buffer.from(actual);
  const required = Buffer.from(expected);
  return (
    received.length === required.length && timingSafeEqual(received, required)
  );
}

export function requesterKey(request: Request, secret: string) {
  // Only Vercel's overwritten header is authoritative on its managed ingress.
  // Other hosting environments share a fallback bucket until an authenticated adapter exists.
  const forwardedFor = authorizedGateway(request)
    ? (request.headers.get("cf-connecting-ip") ?? "unknown")
    : process.env.VERCEL === "1"
      ? (request.headers.get("x-forwarded-for") ?? "unknown")
      : "unknown";
  const networkKey = forwardedFor.split(",", 1)[0]?.trim().slice(0, 128);
  const windowStartedAt = Math.floor(Date.now() / 60_000) * 60_000;
  return createHmac("sha256", secret)
    .update(`${windowStartedAt}\0${networkKey || "unknown"}`)
    .digest("hex")
    .slice(0, 32);
}

function isPublicSlug(value: string) {
  return (
    value.length >= 2 &&
    value.length <= 48 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

function errorContains(error: unknown, code: string) {
  return (
    error instanceof Error &&
    (error.message.includes(code) || JSON.stringify(error).includes(code))
  );
}

export async function publicWallResponse(
  request: Request,
  { params }: { params: Promise<{ publicSlug: string }> },
) {
  if (
    process.env.PUBLIC_WALL_ORIGIN_GATEWAY_SECRET !== undefined &&
    !authorizedGateway(request)
  ) {
    return json(
      {
        code: "PUBLIC_WALL_ORIGIN_UNAUTHORIZED",
        message: "Public Wall unavailable.",
      },
      403,
    );
  }
  const environment = getPublicEnvironment();
  const secret = process.env.PUBLIC_READ_RATE_LIMIT_SECRET;
  if (!environment.configured || !secret || secret.length < 32) {
    return json(
      { code: "EMBED_NOT_CONFIGURED", message: "Embedded Wall unavailable." },
      503,
    );
  }

  const { publicSlug } = await params;
  const searchParams = new URL(request.url).searchParams;
  const cursorTokens = searchParams.getAll("cursor");
  const hasUnknownParameter = [...searchParams.keys()].some(
    (key) => key !== "cursor",
  );
  const cursorToken = cursorTokens[0] ?? null;
  const cursor = cursorToken
    ? verifyCursor(cursorToken, publicSlug, secret)
    : null;
  if (
    !isPublicSlug(publicSlug) ||
    hasUnknownParameter ||
    cursorTokens.length > 1 ||
    (cursorTokens.length === 1 && !cursor)
  ) {
    return json(
      {
        code: "INVALID_EMBED_REQUEST",
        message: "Invalid Embedded Wall request.",
      },
      400,
    );
  }

  const requestKey = requesterKey(request, secret);
  try {
    await fetchMutation(api.publicReadRateLimit.consumeLookup, {
      requesterKey: requestKey,
      secret,
    });
  } catch (error) {
    if (errorContains(error, "PUBLIC_READ_RATE_LIMITED")) {
      return json(
        { code: "PUBLIC_READ_RATE_LIMITED", message: "Try again shortly." },
        429,
      );
    }
    return json(
      {
        code: "EMBED_PROTECTION_UNAVAILABLE",
        message: "Embedded Wall unavailable.",
      },
      503,
    );
  }

  let brand;
  try {
    brand = await fetchQuery(api.publicWall.getBrand, { publicSlug, secret });
  } catch {
    return json(
      {
        code: "PUBLIC_WALL_UNAVAILABLE",
        message: "Embedded Wall unavailable.",
      },
      503,
    );
  }
  if (!brand) {
    return json(
      { code: "PUBLIC_WALL_NOT_FOUND", message: "Public Wall not found." },
      404,
      true,
    );
  }

  try {
    await fetchMutation(api.publicReadRateLimit.consume, {
      publicSlug,
      requesterKey: requestKey,
      secret,
    });
  } catch (error) {
    if (errorContains(error, "PUBLIC_READ_RATE_LIMITED")) {
      return json(
        { code: "PUBLIC_READ_RATE_LIMITED", message: "Try again shortly." },
        429,
      );
    }
    return json(
      {
        code: "EMBED_PROTECTION_UNAVAILABLE",
        message: "Embedded Wall unavailable.",
      },
      503,
    );
  }

  let page;
  try {
    page = await fetchQuery(api.publicWall.list, {
      paginationOpts: { cursor, numItems: 50 },
      publicSlug,
      secret,
    });
  } catch {
    return json(
      {
        code: "PUBLIC_WALL_UNAVAILABLE",
        message: "Embedded Wall unavailable.",
      },
      503,
    );
  }
  const projection = {
    brand: {
      accentColor: brand.accentColor,
      accentInk: brand.accentInk,
      attributionRequired: brand.attributionRequired,
      name: brand.brandName,
      logoUrl: brand.logoUrl,
      publicSlug: brand.publicSlug,
      theme: brand.theme,
      transparentEmbed: brand.transparentEmbed,
    },
    pagination: {
      cursor: page.isDone
        ? null
        : signCursor(page.continueCursor, publicSlug, secret),
    },
    schemaVersion: 1,
    privacyRevision: brand.privacyRevision,
    testimonials: page.page.map((testimonial) => ({
      ...testimonial,
      html: testimonialCardHtml({
        accentColor: brand.accentColor,
        testimonial,
      }),
    })),
  };
  if (Buffer.byteLength(JSON.stringify(projection), "utf8") > 1_000_000) {
    return json(
      { code: "PUBLIC_WALL_UNAVAILABLE", message: "Public Wall unavailable." },
      503,
    );
  }
  const etag = projectionEtag(projection);
  const response =
    request.headers.get("if-none-match") === etag
      ? new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": publicCacheControl,
            ETag: etag,
          },
          status: 304,
        })
      : json(projection, 200, true, etag);
  return response;
}
