"use node";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";

const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
  { timeoutDuration: 5000 },
);

export async function verifyGooglePushIdentity(
  jwt: string,
  settings: { audience: string; serviceAccountEmail: string },
  keys: JWTVerifyGetKey = googleKeys,
) {
  const { payload } = await jwtVerify(jwt, keys, {
    algorithms: ["RS256"],
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: settings.audience,
    requiredClaims: ["exp", "iat", "sub"],
    maxTokenAge: "1h",
    clockTolerance: 30,
  });
  if (
    payload.email !== settings.serviceAccountEmail ||
    payload.email_verified !== true
  )
    throw new Error("Invalid push identity");
}

const envelopeSchema = z.object({
  subscription: z.string(),
  message: z.object({
    messageId: z.string().min(1).max(128),
    publishTime: z.iso.datetime({ offset: true }),
    data: z
      .string()
      .min(1)
      .max(16000)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/),
  }),
});
const notificationSchema = z.object({
  notificationType: z.string().optional(),
  notification_type: z.string().optional(),
  type: z.string().optional(),
  reviewName: z.string().max(1024).optional(),
  review_name: z.string().max(1024).optional(),
  locationName: z.string().max(256).optional(),
  location_name: z.string().max(256).optional(),
});

export function parseGooglePush(body: string, subscription: string) {
  const envelope = envelopeSchema.parse(JSON.parse(body));
  if (envelope.subscription !== subscription)
    throw new Error("Unexpected subscription");
  const publishedAt = Date.parse(envelope.message.publishTime);
  if (publishedAt > Date.now() + 5 * 60_000)
    throw new Error("Invalid publication time");
  const notification = notificationSchema.parse(
    JSON.parse(Buffer.from(envelope.message.data, "base64").toString("utf8")),
  );
  const type =
    notification.notificationType ??
    notification.notification_type ??
    notification.type;
  if (!type) throw new Error("Missing notification type");
  if (type !== "NEW_REVIEW" && type !== "UPDATED_REVIEW") return null;
  const reviewName = notification.reviewName ?? notification.review_name ?? "";
  const match =
    /^accounts\/([0-9]+)\/locations\/([0-9]+)\/reviews\/[^/?#\s]+$/.exec(
      reviewName,
    );
  if (!match) throw new Error("Invalid review resource");
  const account = `accounts/${match[1]}`;
  const location = `locations/${match[2]}`;
  const notifiedLocation =
    notification.locationName ?? notification.location_name;
  if (
    notifiedLocation !== location &&
    notifiedLocation !== `${account}/${location}`
  )
    throw new Error("Mismatched location");
  return {
    messageId: envelope.message.messageId,
    account,
    location,
    publishedAt,
  };
}
