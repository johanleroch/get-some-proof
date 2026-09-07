import { z } from "zod";

// Cloud Convex deployments are always served over HTTPS. The only accepted
// plain-HTTP origins are loopback hosts, which is where `npx convex dev`
// runs an anonymous local backend (for example http://127.0.0.1:3210).
const loopbackHostnames = new Set(["127.0.0.1", "localhost", "[::1]"]);

function isConvexDeploymentUrl(value: string): boolean {
  const url = new URL(value);

  if (url.protocol === "https:") {
    return true;
  }

  return url.protocol === "http:" && loopbackHostnames.has(url.hostname);
}

const convexDeploymentUrlSchema = z.url().refine(isConvexDeploymentUrl, {
  message:
    "Convex URLs must use https://, except http:// on a loopback host for a local backend.",
});

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: convexDeploymentUrlSchema,
  NEXT_PUBLIC_CONVEX_SITE_URL: convexDeploymentUrlSchema,
  NEXT_PUBLIC_SITE_URL: z.url(),
});

type PublicEnvironmentInput = Record<string, string | undefined>;

export type PublicEnvironment =
  | {
      configured: true;
      convexUrl: string;
      convexSiteUrl: string;
      siteUrl: string;
    }
  | {
      configured: false;
      missing: string[];
    };

export function readPublicEnvironment(
  environment: PublicEnvironmentInput,
): PublicEnvironment {
  const result = publicEnvironmentSchema.safeParse(environment);

  if (result.success) {
    return {
      configured: true,
      convexUrl: result.data.NEXT_PUBLIC_CONVEX_URL,
      convexSiteUrl: result.data.NEXT_PUBLIC_CONVEX_SITE_URL,
      siteUrl: result.data.NEXT_PUBLIC_SITE_URL,
    };
  }

  return {
    configured: false,
    missing: result.error.issues.map((issue) => issue.path.join(".")),
  };
}

export function getPublicEnvironment(): PublicEnvironment {
  return readPublicEnvironment({
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
}
