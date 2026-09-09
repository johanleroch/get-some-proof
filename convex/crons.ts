import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
// Independent of later uploads: recover files left behind by an interrupted action.
crons.interval(
  "Clean up orphaned avatar uploads",
  { hours: 1 },
  internal.storageCleanup.requestOrphanedStorageCleanup,
  {},
);
crons.interval(
  "Reconcile unresolved imported video cleanup",
  { minutes: 1 },
  internal.videoImportCleanup.reconcileDue,
  {},
);
export default crons;
