/**
 * One definition of the Pro video allowance, for every surface that shows
 * it: the sidebar's usage lines, the dashboard's plan panel and the Account
 * billing summary.
 *
 * A slot held while an upload finishes processing cannot take another video,
 * so it is spent. That is the rule the backend enforces in
 * `convex/collectionQuotas.ts` (`readyVideos.length + reservations <
 * premiumReadyVideoLimit`), and the three surfaces disagreed with it, and
 * with each other, by that one slot until they shared this module.
 */

export type VideoSlots = {
  readyVideos: number;
  reservedVideos: number;
};

/**
 * Mirrors `premiumReadyVideoLimit` in `convex/collectionQuotas.ts`. Used
 * only where the server has not sent the Account's own limit: prefer
 * `usage.videoLimit` whenever it is there.
 */
export const proVideoSlotLimit = 25;

/** Stored videos plus the slots held while an upload processes. */
export function videoSlotsUsed(slots: VideoSlots) {
  return slots.readyVideos + slots.reservedVideos;
}

/**
 * What a figure may print: never more than the allowance, so a burst of
 * uploads cannot show "27 / 25" beside a bar that stops at full.
 */
export function videoSlotsShown(slots: VideoSlots, limit: number) {
  return Math.min(Math.max(0, limit), videoSlotsUsed(slots));
}

/** How many videos the Account can still store. */
export function videoSlotsLeft(slots: VideoSlots, limit: number) {
  return Math.max(0, limit - videoSlotsUsed(slots));
}

/**
 * How full the allowance is, 0 to 1. An allowance of zero is full, not
 * empty: there is no room in it, and dividing by it would leave the bar
 * with no width at all.
 */
export function videoSlotsRatio(slots: VideoSlots, limit: number) {
  return limit <= 0 ? 1 : videoSlotsShown(slots, limit) / limit;
}

/**
 * The width of a quota bar in percent. Nothing spent draws nothing: a
 * minimum sliver would claim usage that has not happened. Anything spent
 * draws at least 2%, so a single video is visible.
 */
export function videoSlotsBarWidth(slots: VideoSlots, limit: number) {
  const percent = videoSlotsRatio(slots, limit) * 100;
  return percent <= 0 ? 0 : Math.max(2, percent);
}
