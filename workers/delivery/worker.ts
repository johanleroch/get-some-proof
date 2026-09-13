import { parseDeliveryPublication } from "../../src/lib/cloudflare-delivery";

type PublicationReader = { get(key: string): Promise<string | null> };
export async function deliveryResponse(
  request: Request,
  publications: PublicationReader,
) {
  const url = new URL(request.url);
  const match =
    /^\/api\/widgets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(
      url.pathname,
    );
  if (!match || url.search || request.method !== "GET") return unavailable(400);
  const origin = request.headers.get("Origin");
  if (!origin || origin === "null") return unavailable(403);
  const id = match[1];
  try {
    const raw = await publications.get(`widget:${id}`);
    if (!raw) return unavailable(404);
    const publication = parseDeliveryPublication(raw);
    const now = Date.now();
    if (
      publication.schemaVersion !== 1 ||
      publication.surface !== "widget" ||
      publication.publicId !== id ||
      !Number.isSafeInteger(publication.generatedAt) ||
      !Number.isSafeInteger(publication.validUntil) ||
      publication.generatedAt > now ||
      publication.validUntil <= now ||
      publication.validUntil > publication.generatedAt + 86400000
    )
      return unavailable(503);
    if (!publication.allowedOrigins.includes(origin)) return unavailable(403);
    return Response.json(publication.payload, {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": origin,
        Vary: "Origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return unavailable(503);
  }
}

function unavailable(status: number) {
  return Response.json(
    { message: "Widget unavailable." },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
