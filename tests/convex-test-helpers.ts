import rateLimiterTest from "@convex-dev/rate-limiter/test";
import authzTest from "@djpanda/convex-authz/test";
import betterAuthSchema from "../convex/betterAuth/schema";
import { convexTest } from "convex-test";
import workflowTest from "@convex-dev/workflow/test";
import migrationsTest from "@convex-dev/migrations/test";

import { components, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { ImageAssetMetadataValue } from "../convex/domain/imageAsset";
import {
  authzForOrganization,
  type OrganizationRole,
} from "../convex/authorization";
import schema from "../convex/schema";
import stripeTestSchema from "./stripe-test-component/schema";

const modules = import.meta.glob("../convex/**/*.*s");
const stripeTestModules = import.meta.glob("./stripe-test-component/**/*.*s");
const betterAuthModules = import.meta.glob("../convex/betterAuth/**/*.*s");

export function createConvexTest() {
  const t = convexTest(schema, modules);
  t.registerComponent("betterAuth", betterAuthSchema, betterAuthModules);
  authzTest.register(t);
  rateLimiterTest.register(t);
  workflowTest.register(t);
  migrationsTest.register(t);
  t.registerComponent("stripe", stripeTestSchema, stripeTestModules);
  return t;
}

export function testImageMetadata(
  kind: ImageAssetMetadataValue["kind"],
  size: number,
  overrides: Partial<ImageAssetMetadataValue> = {},
): ImageAssetMetadataValue {
  return {
    contentType: "image/webp",
    height: 128,
    kind,
    originalContentType: "image/png",
    originalSize: Math.max(size, 1),
    size,
    source: "direct",
    transformVersion: "webp-v1",
    width: 128,
    ...overrides,
  };
}

export async function testPngBytes(
  width = 32,
  height = 24,
): Promise<Uint8Array> {
  const { default: sharp } = await import("sharp");
  return new Uint8Array(
    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 34, g: 126, b: 214, alpha: 0.8 },
      },
    })
      .png()
      .toBuffer(),
  );
}

export async function addStripeSubscription(
  t: ReturnType<typeof createConvexTest>,
  organizationId: Id<"organizations">,
  status: string,
  {
    priceId = "price_pro_monthly",
    cancelAtPeriodEnd = false,
    currentPeriodEnd = Math.floor(Date.now() / 1_000) + 1_728_000,
    eventCreated = Math.floor(Date.now() / 1_000),
    statusChangedAt = eventCreated,
    stripeSubscriptionId = `sub_${organizationId}`,
    eventId = `evt_${stripeSubscriptionId}_${status}_${eventCreated}`,
  }: {
    priceId?: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: number;
    eventCreated?: number;
    eventId?: string;
    statusChangedAt?: number;
    stripeSubscriptionId?: string;
  } = {},
) {
  await t.mutation(components.stripe.private.handleSubscriptionCreated, {
    cancelAtPeriodEnd,
    currentPeriodEnd,
    metadata: {
      lookupKey: priceId === "price_pro_annual" ? "pro_annual" : "pro_monthly",
      orgId: organizationId,
    },
    priceId,
    quantity: 1,
    status,
    stripeCustomerId: `cus_${organizationId}`,
    stripeSubscriptionId,
  });
  await t.mutation(internal.stripeWebhookSync.applySubscriptionEvent, {
    cancelAtPeriodEnd,
    currentPeriodEnd,
    eventCreated,
    eventId,
    eventType: "customer.subscription.updated",
    organizationId: String(organizationId),
    priceId,
    status,
    statusChangedAt,
    stripeCustomerId: `cus_${organizationId}`,
    stripeSubscriptionId,
  });
  await t.run(async (ctx) => {
    const profile = await ctx.db
      .query("billingProfiles")
      .withIndex("by_organization", (index) =>
        index.eq("organizationId", organizationId),
      )
      .unique();
    if (!profile) throw new Error("Billing profile unavailable in test.");
    await ctx.db.patch(profile._id, {
      expectedProPriceId: priceId,
      stripeCustomerId: `cus_${organizationId}`,
    });
  });
}

export async function authenticatedUser(
  t: ReturnType<typeof createConvexTest>,
  {
    email = "alice@example.com",
    emailVerified = true,
    name = "Alice Owner",
  }: { email?: string; emailVerified?: boolean; name?: string } = {},
) {
  const now = Date.now();
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "user",
      data: {
        name,
        email,
        emailVerified,
        createdAt: now,
        updatedAt: now,
      },
    },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "session",
      data: {
        userId: String(user._id),
        token: `test-session-token-${email}`,
        expiresAt: now + 60_000,
        createdAt: now,
        updatedAt: now,
      },
    },
  });

  return {
    actorId: String(user._id),
    sessionId: String(session._id),
    client: t.withIdentity({
      subject: String(user._id),
      sessionId: String(session._id),
      tokenIdentifier: `test|${String(user._id)}`,
      email,
      emailVerified,
      name,
    }),
  };
}

export async function addMemberWithRole(
  t: ReturnType<typeof createConvexTest>,
  organizationId: Id<"organizations">,
  actorId: string,
  role: OrganizationRole,
  status: "active" | "inactive" = "active",
  profile?: { displayName: string; email: string },
) {
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("memberships", {
      organizationId,
      userId: actorId,
      displayName: profile?.displayName,
      email: profile?.email,
      status,
      createdAt: now,
      updatedAt: now,
      deactivatedAt: status === "inactive" ? now : undefined,
    });
    await authzForOrganization(organizationId).assignRole(
      ctx,
      actorId,
      role,
      undefined,
      undefined,
      actorId,
    );
  });
}

const uploadAdmissions = new WeakMap<
  ReturnType<typeof createConvexTest>,
  Map<string, Promise<string>>
>();

// Fixture setup at the trusted issuer seam; public verification is tested separately.
export async function admittedUpload<
  T extends { publicSlug: string; clientSubmissionId: string; token?: string },
>(t: ReturnType<typeof createConvexTest>, args: T, fresh = false) {
  if (args.token !== undefined) return { ...args, admissionToken: undefined };
  let admissions = uploadAdmissions.get(t);
  if (!admissions) {
    admissions = new Map();
    uploadAdmissions.set(t, admissions);
  }
  const key = `${args.publicSlug}:${args.clientSubmissionId}`;
  if (fresh || !admissions.has(key))
    admissions.set(
      key,
      (async () => {
        const {
          hashSubmissionManagementToken,
          randomSubmissionManagementToken,
        } = await import("../convex/domain/submission");
        const token = randomSubmissionManagementToken();
        await t.mutation(internal.collectionAdmission.issue, {
          publicSlug: args.publicSlug,
          clientSubmissionId: args.clientSubmissionId,
          tokenHash: await hashSubmissionManagementToken(token),
        });
        return token;
      })(),
    );
  return { ...args, admissionToken: await admissions.get(key)! };
}
