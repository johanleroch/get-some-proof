import type { PublicWallValue } from "@/components/public-wall/hosted-wall";

export type PublicWallResponse = {
  brand: {
    accentColor: string;
    accentInk: string;
    attributionRequired: boolean;
    name: string;
    publicSlug: string;
    theme: "light" | "dark" | "system";
    transparentEmbed: boolean;
  };
  pagination: { cursor: string | null };
  privacyRevision: number;
  schemaVersion: number;
  testimonials: PublicWallValue["testimonials"];
};

export function wallFromResponse(
  response: PublicWallResponse,
): PublicWallValue {
  return {
    ...response.brand,
    brandName: response.brand.name,
    testimonials: response.testimonials,
  };
}
