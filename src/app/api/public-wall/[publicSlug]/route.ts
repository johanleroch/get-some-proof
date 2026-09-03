import { fetchMutation, fetchQuery } from "convex/nextjs";

import { api } from "@convex/_generated/api";
import { getPublicEnvironment } from "@/lib/env/public-env";

const publicCacheControl =
  "public, max-age=0, s-maxage=30, stale-while-revalidate=30";
const noStoreHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function json(body: unknown, status: number, cacheable = false) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...noStoreHeaders,
      ...(cacheable ? { "Cache-Control": publicCacheControl } : {}),
    },
    status,
  });
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicSlug: string }> },
) {
  const environment = getPublicEnvironment();
  const secret = process.env.PUBLIC_READ_RATE_LIMIT_SECRET;
  if (!environment.configured || !secret || secret.length < 32) {
    return json(
      { code: "EMBED_NOT_CONFIGURED", message: "Embedded Wall unavailable." },
      503,
    );
  }

  const { publicSlug } = await params;
  const cursor = new URL(request.url).searchParams.get("cursor");
  if (!isPublicSlug(publicSlug) || (cursor && cursor.length > 1_024)) {
    return json(
      {
        code: "INVALID_EMBED_REQUEST",
        message: "Invalid Embedded Wall request.",
      },
      400,
    );
  }

  let rateLimit: { remaining: number; resetAt: number };
  try {
    rateLimit = await fetchMutation(api.publicReadRateLimit.consume, {
      resourceKey: `embed:${publicSlug}`,
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
  let page;
  try {
    [brand, page] = await Promise.all([
      fetchQuery(api.publicWall.getBrand, { publicSlug }),
      fetchQuery(api.publicWall.list, {
        paginationOpts: { cursor, numItems: 50 },
        publicSlug,
      }),
    ]);
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

  const response = json(
    {
      brand: {
        accentColor: brand.accentColor,
        attributionRequired: brand.attributionRequired,
        name: brand.brandName,
        publicSlug: brand.publicSlug,
      },
      pagination: { cursor: page.isDone ? null : page.continueCursor },
      schemaVersion: 1,
      testimonials: page.page,
    },
    200,
    true,
  );
  response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
  response.headers.set("X-RateLimit-Reset", String(rateLimit.resetAt));
  return response;
}
