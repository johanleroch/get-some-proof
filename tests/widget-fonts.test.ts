import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "@convex/_generated/api";
import {
  authenticatedUser,
  createConvexTest,
  addStripeSubscription,
} from "./convex-test-helpers";

const file = readFileSync("src/components/chatgpt/fonts/figtree-0.woff2");
const bytes = new Uint8Array(file).buffer;
const config = {
  layout: "masonry" as const,
  font: "sans" as const,
  accentColor: "#123abc",
  backgroundColor: "#ffffff",
  textColor: "#222222",
};
const secret = "widget-font-test-credential-32-characters";
beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_widget_fonts";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_widget_fonts";
  process.env.PUBLIC_READ_RATE_LIMIT_SECRET = secret;
});
async function setup(pro = true) {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const brand = await owner.client.mutation(api.organizations.create, {
    name: "Fernhill Studio",
    publicSlug: "fernhill-fonts",
  });
  if (pro) await addStripeSubscription(t, brand.id, "active");
  return { t, owner, brand };
}

describe("Custom widget fonts", () => {
  it("requires Pro before storing any bytes and rejects malformed fonts", async () => {
    const s = await setup(false);
    const args = { organizationId: s.brand.id, name: "Figtree", bytes };
    await expect(
      s.owner.client.action(api.widgetFonts.upload, args),
    ).rejects.toThrow("require Pro");
    await addStripeSubscription(s.t, s.brand.id, "active");
    await expect(
      s.owner.client.action(api.widgetFonts.upload, {
        ...args,
        bytes: new ArrayBuffer(60),
      }),
    ).rejects.toThrow("WOFF2");
    expect(
      (
        await s.owner.client.query(api.widgetFonts.list, {
          organizationId: s.brand.id,
        })
      ).fonts,
    ).toEqual([]);
  });
  it("uploads reusable fonts, enforces project isolation and protects referenced files", async () => {
    const s = await setup();
    const fontId = await s.owner.client.action(api.widgetFonts.upload, {
      organizationId: s.brand.id,
      name: "Figtree",
      bytes,
    });
    const library = await s.owner.client.query(api.widgetFonts.list, {
      organizationId: s.brand.id,
    });
    expect(library.canUpload).toBe(true);
    expect(library.fonts[0]).toMatchObject({
      id: fontId,
      name: "Figtree",
      url: expect.any(String),
    });
    const other = await authenticatedUser(s.t, {
      email: "other-font-owner@example.com",
    });
    const otherBrand = await other.client.mutation(api.organizations.create, {
      name: "Harbor Design",
      publicSlug: "harbor-fonts",
    });
    await addStripeSubscription(s.t, otherBrand.id, "active");
    await expect(
      other.client.mutation(api.widgets.create, {
        organizationId: otherBrand.id,
        name: "Foreign font",
        config: { ...config, customFontId: fontId },
      }),
    ).rejects.toThrow("this project");
    await expect(
      other.client.mutation(api.widgetFonts.remove, {
        organizationId: otherBrand.id,
        fontId,
      }),
    ).rejects.toThrow("unavailable");
    const widgetId = await s.owner.client.mutation(api.widgets.create, {
      organizationId: s.brand.id,
      name: "Homepage",
      config: { ...config, customFontId: fontId },
    });
    await expect(
      s.owner.client.mutation(api.widgetFonts.remove, {
        organizationId: s.brand.id,
        fontId,
      }),
    ).rejects.toThrow("widgets using this font");
    await s.owner.client.mutation(api.widgets.remove, {
      organizationId: s.brand.id,
      widgetId,
    });
    const asset = await s.t.run((ctx) => ctx.db.get(fontId));
    await s.owner.client.mutation(api.widgetFonts.remove, {
      organizationId: s.brand.id,
      fontId,
    });
    expect(await s.t.run((ctx) => ctx.db.get(fontId))).toBeNull();
    expect(
      await s.t.run((ctx) => ctx.storage.getUrl(asset!.storageId)),
    ).toBeNull();
  });
  it("gates Google Fonts on Pro and suppresses them after downgrade", async () => {
    const s = await setup(false);
    const args = {
      organizationId: s.brand.id,
      name: "Google font widget",
      config: { ...config, googleFont: "Figtree" },
    };
    await expect(
      s.owner.client.mutation(api.widgets.create, args),
    ).rejects.toThrow("require Pro");
    await addStripeSubscription(s.t, s.brand.id, "active");
    await expect(
      s.owner.client.mutation(api.widgets.create, {
        ...args,
        config: { ...config, googleFont: "Unlisted remote font" },
      }),
    ).rejects.toThrow("Google Fonts");
    const widgetId = await s.owner.client.mutation(api.widgets.create, args);
    await s.t.run(async (ctx) => {
      const widget = await ctx.db.get(widgetId);
      await ctx.db.patch(widgetId, { published: widget!.draft });
    });
    const widget = await s.t.run((ctx) => ctx.db.get(widgetId));
    expect(
      (
        await s.t.query(api.widgets.getPublished, {
          publicId: widget!.publicId,
          secret,
        })
      )?.googleFont,
    ).toBe("Figtree");
    await addStripeSubscription(s.t, s.brand.id, "canceled", {
      eventCreated: Math.floor(Date.now() / 1000) + 1,
    });
    expect(
      (
        await s.t.query(api.widgets.getPublished, {
          publicId: widget!.publicId,
          secret,
        })
      )?.googleFont,
    ).toBeNull();
  });

  it("caps the library at five fonts even during concurrent uploads", async () => {
    const s = await setup();
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, index) =>
        s.owner.client.action(api.widgetFonts.upload, {
          organizationId: s.brand.id,
          name: `Font ${index + 1}`,
          bytes,
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(5);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(
      (
        await s.owner.client.query(api.widgetFonts.list, {
          organizationId: s.brand.id,
        })
      ).fonts,
    ).toHaveLength(5);
  });

  it("stops serving the font after downgrade and removes its file on project deletion", async () => {
    const s = await setup();
    const fontId = await s.owner.client.action(api.widgetFonts.upload, {
      organizationId: s.brand.id,
      name: "Figtree",
      bytes,
    });
    const widgetId = await s.owner.client.mutation(api.widgets.create, {
      organizationId: s.brand.id,
      name: "Homepage",
      config: { ...config, customFontId: fontId },
    });
    // No testimonials are needed to exercise font hydration and entitlement.
    await s.t.run(async (ctx) => {
      const widget = await ctx.db.get(widgetId);
      await ctx.db.patch(widgetId, { published: widget!.draft });
    });
    const widget = await s.t.run((ctx) => ctx.db.get(widgetId));
    const before = await s.t.query(api.widgets.getPublished, {
      publicId: widget!.publicId,
      secret,
    });
    expect(before?.customFont?.id).toBe(fontId);
    await addStripeSubscription(s.t, s.brand.id, "canceled", {
      eventCreated: Math.floor(Date.now() / 1000) + 1,
    });
    const after = await s.t.query(api.widgets.getPublished, {
      publicId: widget!.publicId,
      secret,
    });
    expect(after?.customFont).toBeNull();
    const asset = await s.t.run((ctx) => ctx.db.get(fontId));
    const { deletionId } = await s.owner.client.mutation(
      internal.workspaceDeletion.prepare,
      {
        organizationId: s.brand.id,
        brandName: "Fernhill Studio",
        irreversibleConfirmed: true,
      },
    );
    while (
      !(await s.t.mutation(internal.workspaceDeletionInventory.advance, {
        deletionId,
      }))
    ) {
      /* Drain bounded inventory. */
    }
    await s.t.run((ctx) => ctx.db.patch(deletionId, { phase: "importItems" }));
    for (let i = 0; i < 80; i++) {
      const result = await s.t.mutation(internal.workspaceDeletion.purgeBatch, {
        deletionId,
      });
      if (result) break;
    }
    expect(await s.t.run((ctx) => ctx.db.get(fontId))).toBeNull();
    expect(
      await s.t.run((ctx) => ctx.storage.getUrl(asset!.storageId)),
    ).toBeNull();
  });
});
