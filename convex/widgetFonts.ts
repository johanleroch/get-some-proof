import { ConvexError, v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireOrganizationPermission } from "./security/organizationAccess";
import { getOrganizationBillingEntitlement } from "./billingEntitlements";
import { MAX_PROJECT_FONTS, validateWidgetFont } from "./domain/widgetFont";
import { MAX_WIDGETS, type WidgetConfig } from "./domain/widgets";
import { googleFontFamilies } from "./domain/googleFontFamilies";
const googleFonts = new Set(googleFontFamilies);

const scope = { organizationId: v.id("organizations") };
async function requireUploadAccess(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
) {
  await requireOrganizationPermission(
    ctx,
    { organizationId },
    "ownership:manage",
  );
  const entitlement = await getOrganizationBillingEntitlement(
    ctx,
    organizationId,
  );
  if (entitlement.effectivePlan !== "premium")
    throw new ConvexError({
      code: "PREMIUM_REQUIRED",
      message: "Custom fonts and Google Fonts require Pro.",
    });
  const fonts = await ctx.db
    .query("widgetFonts")
    .withIndex("by_organizationId", (q) =>
      q.eq("organizationId", organizationId),
    )
    .take(MAX_PROJECT_FONTS);
  if (fonts.length >= MAX_PROJECT_FONTS)
    throw new ConvexError({
      code: "FONT_LIMIT",
      message: "This project already has 5 fonts. Remove an unused font first.",
    });
}

export async function requireWidgetFontAccess(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  config: WidgetConfig,
) {
  if (!config.customFontId && !config.googleFont) return;
  if (config.customFontId && config.googleFont)
    throw new ConvexError({
      code: "INVALID_FONT",
      message: "Choose one font source.",
    });
  if (config.googleFont && !googleFonts.has(config.googleFont))
    throw new ConvexError({
      code: "INVALID_FONT",
      message: "Choose a font from Google Fonts.",
    });
  if (config.customFontId) {
    const font = await ctx.db.get(config.customFontId);
    if (!font || font.organizationId !== organizationId)
      throw new ConvexError({
        code: "INVALID_FONT",
        message: "Choose a font from this project.",
      });
  }
  const entitlement = await getOrganizationBillingEntitlement(
    ctx,
    organizationId,
  );
  if (entitlement.effectivePlan !== "premium")
    throw new ConvexError({
      code: "PREMIUM_REQUIRED",
      message: "Custom fonts and Google Fonts require Pro.",
    });
}

export const list = query({
  args: scope,
  returns: v.object({
    canUpload: v.boolean(),
    fonts: v.array(
      v.object({
        id: v.id("widgetFonts"),
        name: v.string(),
        url: v.union(v.string(), v.null()),
      }),
    ),
  }),
  handler: async (ctx, { organizationId }) => {
    await requireOrganizationPermission(
      ctx,
      { organizationId },
      "organization:read",
    );
    const entitlement = await getOrganizationBillingEntitlement(
      ctx,
      organizationId,
    );
    const canUpload = entitlement.effectivePlan === "premium";
    const fonts = await ctx.db
      .query("widgetFonts")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", organizationId),
      )
      .take(MAX_PROJECT_FONTS);
    return {
      canUpload,
      fonts: await Promise.all(
        fonts.map(async (font) => ({
          id: font._id,
          name: font.name,
          url: canUpload ? await ctx.storage.getUrl(font.storageId) : null,
        })),
      ),
    };
  },
});
export const authorizeUpload = internalQuery({
  args: scope,
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireUploadAccess(ctx, args.organizationId);
    return null;
  },
});
export const attach = internalMutation({
  args: { ...scope, name: v.string(), storageId: v.id("_storage") },
  returns: v.id("widgetFonts"),
  handler: async (ctx, args) => {
    await requireUploadAccess(ctx, args.organizationId);
    return await ctx.db.insert("widgetFonts", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
export const upload = action({
  args: { ...scope, name: v.string(), bytes: v.bytes() },
  returns: v.id("widgetFonts"),
  handler: async (ctx, args): Promise<Id<"widgetFonts">> => {
    await ctx.runQuery(internal.widgetFonts.authorizeUpload, {
      organizationId: args.organizationId,
    });
    const name = validateWidgetFont(args.bytes, args.name);
    const storageId = await ctx.storage.store(
      new Blob([args.bytes], { type: "font/woff2" }),
    );
    try {
      return await ctx.runMutation(internal.widgetFonts.attach, {
        organizationId: args.organizationId,
        name,
        storageId,
      });
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
  },
});
export const remove = mutation({
  args: { ...scope, fontId: v.id("widgetFonts") },
  returns: v.null(),
  handler: async (ctx, { organizationId, fontId }) => {
    await requireOrganizationPermission(
      ctx,
      { organizationId },
      "ownership:manage",
    );
    const font = await ctx.db.get(fontId);
    if (!font || font.organizationId !== organizationId)
      throw new ConvexError("Font unavailable.");
    const widgets = await ctx.db
      .query("widgets")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", organizationId),
      )
      .take(MAX_WIDGETS);
    if (
      widgets.some(
        (widget) =>
          widget.draft.config.customFontId === fontId ||
          widget.published?.config.customFontId === fontId,
      )
    )
      throw new ConvexError({
        code: "FONT_IN_USE",
        message:
          "Choose another font in the widgets using this font, then publish those changes before removing it.",
      });
    await ctx.storage.delete(font.storageId);
    await ctx.db.delete(fontId);
    return null;
  },
});
