import { v } from "convex/values";

export const mediaDeletionProgress = v.object({
  imagesShared: v.optional(v.number()),
  imagesTotal: v.number(),
  imagesDeleted: v.number(),
  videosTotal: v.number(),
  videosDeleted: v.number(),
  uploadsTotal: v.number(),
  uploadsDeleted: v.number(),
  inventoryComplete: v.boolean(),
});

export const emptyMediaProgress = () => ({
  imagesShared: 0,
  imagesTotal: 0,
  imagesDeleted: 0,
  videosTotal: 0,
  videosDeleted: 0,
  uploadsTotal: 0,
  uploadsDeleted: 0,
  inventoryComplete: false,
});
