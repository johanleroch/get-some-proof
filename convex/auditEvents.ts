import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { query, type MutationCtx } from "./_generated/server";
import { requireOrganizationPermission } from "./security/organizationAccess";

export const auditEventTypeValidator = v.union(
  v.literal("organization.created"),
  v.literal("organization.renamed"),
  v.literal("brand.public_slug_changed"),
  v.literal("organization.logo_updated"),
  v.literal("organization.logo_removed"),
  v.literal("invitation.created"),
  v.literal("invitation.resent"),
  v.literal("invitation.role_changed"),
  v.literal("invitation.revoked"),
  v.literal("invitation.accepted"),
  v.literal("membership.activated"),
  v.literal("membership.role_changed"),
  v.literal("membership.removed"),
  v.literal("membership.left"),
  v.literal("project.created"),
  v.literal("project.updated"),
  v.literal("project.archived"),
  v.literal("project.deleted"),
  v.literal("billing.contact_updated"),
  v.literal("billing.checkout_started"),
  v.literal("billing.portal_opened"),
  v.literal("testimonial.published"),
  v.literal("testimonial.archived"),
  v.literal("testimonial.revised"),
  v.literal("testimonial.consent_withdrawn"),
  v.literal("testimonial.deleted"),
);

export type AuditEventType =
  | "organization.created"
  | "organization.renamed"
  | "brand.public_slug_changed"
  | "organization.logo_updated"
  | "organization.logo_removed"
  | "invitation.created"
  | "invitation.resent"
  | "invitation.role_changed"
  | "invitation.revoked"
  | "invitation.accepted"
  | "membership.activated"
  | "membership.role_changed"
  | "membership.removed"
  | "membership.left"
  | "project.created"
  | "project.updated"
  | "project.archived"
  | "project.deleted"
  | "billing.contact_updated"
  | "billing.checkout_started"
  | "billing.portal_opened"
  | "testimonial.published"
  | "testimonial.archived"
  | "testimonial.revised"
  | "testimonial.consent_withdrawn"
  | "testimonial.deleted";

type AuditTargetType =
  | "organization"
  | "invitation"
  | "membership"
  | "project"
  | "billing"
  | "testimonial";

export async function recordOrganizationAuditEvent(
  ctx: MutationCtx,
  event: {
    organizationId: Id<"organizations">;
    eventType: AuditEventType;
    actorUserId: string;
    actorDisplayName: string;
    targetType: AuditTargetType;
    targetId: string;
    targetLabel: string;
    previousValue?: string;
    newValue?: string;
    occurredAt?: number;
  },
) {
  return ctx.db.insert("auditEvents", {
    ...event,
    occurredAt: event.occurredAt ?? Date.now(),
  });
}

const auditEventSummary = v.object({
  id: v.id("auditEvents"),
  eventType: auditEventTypeValidator,
  actorUserId: v.string(),
  actorDisplayName: v.string(),
  targetType: v.union(
    v.literal("organization"),
    v.literal("invitation"),
    v.literal("membership"),
    v.literal("project"),
    v.literal("billing"),
    v.literal("testimonial"),
  ),
  targetId: v.string(),
  targetLabel: v.string(),
  previousValue: v.optional(v.string()),
  newValue: v.optional(v.string()),
  occurredAt: v.number(),
});

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireOrganizationPermission(
      ctx,
      { organizationId: args.organizationId },
      "audit:read",
    );
    const page = await ctx.db
      .query("auditEvents")
      .withIndex("by_organization_occurred_at", (index) =>
        index.eq("organizationId", access.organization._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((event) => ({
        id: event._id,
        eventType: event.eventType,
        actorUserId: event.actorUserId,
        actorDisplayName: event.actorDisplayName,
        targetType: event.targetType,
        targetId: event.targetId,
        targetLabel: event.targetLabel,
        previousValue: event.previousValue,
        newValue: event.newValue,
        occurredAt: event.occurredAt,
      })),
    };
  },
  returns: v.object({
    page: v.array(auditEventSummary),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRecommended"),
        v.literal("SplitRequired"),
        v.null(),
      ),
    ),
  }),
});
