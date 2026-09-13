import { deliveryResponse } from "./worker";
import { publicationResponse } from "./publication";
export default {
  async fetch(request, env) {
    const origins = env.ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    const url = new URL(request.url);
    let response: Response;
    if (
      url.pathname.startsWith("/__publish/") &&
      ["local", "staging"].includes(env.ENVIRONMENT)
    ) {
      response = await publicationResponse(
        request,
        env.PUBLICATIONS,
        env.CLOUDFLARE_CANARY_PUBLISH_SECRET ?? "",
        origins,
      );
    } else if (!origins.includes(request.headers.get("Origin") ?? "")) {
      response = new Response(null, {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      });
    } else {
      response = await deliveryResponse(request, env.PUBLICATIONS);
    }
    console.log(
      JSON.stringify({
        event: "canary_delivery",
        route: url.pathname.startsWith("/__publish/")
          ? "publication"
          : "widget",
        status: response.status,
      }),
    );
    return response;
  },
} satisfies ExportedHandler<Env>;
