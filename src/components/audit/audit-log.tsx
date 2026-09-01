"use client";

import { usePaginatedQuery } from "convex/react";
import { History } from "lucide-react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { AuditListSkeleton } from "@/components/ui/page-skeletons";

const eventLabels = {
  "organization.created": "created the Organization",
  "organization.renamed": "renamed the Organization",
  "invitation.created": "created an Invitation",
  "invitation.resent": "resent an Invitation",
  "invitation.role_changed": "changed an Invitation role",
  "invitation.revoked": "revoked an Invitation",
  "invitation.accepted": "accepted an Invitation",
  "membership.activated": "activated a Membership",
  "membership.role_changed": "changed a Member role",
  "membership.removed": "removed a Member",
  "membership.left": "left the Organization",
  "project.created": "created a Project",
  "project.updated": "updated a Project",
  "project.archived": "archived a Project",
  "project.deleted": "deleted a Project",
} as const;

export function AuditLog({
  organizationId,
}: {
  organizationId: Id<"organizations">;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.auditEvents.list,
    { organizationId },
    { initialNumItems: 20 },
  );

  return (
    <section aria-labelledby="audit-heading" className="space-y-6">
      <div>
        <h1 className="dashboard-page-title" id="audit-heading">
          Audit Log
        </h1>
        <p className="dashboard-page-description mt-1 max-w-2xl">
          An immutable record of Organization administration. Authorization
          changes maintained by convex-authz remain in its separate history.
        </p>
      </div>

      <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
        {status === "LoadingFirstPage" ? (
          <AuditListSkeleton />
        ) : results.length === 0 ? (
          <div className="p-10 text-center">
            <History
              aria-hidden="true"
              className="text-muted-foreground mx-auto size-6"
            />
            <p className="mt-3 font-medium">No activity recorded yet</p>
          </div>
        ) : (
          <ol aria-label="Organization activity" className="divide-y">
            {results.map((event) => (
              <li
                className="grid gap-2 p-5 sm:grid-cols-[1fr_auto]"
                key={event.id}
              >
                <div>
                  <p className="text-sm">
                    <span className="font-semibold">
                      {event.actorDisplayName}
                    </span>{" "}
                    {eventLabels[event.eventType]}{" "}
                    <span className="font-medium">{event.targetLabel}</span>
                  </p>
                  {event.previousValue || event.newValue ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {event.previousValue ? `${event.previousValue} → ` : ""}
                      {event.newValue ?? "removed"}
                    </p>
                  ) : null}
                </div>
                <time
                  className="text-muted-foreground text-xs"
                  dateTime={new Date(event.occurredAt).toISOString()}
                >
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(event.occurredAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </div>

      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button
          disabled={status === "LoadingMore"}
          onClick={() => loadMore(20)}
          type="button"
          variant="outline"
        >
          {status === "LoadingMore" ? "Loading…" : "Load more activity"}
        </Button>
      ) : null}
    </section>
  );
}
