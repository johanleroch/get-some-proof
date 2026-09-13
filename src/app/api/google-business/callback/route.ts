import { fetchAuthAction } from "@/lib/auth-server";
import { api } from "@convex/_generated/api";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const state = params.get("state");
  const code = params.get("code");
  if (!state || !code || params.has("error"))
    return new Response(
      "Google connection was not completed. Return to your Project and connect again.",
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    );
  try {
    const slug = await fetchAuthAction(api.googleBusinessActions.complete, {
      state,
      code,
    });
    return new Response(null, {
      status: 303,
      headers: {
        Location: `/org/${encodeURIComponent(slug)}/import?source=google`,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new Response(
      "Google connection could not be completed. Sign in to the same Get Some Proof account, return to your Project and connect again.",
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    );
  }
}
