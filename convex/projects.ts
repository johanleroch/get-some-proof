import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { recordOrganizationAuditEvent } from "./auditEvents";
import { requirePremiumEntitlement } from "./billingEntitlements";
import { requireOrganizationPermission } from "./security/organizationAccess";

const projectSummary = v.object({
  id: v.id("projects"),
  name: v.string(),
  description: v.string(),
  status: v.union(v.literal("active"), v.literal("archived")),
  createdAt: v.number(),
  updatedAt: v.number(),
});

function projectUnavailable(): never {
  throw new ConvexError({
    code: "PROJECT_UNAVAILABLE",
    message: "Project unavailable.",
  });
}

function normalizeProjectName(name: string) {
  const normalized = name.trim().replaceAll(/\s+/g, " ");

  if (normalized.length < 2 || normalized.length > 100) {
    throw new ConvexError({
      code: "INVALID_PROJECT_NAME",
      message: "Project names must contain between 2 and 100 characters.",
    });
  }

  return normalized;
}

function normalizeProjectDescription(description: string) {
  const normalized = description.trim();

  if (normalized.length > 1_000) {
    throw new ConvexError({
      code: "INVALID_PROJECT_DESCRIPTION",
      message: "Project descriptions cannot exceed 1,000 characters.",
    });
  }

  return normalized;
}

function summarizeProject(project: {
  _id: Id<"projects">;
  name: string;
  description: string;
  status: "active" | "archived";
  createdAt: number;
  updatedAt: number;
}) {
  return {
    id: project._id,
    name: project.name,
    description: project.description,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

async function findProjectInOrganization(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  projectId: Id<"projects">,
) {
  const project = await ctx.db.get(projectId);

  return project?.organizationId === organizationId ? project : null;
}

export const list = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(projectSummary),
  handler: async (ctx, args) => {
    await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "projects:read",
    );
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_organization", (index) =>
        index.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .collect();

    return projects.map(summarizeProject);
  },
});

export const get = query({
  args: {
    organizationId: v.id("organizations"),
    projectId: v.id("projects"),
  },
  returns: v.union(v.null(), projectSummary),
  handler: async (ctx, args) => {
    await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "projects:read",
    );
    const project = await findProjectInOrganization(
      ctx,
      args.organizationId,
      args.projectId,
    );

    return project ? summarizeProject(project) : null;
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.string(),
  },
  returns: projectSummary,
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "projects:create",
    );
    await requirePremiumEntitlement(ctx, access.organization._id);
    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      organizationId: access.organization._id,
      name: normalizeProjectName(args.name),
      description: normalizeProjectDescription(args.description),
      status: "active",
      createdByUserId: access.principal.actorId,
      updatedByUserId: access.principal.actorId,
      createdAt: now,
      updatedAt: now,
    });
    const project = await ctx.db.get(projectId);

    if (!project) {
      return projectUnavailable();
    }
    await recordOrganizationAuditEvent(ctx, {
      organizationId: access.organization._id,
      eventType: "project.created",
      actorUserId: access.principal.actorId,
      actorDisplayName: access.principal.name,
      targetType: "project",
      targetId: String(project._id),
      targetLabel: project.name,
      occurredAt: now,
    });

    return summarizeProject(project);
  },
});

export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    projectId: v.id("projects"),
    name: v.string(),
    description: v.string(),
  },
  returns: projectSummary,
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "projects:update",
    );
    await requirePremiumEntitlement(ctx, access.organization._id);
    const project = await findProjectInOrganization(
      ctx,
      access.organization._id,
      args.projectId,
    );

    if (!project) {
      return projectUnavailable();
    }

    const now = Date.now();
    const patch = {
      name: normalizeProjectName(args.name),
      description: normalizeProjectDescription(args.description),
      updatedByUserId: access.principal.actorId,
      updatedAt: now,
    };
    await ctx.db.patch(project._id, patch);
    await recordOrganizationAuditEvent(ctx, {
      organizationId: access.organization._id,
      eventType: "project.updated",
      actorUserId: access.principal.actorId,
      actorDisplayName: access.principal.name,
      targetType: "project",
      targetId: String(project._id),
      targetLabel: patch.name,
      previousValue: project.name,
      newValue: patch.name,
      occurredAt: now,
    });

    return summarizeProject({ ...project, ...patch });
  },
});

export const archive = mutation({
  args: {
    organizationId: v.id("organizations"),
    projectId: v.id("projects"),
  },
  returns: projectSummary,
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "projects:archive",
    );
    await requirePremiumEntitlement(ctx, access.organization._id);
    const project = await findProjectInOrganization(
      ctx,
      access.organization._id,
      args.projectId,
    );

    if (!project) {
      return projectUnavailable();
    }

    const now = Date.now();
    const patch = {
      status: "archived" as const,
      archivedAt: now,
      updatedByUserId: access.principal.actorId,
      updatedAt: now,
    };
    await ctx.db.patch(project._id, patch);
    await recordOrganizationAuditEvent(ctx, {
      organizationId: access.organization._id,
      eventType: "project.archived",
      actorUserId: access.principal.actorId,
      actorDisplayName: access.principal.name,
      targetType: "project",
      targetId: String(project._id),
      targetLabel: project.name,
      previousValue: project.status,
      newValue: "archived",
      occurredAt: now,
    });

    return summarizeProject({ ...project, ...patch });
  },
});

export const remove = mutation({
  args: {
    organizationId: v.id("organizations"),
    projectId: v.id("projects"),
  },
  returns: v.object({ deleted: v.boolean() }),
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "projects:delete",
    );
    await requirePremiumEntitlement(ctx, access.organization._id);
    const project = await findProjectInOrganization(
      ctx,
      access.organization._id,
      args.projectId,
    );

    if (!project) {
      return projectUnavailable();
    }

    const now = Date.now();
    await recordOrganizationAuditEvent(ctx, {
      organizationId: access.organization._id,
      eventType: "project.deleted",
      actorUserId: access.principal.actorId,
      actorDisplayName: access.principal.name,
      targetType: "project",
      targetId: String(project._id),
      targetLabel: project.name,
      occurredAt: now,
    });
    await ctx.db.delete(project._id);
    return { deleted: true };
  },
});
