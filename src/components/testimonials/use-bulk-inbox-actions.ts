"use client";

import { useAction, useConvex, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { importAttestationVersion } from "@convex/domain/testimonialImport";
import type { BulkInboxAction } from "./inbox-bulk";
import type { InboxCategory, InboxTestimonial } from "./testimonial-inbox";

/** Keep batch writes on the same authenticated, audited paths as single-row actions. */
export function useBulkInboxActions({
  organizationId,
  importJobId,
  category,
}: {
  organizationId?: Id<"organizations">;
  importJobId?: string;
  category: InboxCategory;
}) {
  const convex = useConvex();
  const setStatus = useMutation(api.testimonialModeration.setStatus);
  const markSpam = useMutation(api.testimonialModeration.markSpam);
  const undoSpam = useMutation(api.testimonialModeration.undoSpam);
  const removeText = useMutation(api.testimonialModeration.remove);
  const removeVideo = useAction(api.videoMedia.remove);
  return {
    loadPage: async (cursor: string | null) => {
      if (!organizationId) throw new Error("Project unavailable.");
      return convex.query(api.testimonialModeration.listInbox, {
        organizationId,
        ...(importJobId !== undefined ? { importJobId } : {}),
        status: category,
        sort: "newest",
        paginationOpts: { cursor, numItems: 20 },
      });
    },
    perform: async (
      item: InboxTestimonial,
      action: BulkInboxAction,
      attested: boolean,
    ) => {
      if (!organizationId) throw new Error("Project unavailable.");
      const target = { organizationId, testimonialId: item.testimonialId };
      switch (action) {
        case "delete":
          await (item.submissionType === "video"
            ? removeVideo(target)
            : removeText(target));
          break;
        case "spam":
          await markSpam(target);
          break;
        case "undo-spam":
          await undoSpam(target);
          break;
        default:
          await setStatus({
            ...target,
            status: action === "publish" ? "published" : "archived",
            ...(action === "publish" && attested
              ? { importAttestationAccepted: true, importAttestationVersion }
              : {}),
          });
      }
    },
  };
}
