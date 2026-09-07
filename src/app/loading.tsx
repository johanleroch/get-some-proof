import { BlobLoaderScreen } from "@/components/brand/blob-loader";

/**
 * Default loading UI for every route that has no closer `loading.tsx`: the
 * blob looking around. Dashboard pages keep their layout-shaped skeletons.
 */
export default function Loading() {
  return <BlobLoaderScreen />;
}
