import {
  isKnownScreenSlug,
  isScreenStatus,
  screenSections,
} from "@/lib/screens-catalog";
import { writeScreenStatus } from "@/lib/screens-status";

const headers = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { headers, status });
}

// Development-only: records a screen's review status for the /screens gallery.
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const slug =
    typeof body === "object" && body !== null && "slug" in body
      ? body.slug
      : undefined;
  const status =
    typeof body === "object" && body !== null && "status" in body
      ? body.status
      : undefined;

  if (typeof slug !== "string" || !isKnownScreenSlug(slug, screenSections)) {
    return json({ error: "Unknown screen." }, 400);
  }
  if (status !== null && !isScreenStatus(status)) {
    return json({ error: "Status must be todo, ok, or null." }, 400);
  }

  return json({ statuses: await writeScreenStatus(slug, status) }, 200);
}
