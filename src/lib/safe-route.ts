import type { Route } from "next";

export function safeInternalRoute(
  candidate: string | null,
  fallback: Route,
): Route {
  if (!candidate?.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  return candidate as Route;
}
