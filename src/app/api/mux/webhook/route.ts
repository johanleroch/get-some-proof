import { createHmac, timingSafeEqual } from "node:crypto";

import { fetchAction } from "convex/nextjs";

import { api } from "@convex/_generated/api";

export const runtime = "nodejs";

const toleranceSeconds = 5 * 60;
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

function verifyMuxSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
) {
  if (!signatureHeader) return false;
  let timestamp: number | undefined;
  const signatures: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (key === "t" && value) timestamp = Number(value);
    if (key === "v1" && value) signatures.push(value);
  }
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(Math.floor(Date.now() / 1_000) - timestamp!) > toleranceSeconds
  ) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const expectedBytes = Buffer.from(expected, "hex");
  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const received = Buffer.from(signature, "hex");
    return (
      received.length === expectedBytes.length &&
      timingSafeEqual(received, expectedBytes)
    );
  });
}

function isVideoEvent(value: unknown): value is {
  data: unknown;
  id: string;
  type: string;
} {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { type?: unknown }).type === "string" &&
    "data" in value
  );
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
    !verifyMuxSignature(
      rawBody,
      request.headers.get("mux-signature"),
      muxSecret,
    )
  ) {
    return json({ code: "INVALID_VIDEO_WEBHOOK_SIGNATURE" }, 401);
  }
  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ code: "INVALID_VIDEO_WEBHOOK" }, 400);
  }
  if (!isVideoEvent(event)) {
    return json({ code: "INVALID_VIDEO_WEBHOOK" }, 400);
  }
  try {
    const result = await fetchAction(api.videoWebhooks.ingest, {
      event,
      ingestSecret,
    });
    return json(result, 200);
  } catch {
    return json({ code: "VIDEO_WEBHOOK_UNAVAILABLE" }, 503);
  }
}
