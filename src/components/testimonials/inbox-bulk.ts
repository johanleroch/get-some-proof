import type { InboxCategory, InboxTestimonial } from "./testimonial-inbox";

export type BulkInboxAction =
  "publish" | "archive" | "unpublish" | "spam" | "undo-spam" | "delete";
export const actionLabels: Record<BulkInboxAction, string> = {
  publish: "Publish",
  archive: "Archive",
  unpublish: "Unpublish",
  spam: "Mark as Spam",
  "undo-spam": "Not Spam",
  delete: "Delete permanently",
};
export const resultLabels: Record<BulkInboxAction, string> = {
  publish: "published",
  archive: "archived",
  unpublish: "unpublished",
  spam: "marked as Spam",
  "undo-spam": "restored",
  delete: "deleted",
};
export const primaryActions: Record<InboxCategory, BulkInboxAction[]> = {
  pending: ["publish", "archive"],
  published: ["unpublish"],
  archived: ["publish"],
  spam: ["undo-spam"],
};
export type InboxPage = {
  page: InboxTestimonial[];
  isDone: boolean;
  continueCursor: string;
};
export type Failure = { item: InboxTestimonial; message: string };

/** Freeze the explicit selection before writes. Never mutate a status index while paging it. */
export async function collectInboxSelection(
  loadPage: (cursor: string | null) => Promise<InboxPage>,
  cancelled: () => boolean,
) {
  const items = new Map<string, InboxTestimonial>();
  let cursor: string | null = null;
  const startedAt = Date.now();
  do {
    if (cancelled()) return null;
    const result = await loadPage(cursor);
    if (cancelled()) return null;
    for (const item of result.page) {
      if (item.createdAt <= startedAt) items.set(item.testimonialId, item);
    }
    if (result.isDone) return items;
    if (result.continueCursor === cursor)
      throw new Error("The list changed. Please select all again.");
    cursor = result.continueCursor;
  } while (true);
}

export function canPublish(item: InboxTestimonial) {
  return (
    item.submissionType === "text" ||
    (item.videoStatus === "ready" && item.card !== null)
  );
}
