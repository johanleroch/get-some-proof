import { timingSafeEqual } from "node:crypto";
import {
  MAX_PUBLICATION_BYTES,
  parseDeliveryPublication,
} from "../../src/lib/cloudflare-delivery";
type PublicationWriter = {
  put(
    key: string,
    value: string,
    options: { expiration: number },
  ): Promise<void>;
};
const response = (status: number) =>
  new Response(null, { status, headers: { "Cache-Control": "no-store" } });

export async function publicationResponse(
  request: Request,
  publications: PublicationWriter,
  secret: string,
  origins: string[],
) {
  if (request.method !== "PUT" || new URL(request.url).search)
    return response(400);
  const expected = new TextEncoder().encode(`Bearer ${secret}`);
  const provided = new TextEncoder().encode(
    request.headers.get("Authorization") ?? "",
  );
  if (
    secret.length < 32 ||
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  )
    return response(403);
  let envelope;
  try {
    envelope = parseDeliveryPublication(await boundedBody(request));
    if (
      new URL(request.url).pathname !== `/__publish/${envelope.publicId}` ||
      envelope.allowedOrigins.some((origin) => !origins.includes(origin)) ||
      envelope.generatedAt > Date.now() ||
      envelope.validUntil < Date.now() + 60_000
    )
      return response(400);
  } catch {
    return response(400);
  }
  try {
    // The source reserves this publicId once, before issuing this write. No retries
    // or mutable-key update path until the lifecycle coordinator is implemented.
    await publications.put(
      `widget:${envelope.publicId}`,
      JSON.stringify(envelope),
      { expiration: Math.ceil(envelope.validUntil / 1000) },
    );
    return response(201);
  } catch {
    return response(503);
  }
}

async function boundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("MISSING_BODY");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PUBLICATION_BYTES) {
        await reader.cancel();
        throw new Error("PUBLICATION_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
