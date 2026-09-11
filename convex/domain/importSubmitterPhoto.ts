import { v } from "convex/values";

export const importSubmitterPhotoTarget = v.union(
  v.object({ itemId: v.id("testimonialImportItems") }),
  v.object({ token: v.string(), position: v.number() }),
);
