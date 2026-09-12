export type ExportMedia = {
  path: string;
  role?: string;
  ownerId: string;
  kind: "image" | "video";
  url?: string;
  providerAssetId?: string;
  error?: string;
};
