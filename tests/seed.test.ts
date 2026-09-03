import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { components, internal } from "@convex/_generated/api";
import { authenticatedUser, createConvexTest } from "./convex-test-helpers";

describe("demonstration seed", () => {
  beforeEach(() => {
    process.env.ALLOW_DEMO_SEED = "true";
    process.env.SITE_URL = "http://localhost:3000";
  });

  afterEach(() => {
    delete process.env.ALLOW_DEMO_SEED;
    delete process.env.SITE_URL;
  });

  it("is opt-in, idempotent, and creates useful role-scoped data", async () => {
    const t = createConvexTest();
    const first = await t.mutation(internal.seed.demo, {
      confirmation: "SEED_LOCAL_DEMO",
    });
    expect(first).toEqual({
      organizationSlug: "demo-company-demo",
      organizationsCreated: 1,
      membershipsCreated: 4,
      rolesUpdated: 4,
      projectsCreated: 3,
      auditEventsCreated: 8,
    });
    const second = await t.mutation(internal.seed.demo, {
      confirmation: "SEED_LOCAL_DEMO",
    });
    expect(second).toEqual({
      organizationSlug: "demo-company-demo",
      organizationsCreated: 0,
      membershipsCreated: 0,
      rolesUpdated: 0,
      projectsCreated: 0,
      auditEventsCreated: 0,
    });

    const snapshot = await t.run(async (ctx) => {
      const organization = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (index) => index.eq("slug", "demo-company-demo"))
        .unique();
      if (!organization) throw new Error("Missing demo Organization");
      return {
        memberships: await ctx.db
          .query("memberships")
          .withIndex("by_organization_status", (index) =>
            index.eq("organizationId", organization._id).eq("status", "active"),
          )
          .collect(),
        projects: await ctx.db
          .query("projects")
          .withIndex("by_organization", (index) =>
            index.eq("organizationId", organization._id),
          )
          .collect(),
        auditEvents: await ctx.db
          .query("auditEvents")
          .withIndex("by_organization_occurred_at", (index) =>
            index.eq("organizationId", organization._id),
          )
          .collect(),
        organization,
      };
    });
    expect(snapshot.memberships).toHaveLength(4);
    expect(snapshot.projects).toHaveLength(3);
    expect(snapshot.auditEvents).toHaveLength(8);
    await expect(
      t.query(components.authz.indexed.checkPermissionFast, {
        tenantId: String(snapshot.organization._id),
        userId: "demo-editor",
        permission: "projects:create",
      }),
    ).resolves.toBe(true);
    await expect(
      t.query(components.authz.indexed.checkPermissionFast, {
        tenantId: String(snapshot.organization._id),
        userId: "demo-viewer",
        permission: "projects:create",
      }),
    ).resolves.toBe(false);
  });

  it("refuses non-local and disabled deployments", async () => {
    const t = createConvexTest();
    process.env.SITE_URL = "https://admin.example.com";
    await expect(
      t.mutation(internal.seed.demo, { confirmation: "SEED_LOCAL_DEMO" }),
    ).rejects.toMatchObject({
      data: { code: "DEMO_SEED_PRODUCTION_BLOCKED" },
    });

    delete process.env.ALLOW_DEMO_SEED;
    process.env.SITE_URL = "http://localhost:3000";
    await expect(
      t.mutation(internal.seed.demo, { confirmation: "SEED_LOCAL_DEMO" }),
    ).rejects.toMatchObject({ data: { code: "DEMO_SEED_DISABLED" } });
  });

  it("can bind the demo Owner to an existing verified Better Auth User", async () => {
    const t = createConvexTest();
    const owner = await authenticatedUser(t, {
      email: "demo-adopter@example.com",
      name: "Demo Adopter",
    });

    await t.mutation(internal.seed.demo, {
      confirmation: "SEED_LOCAL_DEMO",
      ownerEmail: "DEMO-ADOPTER@example.com",
    });

    const membership = await t.run(async (ctx) => {
      const organization = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (index) => index.eq("slug", "demo-company-demo"))
        .unique();
      if (!organization) return null;
      return ctx.db
        .query("memberships")
        .withIndex("by_organization_user", (index) =>
          index
            .eq("organizationId", organization._id)
            .eq("userId", owner.actorId),
        )
        .unique();
    });
    expect(membership).toMatchObject({
      displayName: "Demo Adopter",
      email: "demo-adopter@example.com",
      status: "active",
    });
  });
});
