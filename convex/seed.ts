import { ConvexError, v } from "convex/values";

import { components } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { recordOrganizationAuditEvent } from "./auditEvents";
import { authzForOrganization, type OrganizationRole } from "./authorization";

const demoSlug = "demo-company-demo";
const seedActorId = "demo-seed-system";
const seedActorName = "Demo Seed";

function requireLocalSeedAuthorization() {
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new ConvexError({
      code: "DEMO_SEED_DISABLED",
      message:
        "Demo seeding is disabled. Set ALLOW_DEMO_SEED=true only on a local development deployment.",
    });
  }

  let hostname: string;
  try {
    hostname = new URL(process.env.SITE_URL ?? "").hostname;
  } catch {
    hostname = "";
  }
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    throw new ConvexError({
      code: "DEMO_SEED_PRODUCTION_BLOCKED",
      message:
        "Demo seeding is blocked because SITE_URL is not a local address.",
    });
  }
}

const demoMembers: Array<{
  userId: string;
  displayName: string;
  email: string;
  role: OrganizationRole;
}> = [
  {
    userId: "demo-owner",
    displayName: "Olivia Owner",
    email: "owner@demo.example.invalid",
    role: "owner",
  },
  {
    userId: "demo-admin",
    displayName: "Amir Admin",
    email: "admin@demo.example.invalid",
    role: "admin",
  },
  {
    userId: "demo-editor",
    displayName: "Emma Editor",
    email: "editor@demo.example.invalid",
    role: "editor",
  },
  {
    userId: "demo-viewer",
    displayName: "Victor Viewer",
    email: "viewer@demo.example.invalid",
    role: "viewer",
  },
];

const demoProjects = [
  {
    name: "Customer portal",
    description: "Example active Project owned by the demo Organization.",
    status: "active" as const,
  },
  {
    name: "Operations dashboard",
    description: "Example active Project for internal operators.",
    status: "active" as const,
  },
  {
    name: "Legacy reporting",
    description: "Archived example used to populate dashboard metrics.",
    status: "archived" as const,
  },
];

export const demo = internalMutation({
  args: {
    confirmation: v.literal("SEED_LOCAL_DEMO"),
    ownerEmail: v.optional(v.string()),
  },
  returns: v.object({
    organizationSlug: v.string(),
    organizationsCreated: v.number(),
    membershipsCreated: v.number(),
    rolesUpdated: v.number(),
    projectsCreated: v.number(),
    auditEventsCreated: v.number(),
  }),
  handler: async (ctx, args) => {
    requireLocalSeedAuthorization();
    const seededMembers = [...demoMembers];
    if (args.ownerEmail) {
      const email = args.ownerEmail.trim().toLowerCase();
      const user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "email", operator: "eq", value: email }],
      })) as {
        _id: string;
        emailVerified: boolean;
        name: string;
        email: string;
      } | null;
      if (!user || !user.emailVerified) {
        throw new ConvexError({
          code: "DEMO_OWNER_UNAVAILABLE",
          message:
            "The requested demo Owner must already be a verified Better Auth User.",
        });
      }
      seededMembers[0] = {
        userId: String(user._id),
        displayName: user.name,
        email: user.email,
        role: "owner",
      };
    }
    const now = Date.now();
    let organizationsCreated = 0;
    let membershipsCreated = 0;
    let rolesUpdated = 0;
    let projectsCreated = 0;
    let auditEventsCreated = 0;
    let organization = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (index) => index.eq("slug", demoSlug))
      .unique();

    if (!organization) {
      const organizationId = await ctx.db.insert("organizations", {
        collectionFormDescription: "Tell us what changed for you.",
        collectionFormTitle: "Share your experience with Demo Company",
        name: "Demo Company",
        primaryColor: "#ffbb16",
        privacyContact: "privacy@example.com",
        publicSlug: "demo-company",
        slug: demoSlug,
        createdByUserId: seedActorId,
        createdAt: now,
        updatedAt: now,
      });
      organization = await ctx.db.get(organizationId);
      organizationsCreated += 1;
      if (!organization) throw new Error("Demo Organization creation failed.");
      await recordOrganizationAuditEvent(ctx, {
        organizationId,
        eventType: "organization.created",
        actorUserId: seedActorId,
        actorDisplayName: seedActorName,
        targetType: "organization",
        targetId: String(organizationId),
        targetLabel: organization.name,
        occurredAt: now,
      });
      auditEventsCreated += 1;
    }

    const scopedAuthz = authzForOrganization(String(organization._id));
    for (const member of seededMembers) {
      let membership = await ctx.db
        .query("memberships")
        .withIndex("by_organization_user", (index) =>
          index
            .eq("organizationId", organization._id)
            .eq("userId", member.userId),
        )
        .unique();
      const membershipWasCreated = !membership;
      if (!membership) {
        const membershipId = await ctx.db.insert("memberships", {
          organizationId: organization._id,
          userId: member.userId,
          displayName: member.displayName,
          email: member.email,
          status: "active",
          createdAt: now,
          updatedAt: now,
        });
        membership = await ctx.db.get(membershipId);
        membershipsCreated += 1;
      } else if (membership.status !== "active") {
        await ctx.db.patch(membership._id, {
          status: "active",
          displayName: member.displayName,
          email: member.email,
          deactivatedAt: undefined,
          updatedAt: now,
        });
      }
      if (!membership) throw new Error("Demo Membership creation failed.");

      const assignments = await scopedAuthz.getUserRoles(ctx, member.userId);
      if (assignments.length !== 1 || assignments[0]?.role !== member.role) {
        await scopedAuthz.revokeAllRoles(
          ctx,
          member.userId,
          undefined,
          seedActorId,
        );
        await scopedAuthz.assignRole(
          ctx,
          member.userId,
          member.role,
          undefined,
          undefined,
          seedActorId,
        );
        rolesUpdated += 1;
      }
      if (membershipWasCreated) {
        await recordOrganizationAuditEvent(ctx, {
          organizationId: organization._id,
          eventType: "membership.activated",
          actorUserId: seedActorId,
          actorDisplayName: seedActorName,
          targetType: "membership",
          targetId: String(membership._id),
          targetLabel: member.displayName,
          newValue: member.role,
          occurredAt: now,
        });
        auditEventsCreated += 1;
      }
    }

    const existingProjects = await ctx.db
      .query("projects")
      .withIndex("by_organization", (index) =>
        index.eq("organizationId", organization._id),
      )
      .collect();
    const existingNames = new Set(existingProjects.map(({ name }) => name));
    for (const project of demoProjects) {
      if (existingNames.has(project.name)) continue;
      const projectId = await ctx.db.insert("projects", {
        organizationId: organization._id,
        name: project.name,
        description: project.description,
        status: project.status,
        createdByUserId: seedActorId,
        updatedByUserId: seedActorId,
        createdAt: now,
        updatedAt: now,
        archivedAt: project.status === "archived" ? now : undefined,
      });
      await recordOrganizationAuditEvent(ctx, {
        organizationId: organization._id,
        eventType: "project.created",
        actorUserId: seedActorId,
        actorDisplayName: seedActorName,
        targetType: "project",
        targetId: String(projectId),
        targetLabel: project.name,
        newValue: project.status,
        occurredAt: now,
      });
      projectsCreated += 1;
      auditEventsCreated += 1;
    }

    return {
      organizationSlug: organization.slug,
      organizationsCreated,
      membershipsCreated,
      rolesUpdated,
      projectsCreated,
      auditEventsCreated,
    };
  },
});

/** Synthetic Owner fixture for repeatable real MCP client certification. */
export const assistantCertification = internalMutation({
  args: {
    confirmation: v.literal("SEED_ASSISTANT_CERTIFICATION"),
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    profilesCreated: v.number(),
    subscriptionsCreated: v.number(),
  }),
  handler: async (ctx, args) => {
    requireLocalSeedAuthorization();
    const project = await ctx.db.get(args.organizationId);
    const account = project?.accountId
      ? await ctx.db.get(project.accountId)
      : null;
    const user = account
      ? await ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: "user",
          where: [{ field: "_id", value: account.ownerUserId }],
        })
      : null;
    if (
      !project ||
      !account ||
      account.deletionStartedAt ||
      !user?.emailVerified ||
      !/^mcp-certification-\d{8}@demo\.example\.invalid$/.test(user.email) ||
      !project.slug.startsWith("mcp-certification-")
    )
      throw new ConvexError(
        "Use only a synthetic MCP certification Owner and Project.",
      );
    const customerId = `cus_mcp_certification_${account._id}`;
    const subscriptionId = `sub_mcp_certification_${account._id}`;
    const profile = await ctx.db
      .query("billingProfiles")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .unique();
    if (
      profile?.stripeCustomerId &&
      !profile.stripeCustomerId.startsWith("cus_mcp_certification_")
    )
      throw new ConvexError(
        "Existing billing configuration is not a certification fixture.",
      );
    const now = Date.now();
    const profileData = {
      accountId: account._id,
      organizationId: project._id,
      billingEmail: user.email,
      stripeCustomerId: customerId,
      expectedProPriceId: "price_pro_monthly",
      updatedAt: now,
    };
    if (profile) await ctx.db.patch(profile._id, profileData);
    else
      await ctx.db.insert("billingProfiles", {
        ...profileData,
        createdAt: now,
      });
    const subscription = await ctx.db
      .query("billingSubscriptionStates")
      .withIndex("by_stripe_subscription", (q) =>
        q.eq("stripeSubscriptionId", subscriptionId),
      )
      .unique();
    const state = {
      accountId: account._id,
      organizationId: project._id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      priceId: "price_pro_monthly",
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: Math.floor(now / 1000) + 86_400,
      lastStripeEventCreated: Math.floor(now / 1000),
      lastStripeEventId: `evt_mcp_certification_${account._id}`,
      updatedAt: now,
    };
    if (subscription) await ctx.db.patch(subscription._id, state);
    else await ctx.db.insert("billingSubscriptionStates", state);
    return {
      profilesCreated: profile ? 0 : 1,
      subscriptionsCreated: subscription ? 0 : 1,
    };
  },
});
