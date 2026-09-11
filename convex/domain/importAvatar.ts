import { v, type Infer } from "convex/values";

export const importAvatarTarget = v.union(
  v.object({ itemId: v.id("testimonialImportItems") }),
  v.object({ token: v.string(), position: v.number() }),
);

export type ImportAvatarTarget = Infer<typeof importAvatarTarget>;
