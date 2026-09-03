import { ConvexError, v } from "convex/values";

export type InvitationRole = "admin" | "editor" | "viewer";

export const invitationRoleValidator = v.union(
  v.literal("admin"),
  v.literal("editor"),
  v.literal("viewer"),
);

export const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1_000;

export function normalizeInvitationEmail(email: string) {
  const normalized = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new ConvexError({
      code: "INVALID_INVITATION_EMAIL",
      message: "Enter a valid email address.",
    });
  }

  return normalized;
}

export async function hashInvitationToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function randomInvitationToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function invitationUnavailable(): never {
  throw new ConvexError({
    code: "INVITATION_UNAVAILABLE",
    message: "Invitation unavailable.",
  });
}
