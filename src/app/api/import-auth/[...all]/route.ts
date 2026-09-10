import { handler } from "@/lib/auth-server";

export const POST = handler.POST;

export async function GET(request: Request) {
  const response = await handler.GET(request);
  // The server-side fetch marks the upstream request as a fetch (cors), so
  // Better Auth returns a redirect envelope even for browser navigation.
  // Restore HTTP navigation without changing JSON responses used by clients.
  if (
    new URL(request.url).pathname === "/api/import-auth/oauth2/authorize" &&
    request.headers.get("accept")?.includes("text/html") &&
    response.status === 200 &&
    response.headers.get("content-type")?.includes("application/json")
  ) {
    const result: unknown = await response.clone().json();
    if (
      result &&
      typeof result === "object" &&
      "redirect" in result &&
      result.redirect === true &&
      "url" in result &&
      typeof result.url === "string"
    ) {
      const target = new URL(result.url);
      const siteOrigin = new URL(
        process.env.NEXT_PUBLIC_SITE_URL ?? request.url,
      ).origin;
      if (target.protocol !== "https:" && target.origin !== siteOrigin)
        return new Response(null, { status: 502 });
      const headers = new Headers(response.headers);
      headers.delete("content-type");
      headers.delete("content-length");
      headers.delete("content-encoding");
      headers.set("location", target.href);
      return new Response(null, { status: 302, headers });
    }
  }
  return response;
}
