import { ConvexError } from "convex/values";

/**
 * The sentence a Convex function wrote for the Owner, when it wrote one.
 * A `ConvexError` carries it in `data` (a string, or an object with a
 * `message`); the client-side `error.message` is a generic wrapper that
 * reads like a log line, so it is never what a toast should say.
 */
export function convexErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ConvexError) {
    if (typeof error.data === "string") return error.data;
    const message = (error.data as { message?: unknown } | null)?.message;
    if (typeof message === "string") return message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

/** The code a Convex function attached to its error, when it attached one. */
export function convexErrorCode(error: unknown): string | null {
  if (!(error instanceof ConvexError)) return null;
  const code = (error.data as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
}
