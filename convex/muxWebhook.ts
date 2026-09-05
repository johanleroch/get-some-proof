import { internal } from "./_generated/api";
import { env, httpAction } from "./_generated/server";
import { isMuxVideoEvent, verifyMuxSignature } from "./domain/muxWebhook";
import { hashSubmissionManagementToken } from "./domain/submission";
import { deriveVideoRetryToken } from "./domain/video";

const responseHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: responseHeaders,
    status,
  });
}

export const muxWebhook = httpAction(async (ctx, request) => {
  const muxSecret = env.MUX_WEBHOOK_SECRET;
  const retrySecret = env.VIDEO_WEBHOOK_INGEST_SECRET;
  if (
    !muxSecret ||
    muxSecret.length < 32 ||
    !retrySecret ||
    retrySecret.length < 32
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
    const retryTokenSeed = `webhook:${event.id}`;
    const retryToken = await deriveVideoRetryToken(retrySecret, retryTokenSeed);
    const result = await ctx.runMutation(internal.videoWebhooks.applyEvent, {
      event: { data: event.data, id: event.id, type: event.type },
      retryTokenHash: await hashSubmissionManagementToken(retryToken),
      retryTokenSeed,
    });
    return json(result, 200);
  } catch (error) {
    console.error("Mux webhook processing failed.", error);
    return json({ code: "VIDEO_WEBHOOK_UNAVAILABLE" }, 503);
  }
});
