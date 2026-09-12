import { afterEach, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import {
  authenticatedUser,
  createConvexTest,
  addStripeSubscription,
} from "../tests/convex-test-helpers";
afterEach(() => vi.unstubAllEnvs());
it("applies the Owner switch to all Projects, invalidates public pages, preserves links privately and isolates Accounts", async () => {
  const secret = "wall-service-test-credential-32-characters";
  vi.stubEnv("PUBLIC_READ_RATE_LIMIT_SECRET", secret);
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_accounts");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_accounts");
  const t = createConvexTest();
  const owner = await authenticatedUser(t);
  const first = await owner.client.mutation(api.organizations.create, {
    name: "Atelier Rose",
    publicSlug: "atelier-rose",
  });
  await addStripeSubscription(t, first.id, "active");
  const second = await owner.client.mutation(api.organizations.create, {
    name: "Atelier Bleu",
    publicSlug: "atelier-bleu",
  });
  const outsider = await authenticatedUser(t, { email: "other@example.com" });
  await expect(
    outsider.client.mutation(api.accounts.setTestimonialLinksEnabled, {
      enabled: false,
    }),
  ).rejects.toThrow();
  await expect(
    t.mutation(api.accounts.setTestimonialLinksEnabled, { enabled: false }),
  ).rejects.toThrow();
  const outsiderProject = await outsider.client.mutation(
    api.organizations.create,
    { name: "Lina Studio", publicSlug: "lina-studio" },
  );
  const richText = [
    {
      type: "p" as const,
      children: [
        { text: "@atelier", href: "https://example.com/", highlight: true },
      ],
    },
  ];
  const projectionIds = await t.run(async (ctx) => {
    const ids = [];
    for (const project of [first, second, outsiderProject]) {
      const testimonialId = await ctx.db.insert("testimonials", {
        organizationId: project.id,
        clientSubmissionId: "mention",
        submissionType: "text",
        moderationStatus: "published",
        text: "@atelier",
        richText,
        submitterName: "Camille",
        createdAt: 1,
        updatedAt: 1,
      });
      ids.push(
        await ctx.db.insert("publicTestimonialProjections", {
          organizationId: project.id,
          testimonialId,
          type: "text",
          text: "@atelier",
          richText,
          name: "Camille",
          publishedAt: 1,
          publicOrderKey: "V",
        }),
      );
    }
    return ids;
  });
  const list = (publicSlug: string) =>
    t.query(api.publicWall.list, {
      secret,
      publicSlug,
      paginationOpts: { numItems: 10, cursor: null },
    });
  expect(JSON.stringify(await list("atelier-rose"))).toContain(
    "https://example.com/",
  );
  const before = await t.query(api.publicWall.privacyRevision, {
    publicSlug: "atelier-rose",
  });
  await owner.client.mutation(api.accounts.setTestimonialLinksEnabled, {
    enabled: false,
  });
  const settings = await owner.client.query(api.wallCustomization.getSettings, {
    organizationId: first.id,
  });
  const { canHideAttribution, ...editable } = settings;
  expect(canHideAttribution).toBe(true);
  await owner.client.mutation(api.wallCustomization.updateSettings, {
    ...editable,
    organizationId: first.id,
    testimonialLinksEnabled: true,
  });
  expect(JSON.stringify(await list("atelier-rose"))).toContain(
    "https://example.com/",
  );
  expect(JSON.stringify(await list("atelier-bleu"))).not.toContain("href");
  await owner.client.mutation(api.wallCustomization.updateSettings, {
    ...editable,
    organizationId: first.id,
    testimonialLinksEnabled: false,
  });
  for (const publicSlug of ["atelier-rose", "atelier-bleu"]) {
    const page = await list(publicSlug);
    expect(page.page).toHaveLength(1);
    expect(JSON.stringify(page)).not.toContain("href");
    expect(page.page[0]).toMatchObject({
      text: "@atelier",
      richText: [
        { type: "p", children: [{ text: "@atelier", highlight: true }] },
      ],
    });
  }
  expect(
    await t.query(api.publicWall.privacyRevision, {
      publicSlug: "atelier-rose",
    }),
  ).toBe(before! + 3);
  expect(
    (
      await t.query(api.publicWall.getBrand, {
        secret,
        publicSlug: "atelier-rose",
      })
    )?.privacyRevision,
  ).toBe(before! + 3);
  expect(JSON.stringify(await list("lina-studio"))).toContain(
    "https://example.com/",
  );
  expect(await t.run((ctx) => ctx.db.get(projectionIds[0]))).toMatchObject({
    richText,
  });
  await owner.client.mutation(api.accounts.setTestimonialLinksEnabled, {
    enabled: true,
  });
  expect(JSON.stringify(await list("atelier-rose"))).not.toContain("href");
});
