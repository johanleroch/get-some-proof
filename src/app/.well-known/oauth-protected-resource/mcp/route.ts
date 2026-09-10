import {
  importOAuthBasePath,
  importOAuthScope,
  assistantOAuthScope,
} from "@convex/importOAuthOptions";

export function GET() {
  const headers = { "Cache-Control": "no-store" };
  if (process.env.CHATGPT_IMPORT_ENABLED !== "true")
    return new Response(null, { status: 404, headers });
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!configuredOrigin) return new Response(null, { status: 503, headers });
  const origin = new URL(configuredOrigin).origin;
  return Response.json(
    {
      resource: `${origin}/mcp`,
      authorization_servers: [`${origin}${importOAuthBasePath}`],
      scopes_supported: [importOAuthScope, assistantOAuthScope],
      bearer_methods_supported: ["header"],
    },
    { headers },
  );
}
