import { expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  parseGooglePush,
  verifyGooglePushIdentity,
} from "./googleBusinessPush";

it("accepts signed Google identity only for the configured audience and verified push account", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const keys = createLocalJWKSet({
    keys: [
      { ...(await exportJWK(publicKey)), kid: "google-test", alg: "RS256" },
    ],
  });
  const settings = {
    audience: "https://example.convex.site/google-business/pubsub",
    serviceAccountEmail: "push@proof-test.iam.gserviceaccount.com",
  };
  const sign = (
    email = settings.serviceAccountEmail,
    verified = true,
    expires = "1h",
  ) =>
    new SignJWT({ email, email_verified: verified })
      .setProtectedHeader({ alg: "RS256", kid: "google-test" })
      .setIssuer("https://accounts.google.com")
      .setAudience(settings.audience)
      .setSubject("1234")
      .setIssuedAt()
      .setExpirationTime(expires)
      .sign(privateKey);
  const valid = await sign();
  await expect(
    verifyGooglePushIdentity(valid, settings, keys),
  ).resolves.toBeUndefined();
  await expect(
    verifyGooglePushIdentity(
      valid,
      { ...settings, audience: "https://another.example" },
      keys,
    ),
  ).rejects.toThrow();
  await expect(
    verifyGooglePushIdentity(
      await sign("attacker@example.com"),
      settings,
      keys,
    ),
  ).rejects.toThrow();
  await expect(
    verifyGooglePushIdentity(
      await sign(settings.serviceAccountEmail, false),
      settings,
      keys,
    ),
  ).rejects.toThrow();
  await expect(
    verifyGooglePushIdentity(
      await sign(settings.serviceAccountEmail, true, "-2m"),
      settings,
      keys,
    ),
  ).rejects.toThrow();
  const parts = valid.split(".");
  parts[1] = Buffer.from(
    JSON.stringify({ email: settings.serviceAccountEmail }),
  ).toString("base64url");
  await expect(
    verifyGooglePushIdentity(parts.join("."), settings, keys),
  ).rejects.toThrow();
});

it("parses review notifications, isolates subscriptions and rejects mismatched locations", () => {
  const subscription = "projects/proof-test/subscriptions/reviews";
  const event = {
    notificationType: "NEW_REVIEW",
    locationName: "accounts/12/locations/34",
    reviewName: "accounts/12/locations/34/reviews/abc",
  };
  const body = (data: unknown, sub = subscription) =>
    JSON.stringify({
      subscription: sub,
      message: {
        messageId: "123",
        publishTime: new Date().toISOString(),
        data: Buffer.from(JSON.stringify(data)).toString("base64"),
      },
    });
  expect(parseGooglePush(body(event), subscription)).toMatchObject({
    messageId: "123",
    account: "accounts/12",
    location: "locations/34",
  });
  expect(
    parseGooglePush(
      body({
        notification_type: "UPDATED_REVIEW",
        location_name: "locations/34",
        review_name: event.reviewName,
      }),
      subscription,
    ),
  ).toMatchObject({ location: "locations/34" });
  expect(() =>
    parseGooglePush(
      body(event, "projects/other/subscriptions/reviews"),
      subscription,
    ),
  ).toThrow();
  expect(() =>
    parseGooglePush(
      body({ ...event, locationName: "locations/99" }),
      subscription,
    ),
  ).toThrow();
  expect(
    parseGooglePush(body({ notificationType: "GOOGLE_UPDATE" }), subscription),
  ).toBeNull();
  expect(() => parseGooglePush("{}", subscription)).toThrow();
});
