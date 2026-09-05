import { fetchAction } from "convex/nextjs";

import { api } from "@convex/_generated/api";
import { isMuxVideoEvent, verifyMuxSignature } from "@convex/domain/muxWebhook";

export const runtime = "nodejs";

const noStoreHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: noStoreHeaders,
    status,
  });
}

export async function POST(request: Request) {
  const muxSecret = process.env.MUX_WEBHOOK_SECRET;
  const ingestSecret = process.env.VIDEO_WEBHOOK_INGEST_SECRET;
  if (
    !muxSecret ||
    muxSecret.length < 32 ||
    !ingestSecret ||
    ingestSecret.length < 32 ||
    !process.env.NEXT_PUBLIC_CONVEX_URL
  ) {
    return json({ code: "VIDEO_WEBHOOK_NOT_CONFIGURED" }, 503);
  }
  const rawBody = await request.text();
  if (
    rawBody.length > 1_000_000 ||
    !(await verifyMuxSignature(
      rawBody,
      request.headers.get("mux-signature"),
      muxSecret,
    ))
  ) {
    return json({ code: "INVALID_VIDEO_WEBHOOK_SIGNATURE" }, 401);
  }
  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ code: "INVALID_VIDEO_WEBHOOK" }, 400);
  }
  if (!isMuxVideoEvent(event)) {
    return json({ code: "INVALID_VIDEO_WEBHOOK" }, 400);
  }
  try {
    const result = await fetchAction(api.videoWebhooks.ingest, {
      event: {
        data: event.data,
        id: event.id,
        type: event.type,
      },
      ingestSecret,
    });
    return json(result, 200);
  } catch {
    return json({ code: "VIDEO_WEBHOOK_UNAVAILABLE" }, 503);
  }
}
