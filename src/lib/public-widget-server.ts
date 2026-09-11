import "server-only";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { getPublicEnvironment } from "@/lib/env/public-env";
import { authorizedGateway, requesterKey } from "@/lib/public-wall-server";
import { widgetPayload } from "@/components/studio/widget-payload";

function response(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function publicWidgetResponse(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  if (
    process.env.PUBLIC_WALL_ORIGIN_GATEWAY_SECRET !== undefined &&
    !authorizedGateway(request)
  )
    return response({ message: "Widget unavailable." }, 403);
  const { publicId } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      publicId,
    ) ||
    new URL(request.url).search
  )
    return response({ message: "Invalid widget request." }, 400);
  const secret = process.env.PUBLIC_READ_RATE_LIMIT_SECRET;
  if (!getPublicEnvironment().configured || !secret || secret.length < 32)
    return response({ message: "Widget unavailable." }, 503);
  const requestKey = requesterKey(request, secret);
  try {
    await fetchMutation(api.publicReadRateLimit.consumeLookup, {
      requesterKey: requestKey,
      secret,
    });
    const brand = await fetchQuery(api.widgets.getPublishedBrand, {
      publicId,
      secret,
    });
    if (!brand) return response({ message: "Widget unavailable." }, 404);
    await fetchMutation(api.publicReadRateLimit.consume, {
      publicSlug: brand.publicSlug,
      requesterKey: requestKey,
      secret,
    });
    const value = await fetchQuery(api.widgets.getPublished, {
      publicId,
      secret,
    });
    if (!value) return response({ message: "Widget unavailable." }, 404);
    const payload = widgetPayload(value);
    if (Buffer.byteLength(JSON.stringify(payload), "utf8") > 1_000_000)
      return response({ message: "Widget unavailable." }, 503);
    return response(payload, 200);
  } catch (error) {
    const limited =
      error instanceof Error &&
      error.message.includes("PUBLIC_READ_RATE_LIMITED");
    return response(
      { message: limited ? "Try again shortly." : "Widget unavailable." },
      limited ? 429 : 503,
    );
  }
}
