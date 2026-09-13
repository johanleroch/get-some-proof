import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation } from "./_generated/server";
import { requireOrganizationPermission } from "./security/organizationAccess";
import { publishedWidgetPresentation } from "./widgets";
import { prepareDeliveryPublication } from "../src/lib/cloudflare-delivery";

const scope = {
  organizationId: v.id("organizations"),
  widgetId: v.id("widgets"),
};

function stagingConfiguration() {
  const source = process.env.CLOUDFLARE_CANARY_SOURCE_URL;
  const target = process.env.CLOUDFLARE_CANARY_DELIVERY_URL;
  const secret = process.env.CLOUDFLARE_CANARY_PUBLISH_SECRET;
  if (
    process.env.CLOUDFLARE_CANARY_ENABLED !== "true" ||
    !source ||
    source !== process.env.CONVEX_CLOUD_URL ||
    !target ||
    !secret ||
    secret.length < 32
  )
    throw new ConvexError(
      "Cloudflare canary is not configured for this source deployment.",
    );
  const url = new URL(target);
  if (
    url.protocol !== "https:" ||
    !/(^|[.-])staging([.-]|$)/.test(url.hostname) ||
    !url.hostname.endsWith(".workers.dev") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new ConvexError(
      "Cloudflare canary requires an isolated staging workers.dev origin.",
    );
  const origins = (process.env.CLOUDFLARE_CANARY_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return { target: url.origin, secret, origins };
}

/** One-shot canary reservation. Never release it after an unknown provider result. */
export const reserve = internalMutation({
  args: scope,
  returns: v.object({
    publicationId: v.id("cloudflareCanaryPublications"),
    publicId: v.string(),
    body: v.string(),
  }),
  handler: async (ctx, args) => {
    const configuration = stagingConfiguration();
    await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "ownership:manage",
    );
    const widget = await ctx.db.get(args.widgetId);
    if (!widget || widget.organizationId !== args.organizationId)
      throw new ConvexError("Widget not found.");
    if (
      await ctx.db
        .query("cloudflareCanaryPublications")
        .withIndex("by_publicId", (q) => q.eq("publicId", widget.publicId))
        .unique()
    )
      throw new ConvexError(
        "This canary already has a publication reservation; automatic retries and replacement are disabled.",
      );
    const value = await publishedWidgetPresentation(ctx, widget.publicId);
    if (!value)
      throw new ConvexError(
        "Publish the existing Widget before exporting it to the canary.",
      );
    const now = Date.now();
    const envelope = prepareDeliveryPublication(value, {
      publicId: widget.publicId,
      revision: widget.revision,
      policyRevision: value.privacyRevision,
      generatedAt: now,
      validUntil: now + 24 * 60 * 60 * 1000,
      allowedOrigins: configuration.origins,
    });
    const body = JSON.stringify(envelope);
    const publicationId = await ctx.db.insert("cloudflareCanaryPublications", {
      publicId: widget.publicId,
      organizationId: args.organizationId,
      widgetId: widget._id,
      revision: widget.revision,
      generatedAt: now,
      validUntil: envelope.validUntil,
      status: "reserved",
    });
    return { publicationId, publicId: widget.publicId, body };
  },
});

export const complete = internalMutation({
  args: { publicationId: v.id("cloudflareCanaryPublications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.publicationId, { status: "published" });
    return null;
  },
});

export const publish = action({
  args: scope,
  returns: v.object({ publicId: v.string(), status: v.literal("published") }),
  handler: async (
    ctx,
    args,
  ): Promise<{ publicId: string; status: "published" }> => {
    const { target, secret } = stagingConfiguration();
    const reservation = await ctx.runMutation(
      internal.cloudflarePublication.reserve,
      args,
    );
    let response: Response;
    try {
      response = await fetch(`${target}/__publish/${reservation.publicId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: reservation.body,
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ConvexError(
        "Canary delivery result is unknown; reservation retained and retry disabled.",
      );
    }
    if (!response.ok)
      throw new ConvexError(
        "Canary delivery did not confirm publication; reservation retained and retry disabled.",
      );
    await ctx.runMutation(internal.cloudflarePublication.complete, {
      publicationId: reservation.publicationId,
    });
    return { publicId: reservation.publicId, status: "published" };
  },
});
