import { ConvexError } from "convex/values";

export function requirePublicWallServer(secret: string | undefined) {
  const expected = process.env.PUBLIC_READ_RATE_LIMIT_SECRET;
  if (!expected || expected.length < 32 || secret !== expected) {
    throw new ConvexError({
      code: "PUBLIC_WALL_UNAUTHORIZED",
      message: "Public Wall unavailable.",
    });
  }
}

export function validPublicWallSlug(slug: string) {
  return (
    slug.length >= 2 &&
    slug.length <= 48 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  );
}
