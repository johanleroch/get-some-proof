import { beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "@convex/_generated/api";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";

const config = {
  layout: "wall" as const,
  font: "inherit" as const,
  accentColor: "#123abc",
  backgroundColor: "#ffffff",
  textColor: "#222222",
};
const secret = "widget-service-test-credential-32-characters";
beforeEach(() => {
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
describe("Studio widgets", () => {
  it("keeps draft edits private and publishes an independent ordered selection", async () => {
    const s = await setup();
    await s.owner.client.mutation(api.widgets.save, {
      ...s.args,
      expectedRevision: 0,
      name: "Homepage",
      config,
      testimonialIds: [s.testimonialId],
    });
    const draft = await s.owner.client.query(api.widgets.get, s.args);
    expect(
      await s.t.query(api.widgets.getPublished, {
        publicId: draft!.publicId,
        secret,
      }),
    ).toBeNull();
    await s.owner.client.mutation(api.widgets.publish, {
      ...s.args,
      expectedRevision: 1,
    });
    await s.owner.client.mutation(api.widgets.save, {
      ...s.args,
      expectedRevision: 2,
      name: "New draft",
      config: { ...config, accentColor: "#abcdef" },
      testimonialIds: [],
    });
    const live = await s.t.query(api.widgets.getPublished, {
      publicId: draft!.publicId,
      secret,
    });
    expect(live).toMatchObject({
      config,
      testimonials: [{ name: "A Person" }],
    });
    expect(JSON.stringify(live)).not.toContain("private@example.com");
    expect(JSON.stringify(live)).not.toContain("organizationId");
    await s.owner.client.mutation(api.widgets.unpublish, s.args);
    expect(
      await s.t.query(api.widgets.getPublished, {
        publicId: draft!.publicId,
        secret,
      }),
    ).toBeNull();
  });
  it("removes withdrawn projections from existing widget publications", async () => {
    const s = await setup();
    await s.owner.client.mutation(api.widgets.save, {
      ...s.args,
      expectedRevision: 0,
      name: "Homepage",
      config,
      testimonialIds: [s.testimonialId],
    });
    await s.owner.client.mutation(api.widgets.publish, {
      ...s.args,
      expectedRevision: 1,
    });
    const draft = await s.owner.client.query(api.widgets.get, s.args);
    await s.t.run(async (ctx) => {
      const p = await ctx.db
        .query("publicTestimonialProjections")
        .withIndex("by_testimonial", (q) =>
          q.eq("testimonialId", s.testimonialId),
        )
        .unique();
      await ctx.db.delete(p!._id);
    });
    expect(
      await s.t.query(api.widgets.getPublished, {
        publicId: draft!.publicId,
        secret,
      }),
    ).toMatchObject({ testimonials: [] });
  });
  it("rejects unauthorized access, foreign selections and invalid layouts", async () => {
    const s = await setup();
    await expect(s.t.query(api.widgets.get, s.args)).rejects.toThrow();
    await expect(
      s.t.query(api.widgets.getPublished, { publicId: "missing" }),
    ).rejects.toThrow();
    const other = await authenticatedUser(s.t, { email: "other@example.com" });
    await expect(
      other.client.mutation(api.widgets.remove, s.args),
    ).rejects.toThrow();
    await expect(
      s.owner.client.mutation(api.widgets.save, {
        ...s.args,
        expectedRevision: 0,
        name: "Bad",
        config,
        testimonialIds: [s.testimonialId, s.testimonialId],
      }),
    ).rejects.toThrow();
    await expect(
      s.owner.client.mutation(api.widgets.save, {
        ...s.args,
        expectedRevision: 0,
        name: "Bad",
        config: { ...config, layout: "highlights" },
        testimonialIds: [s.testimonialId],
      }),
    ).rejects.toThrow();
    await expect(
      s.owner.client.mutation(api.widgets.publish, {
        ...s.args,
        expectedRevision: 1,
      }),
    ).rejects.toThrow();
  });
  it("rejects stale edits and publishes only the current draft", async () => {
    const s = await setup();
    await s.owner.client.mutation(api.widgets.save, {
      ...s.args,
      expectedRevision: 0,
      name: "Saved",
      config,
      testimonialIds: [s.testimonialId],
    });
    await expect(
      s.owner.client.mutation(api.widgets.save, {
        ...s.args,
        expectedRevision: 0,
        name: "Stale",
        config,
        testimonialIds: [],
      }),
    ).rejects.toThrow("another tab");
    await expect(
      s.owner.client.mutation(api.widgets.publish, {
        ...s.args,
        expectedRevision: 0,
      }),
    ).rejects.toThrow("another tab");
    expect(await s.owner.client.query(api.widgets.get, s.args)).toMatchObject({
      name: "Saved",
      revision: 1,
    });
  });
  it("rejects foreign selections across project boundaries", async () => {
    const s = await setup();
    const other = await authenticatedUser(s.t, {
      email: "foreign@example.com",
    });
    const otherBrand = await other.client.mutation(api.organizations.create, {
      name: "Other",
      primaryColor: "#123abc",
      privacyContact: "privacy@example.com",
      publicSlug: "other-proof",
    });
    const otherWidget = await other.client.mutation(api.widgets.create, {
      organizationId: otherBrand.id,
      name: "Other",
      config,
    });
    await expect(
      other.client.mutation(api.widgets.save, {
        organizationId: otherBrand.id,
        widgetId: otherWidget,
        expectedRevision: 0,
        name: "Foreign",
        config,
        testimonialIds: [s.testimonialId],
      }),
    ).rejects.toThrow("this project");
    await expect(
      s.owner.client.query(api.widgets.get, {
        organizationId: s.brand.id,
        widgetId: otherWidget,
      }),
    ).rejects.toThrow("not found");
  });
  it("keeps each widgets order independent and requires real highlights", async () => {
    const s = await setup();
    const second = await s.t.run(async (ctx) => {
      const original = await ctx.db.get(s.testimonialId);
      const { _id, _creationTime, ...data } = original!;
      void _id;
      void _creationTime;
      const id = await ctx.db.insert("testimonials", {
        ...data,
        clientSubmissionId: "two",
        submitterName: "Second",
      });
      await ctx.db.insert("publicTestimonialProjections", {
        organizationId: s.brand.id,
        testimonialId: id,
        type: "text",
        text: "Wonderful proof",
        name: "Second",
        publishedAt: Date.now(),
        richText: [
          {
            type: "p",
            children: [
              { text: "Wonderful", highlight: true },
              { text: " proof" },
            ],
          },
        ],
      });
      return id;
    });
    await expect(
      s.owner.client.mutation(api.widgets.save, {
        ...s.args,
        expectedRevision: 0,
        name: "Single",
        config: { ...config, layout: "individual" },
        testimonialIds: [s.testimonialId, second],
      }),
    ).rejects.toThrow("one testimonial");
    await s.owner.client.mutation(api.widgets.save, {
      ...s.args,
      expectedRevision: 0,
      name: "Ordered",
      config,
      testimonialIds: [s.testimonialId, second],
    });
    await s.owner.client.mutation(api.widgets.publish, {
      ...s.args,
      expectedRevision: 1,
    });
    const widget = await s.owner.client.query(api.widgets.get, s.args);
    expect(
      (await s.t.query(api.widgets.getPublished, {
        publicId: widget!.publicId,
        secret,
      }))!.testimonials.map((t) => t.name),
    ).toEqual(["A Person", "Second"]);
    await s.owner.client.mutation(api.widgets.save, {
      ...s.args,
      expectedRevision: 2,
      name: "Highlight",
      config: { ...config, layout: "highlights" },
      testimonialIds: [second],
    });
    await s.owner.client.mutation(api.widgets.publish, {
      ...s.args,
      expectedRevision: 3,
    });
    expect(
      (await s.t.query(api.widgets.getPublished, {
        publicId: widget!.publicId,
        secret,
      }))!.testimonials,
    ).toHaveLength(1);
  });
  it("enforces widget limits and returns public-safe candidates", async () => {
    const s = await setup();
    const page = await s.owner.client.query(api.widgets.candidates, {
      organizationId: s.brand.id,
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(page.page).toHaveLength(1);
    expect(JSON.stringify(page)).not.toContain("private@example.com");
    await expect(
      s.owner.client.query(api.widgets.candidates, {
        organizationId: s.brand.id,
        paginationOpts: { numItems: 51, cursor: null },
      }),
    ).rejects.toThrow();
    await expect(
      s.owner.client.mutation(api.widgets.create, {
        organizationId: s.brand.id,
        name: "Bad",
        config: { ...config, accentColor: "red;bad-css" },
      }),
    ).rejects.toThrow();
    await s.t.run(async (ctx) => {
      const widget = await ctx.db.get(s.widgetId);
      const { _id, _creationTime, ...data } = widget!;
      void _id;
      void _creationTime;
      for (let i = 0; i < 99; i++)
        await ctx.db.insert("widgets", {
          ...data,
          publicId: crypto.randomUUID(),
        });
    });
    await expect(
      s.owner.client.mutation(api.widgets.create, {
        organizationId: s.brand.id,
        name: "Over limit",
        config,
      }),
    ).rejects.toThrow("100 widgets");
  });
  it("honors account publication generation and project deletion", async () => {
    const s = await setup();
    await s.owner.client.mutation(api.widgets.save, {
      ...s.args,
      expectedRevision: 0,
      name: "Public",
      config,
      testimonialIds: [s.testimonialId],
    });
    await s.owner.client.mutation(api.widgets.publish, {
      ...s.args,
      expectedRevision: 1,
    });
    const widget = await s.owner.client.query(api.widgets.get, s.args);
    await s.t.run(async (ctx) => {
      const brand = await ctx.db.get(s.brand.id);
      await ctx.db.patch(brand!.accountId!, { publicationGeneration: 1 });
    });
    expect(
      await s.t.query(api.widgets.getPublished, {
        publicId: widget!.publicId,
        secret,
      }),
    ).toMatchObject({ testimonials: [], attributionRequired: true });
    await s.t.run(async (ctx) =>
      ctx.db.patch(s.brand.id, { deletionStartedAt: Date.now() }),
    );
    expect(
      await s.t.query(api.widgets.getPublished, {
        publicId: widget!.publicId,
        secret,
      }),
    ).toBeNull();
  });
  it("purges widget drafts and publications during workspace deletion", async () => {
    const s = await setup();
    const deletionId = await s.t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.patch(s.brand.id, { deletionStartedAt: now });
      return ctx.db.insert("workspaceDeletions", {
        organizationId: s.brand.id,
        actorUserId: s.owner.actorId,
        status: "requested",
        phase: "publicProjections",
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      });
    });
    for (let i = 0; i < 10; i++)
      await s.t.mutation(internal.workspaceDeletion.purgeBatch, { deletionId });
    expect(await s.t.run((ctx) => ctx.db.get(s.widgetId))).toBeNull();
  });
  it("provides only the admitted project slug in its protected lightweight lookup", async () => {
    const s = await setup();
    const widget = await s.owner.client.query(api.widgets.get, s.args);
    await expect(
      s.t.query(api.widgets.getPublishedBrand, { publicId: widget!.publicId }),
    ).rejects.toThrow();
    expect(
      await s.t.query(api.widgets.getPublishedBrand, {
        publicId: widget!.publicId,
        secret,
      }),
    ).toBeNull();
    await s.owner.client.mutation(api.widgets.save, {
      ...s.args,
      expectedRevision: 0,
      name: "Internal private name",
      config,
      testimonialIds: [s.testimonialId],
    });
    await s.owner.client.mutation(api.widgets.publish, {
      ...s.args,
      expectedRevision: 1,
    });
    expect(
      await s.t.query(api.widgets.getPublishedBrand, {
        publicId: widget!.publicId,
        secret,
      }),
    ).toEqual({ publicSlug: "studio-proof" });
  });
  it("saves and publishes atomically with one revision increment", async () => {
    const s = await setup();
    await s.owner.client.mutation(api.widgets.save, {
      ...s.args,
      expectedRevision: 0,
      name: "Atomic",
      config,
      testimonialIds: [s.testimonialId],
      publish: true,
    });
    const widget = await s.owner.client.query(api.widgets.get, s.args);
    expect(widget).toMatchObject({
      revision: 1,
      name: "Atomic",
      draft: { testimonialIds: [s.testimonialId] },
      published: { testimonialIds: [s.testimonialId] },
    });
    expect(
      await s.t.query(api.widgets.getPublished, {
        publicId: widget!.publicId,
        secret,
      }),
    ).toMatchObject({ testimonials: [{ name: "A Person" }] });
    expect(await s.owner.client.mutation(api.widgets.unpublish, s.args)).toBe(
      2,
    );
    await s.owner.client.mutation(api.widgets.save, {
      ...s.args,
      expectedRevision: 2,
      name: "Republish",
      config,
      testimonialIds: [s.testimonialId],
      publish: true,
    });
    expect(await s.owner.client.query(api.widgets.get, s.args)).toMatchObject({
      revision: 3,
    });
  });
  it("preserves draft, publication and revision when atomic publication is invalid", async () => {
    const s = await setup();
    await s.owner.client.mutation(api.widgets.save, {
      ...s.args,
      expectedRevision: 0,
      name: "Valid",
      config,
      testimonialIds: [s.testimonialId],
      publish: true,
    });
    const before = await s.owner.client.query(api.widgets.get, s.args);
    await expect(
      s.owner.client.mutation(api.widgets.save, {
        ...s.args,
        expectedRevision: 1,
        name: "Invalid update",
        config: { ...config, accentColor: "#abcdef" },
        testimonialIds: [],
        publish: true,
      }),
    ).rejects.toThrow("at least one");
    expect(await s.owner.client.query(api.widgets.get, s.args)).toEqual(before);
  });
});
