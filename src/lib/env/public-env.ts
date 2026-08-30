import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_CONVEX_URL: z.url().startsWith("https://"),
  NEXT_PUBLIC_CONVEX_SITE_URL: z.url().startsWith("https://"),
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
