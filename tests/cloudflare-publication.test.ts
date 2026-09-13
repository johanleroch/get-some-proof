import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@convex/_generated/api";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";
const config = {
  layout: "masonry" as const,
  font: "inherit" as const,
  accentColor: "#123abc",
  backgroundColor: "#ffffff",
  textColor: "#222222",
};
const secret = "widget-service-test-credential-32-characters";
beforeEach(() => {
  vi.stubEnv("CLOUDFLARE_CANARY_ENABLED", "true");
  vi.stubEnv(
    "CLOUDFLARE_CANARY_DELIVERY_URL",
    "https://proof-staging.example.workers.dev",
  );
  vi.stubEnv(
    "CLOUDFLARE_CANARY_PUBLISH_SECRET",
    "canary-test-credential-at-least-32-characters",
  );
  vi.stubEnv("CLOUDFLARE_CANARY_ORIGINS", "http://localhost:4173");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://synthetic-development.convex.cloud");
  vi.stubEnv(
    "CLOUDFLARE_CANARY_SOURCE_URL",
    "https://synthetic-development.convex.cloud",
  );
  process.env.STRIPE_SECRET_KEY = "sk_test_widgets";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_widgets";
  process.env.PUBLIC_READ_RATE_LIMIT_SECRET = secret;
});
async function setup() {
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const brand = await owner.client.mutation(api.organizations.create, {
    name: "Studio",
    primaryColor: "#123abc",
    privacyContact: "privacy@example.com",
    publicSlug: "studio-proof",
  });
  const testimonialId = await t.run(async (ctx) => {
    const now = Date.now();
    const id = await ctx.db.insert("testimonials", {
      organizationId: brand.id,
      clientSubmissionId: "one",
      submissionType: "text",
      moderationStatus: "published",
      text: "Wonderful proof",
      submitterName: "A Person",
      submitterEmail: "private@example.com",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("publicTestimonialProjections", {
      organizationId: brand.id,
      testimonialId: id,
      type: "text",
      text: "Wonderful proof",
      name: "A Person",
      publishedAt: now,
    });
    return id;
  });
  const widgetId = await owner.client.mutation(api.widgets.create, {
    organizationId: brand.id,
    name: "Homepage",
    config,
  });
  const args = { organizationId: brand.id, widgetId };
  return { t, owner, brand, testimonialId, widgetId, args };
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("Cloudflare source publication", () => {
  it("exports the existing published selection and keeps a later private draft out of delivery", async () => {
    const s = await setup();
    await s.owner.client.mutation(api.widgets.save, {
      ...s.args,
      expectedRevision: 0,
      name: "Published",
      config,
      testimonialIds: [s.testimonialId],
      publish: true,
    });
    await s.owner.client.mutation(api.widgets.save, {
      ...s.args,
      expectedRevision: 1,
      name: "Private draft",
      config: { ...config, accentColor: "#abcdef" },
      testimonialIds: [],
    });
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    const result = await s.owner.client.action(
      api.cloudflarePublication.publish,
      s.args,
    );
    expect(result.status).toBe("published");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const envelope = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(envelope).toMatchObject({
      schemaVersion: 1,
      surface: "widget",
      allowedOrigins: ["http://localhost:4173"],
      payload: {
        config,
        testimonials: [{ name: "A Person", text: "Wonderful proof" }],
      },
    });
    expect(envelope.validUntil - envelope.generatedAt).toBe(
      24 * 60 * 60 * 1000,
    );
    expect(JSON.stringify(envelope)).not.toMatch(
      /private@example.com|organizationId|Private draft|#abcdef|canary-test-credential/,
    );
  });
  it("denies unauthenticated, non-Owner and wrong-Project requests before contacting delivery", async () => {
    const s = await setup();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      s.t.action(api.cloudflarePublication.publish, s.args),
    ).rejects.toThrow();
    const other = await authenticatedUser(s.t, { email: "other@example.com" });
    await expect(
      other.client.action(api.cloudflarePublication.publish, s.args),
    ).rejects.toThrow();
    const otherBrand = await other.client.mutation(api.organizations.create, {
      name: "Other",
      primaryColor: "#123abc",
      privacyContact: "privacy@example.com",
      publicSlug: "other-proof",
    });
    await expect(
      other.client.action(api.cloudflarePublication.publish, {
        ...s.args,
        organizationId: otherBrand.id,
      }),
    ).rejects.toThrow("Widget not found");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects a draft-only Widget before contacting delivery", async () => {
    const s = await setup();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      s.owner.client.action(api.cloudflarePublication.publish, s.args),
    ).rejects.toThrow("existing Widget");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("retains its reservation after an unknown provider result and refuses concurrent or later replacement", async () => {
    const s = await setup();
    await s.owner.client.mutation(api.widgets.save, {
      ...s.args,
      expectedRevision: 0,
      name: "Published",
      config,
      testimonialIds: [s.testimonialId],
      publish: true,
    });
    let release!: () => void;
    const fetcher = vi.fn().mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      throw new Error("provider timeout with unknown result");
    });
    vi.stubGlobal("fetch", fetcher);
    const first = s.owner.client.action(
      api.cloudflarePublication.publish,
      s.args,
    );
    const firstCheck = expect(first).rejects.toThrow("result is unknown");
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await expect(
      s.owner.client.action(api.cloudflarePublication.publish, s.args),
    ).rejects.toThrow("reservation");
    release();
    await firstCheck;
    await expect(
      s.owner.client.action(api.cloudflarePublication.publish, s.args),
    ).rejects.toThrow("reservation");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("refuses a production delivery host or a different source deployment before IO", async () => {
    const s = await setup();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    vi.stubEnv(
      "CLOUDFLARE_CANARY_DELIVERY_URL",
      "https://proof.example.workers.dev",
    );
    await expect(
      s.owner.client.action(api.cloudflarePublication.publish, s.args),
    ).rejects.toThrow("staging");
    vi.stubEnv(
      "CLOUDFLARE_CANARY_DELIVERY_URL",
      "https://proof-staging.example.workers.dev",
    );
    vi.stubEnv("CONVEX_CLOUD_URL", "https://other.convex.cloud");
    await expect(
      s.owner.client.action(api.cloudflarePublication.publish, s.args),
    ).rejects.toThrow("source deployment");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("refuses external media without silently stripping it and allows the corrected text-only publication", async () => {
    const s = await setup();
    await s.owner.client.mutation(api.widgets.save, {
      ...s.args,
      expectedRevision: 0,
      name: "Published",
      config,
      testimonialIds: [s.testimonialId],
      publish: true,
    });
    const projectionId = await s.t.run(async (ctx) => {
      const projection = await ctx.db
        .query("publicTestimonialProjections")
        .withIndex("by_testimonial", (q) =>
          q.eq("testimonialId", s.testimonialId),
        )
        .unique();
      const storageId = await ctx.storage.store(
        new Blob(["synthetic-avatar"], { type: "image/webp" }),
      );
      await ctx.db.patch(projection!._id, { avatarStorageId: storageId });
      return projection!._id;
    });
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      s.owner.client.action(api.cloudflarePublication.publish, s.args),
    ).rejects.toThrow("CANARY_TEXT_ONLY");
    expect(fetcher).not.toHaveBeenCalled();
    await s.t.run(async (ctx) => {
      await ctx.db.patch(projectionId, { avatarStorageId: undefined });
    });
    await expect(
      s.owner.client.action(api.cloudflarePublication.publish, s.args),
    ).resolves.toMatchObject({ status: "published" });
  });
  it("exports an empty selection after the authoritative public proof was removed", async () => {
    const s = await setup();
    await s.owner.client.mutation(api.widgets.save, {
      ...s.args,
      expectedRevision: 0,
      name: "Published",
      config,
      testimonialIds: [s.testimonialId],
      publish: true,
    });
    await s.t.run(async (ctx) => {
      const projection = await ctx.db
        .query("publicTestimonialProjections")
        .withIndex("by_testimonial", (q) =>
          q.eq("testimonialId", s.testimonialId),
        )
        .unique();
      await ctx.db.delete(projection!._id);
    });
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetcher);
    await s.owner.client.action(api.cloudflarePublication.publish, s.args);
    expect(
      JSON.parse(fetcher.mock.calls[0][1].body).payload.testimonials,
    ).toEqual([]);
  });
});
