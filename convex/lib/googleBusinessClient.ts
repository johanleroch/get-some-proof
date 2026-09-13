"use node";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ConvexError } from "convex/values";
import { z } from "zod";
import { env } from "../_generated/server";

export function failure(message: string): never {
  throw new ConvexError({ code: "GOOGLE_BUSINESS_UNAVAILABLE", message });
}
export function config() {
  const clientId = env.GOOGLE_BUSINESS_CLIENT_ID;
  const clientSecret = env.GOOGLE_BUSINESS_CLIENT_SECRET;
  const redirectUri = env.GOOGLE_BUSINESS_REDIRECT_URI;
  const key = Buffer.from(env.GOOGLE_BUSINESS_ENCRYPTION_KEY ?? "", "base64");
  if (!clientId || !clientSecret || !redirectUri || key.length !== 32)
    failure("Google Business Profile is not configured yet.");
  const redirect = new URL(redirectUri);
  if (
    redirect.protocol !== "https:" &&
    !(redirect.protocol === "http:" && redirect.hostname === "localhost")
  )
    failure("Google callback configuration is invalid.");
  return { clientId, clientSecret, redirectUri, key };
}
export function encrypt(value: string, organizationId: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config().key, nonce);
  cipher.setAAD(Buffer.from(organizationId));
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), data]).toString("base64");
}
export function decrypt(value: string, organizationId: string) {
  try {
    const data = Buffer.from(value, "base64");
    const cipher = createDecipheriv(
      "aes-256-gcm",
      config().key,
      data.subarray(0, 12),
    );
    cipher.setAAD(Buffer.from(organizationId));
    cipher.setAuthTag(data.subarray(12, 28));
    return Buffer.concat([
      cipher.update(data.subarray(28)),
      cipher.final(),
    ]).toString("utf8");
  } catch {
    return failure("Google credentials cannot be read. Connect again.");
  }
}
export async function request(url: string, init: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return failure("Google did not respond. Try again.");
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 400)
      failure(
        "Google authorization expired or this request is unavailable. Connect again and choose a verified location.",
      );
    if (response.status === 403)
      failure(
        "Google refused access. Check API approval and your access to this verified business location.",
      );
    if (response.status === 429)
      failure("Google's request limit was reached. Try again later.");
    failure("Google is unavailable. Try again later.");
  }
  try {
    return (await response.json()) as unknown;
  } catch {
    return failure("Google returned an unreadable response. Try again.");
  }
}
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});
export async function token(fields: Record<string, string>) {
  const { clientId, clientSecret } = config();
  const result = tokenSchema.safeParse(
    await request("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        ...fields,
      }).toString(),
    }),
  );
  if (!result.success)
    failure("Google did not return authorization. Connect again.");
  return result.data;
}
