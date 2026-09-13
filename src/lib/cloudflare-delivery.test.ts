import { expect, test } from "vitest";
import { prepareDeliveryPublication } from "./cloudflare-delivery";

export const canaryPresentation = {
  config: {
    layout: "masonry" as const,
    font: "inherit" as const,
    accentColor: "#ffbb16",
    backgroundColor: "#ffffff",
    textColor: "#2e2a25",
  },
  brandName: "Cedar Workshop",
  attributionRequired: true,
  testimonials: [
    {
      id: "private-projection-id",
      type: "text" as const,
      name: "Maya Laurent",
      avatarUrl: null,
      publishedAt: 1,
      text: "Our customers can finally see the care behind our work.",
    },
  ],
};
export const canaryMetadata = {
  publicId: "12345678-1234-4234-8234-123456789abc",
  revision: 1,
  policyRevision: 1,
  generatedAt: 1_800_000_000_000,
  validUntil: 1_800_086_400_000,
  allowedOrigins: ["https://staging.cedar.example"],
};

test("prepares a complete public text Widget using the existing renderer without private record IDs", () => {
  const publication = prepareDeliveryPublication(
    canaryPresentation,
    canaryMetadata,
  );
  expect(publication.validUntil).toBe(1_800_086_400_000);
  expect(publication.payload.testimonials[0].html).toContain("Maya Laurent");
  expect(publication.payload.brand.attributionRequired).toBe(true);
  expect(JSON.stringify(publication)).not.toContain("private-projection-id");
});

test("rejects media or remote fonts until their Cloudflare delivery is implemented", () => {
  expect(() =>
    prepareDeliveryPublication(
      { ...canaryPresentation, googleFont: "Figtree" },
      canaryMetadata,
    ),
  ).toThrow();
  expect(() =>
    prepareDeliveryPublication(
      {
        ...canaryPresentation,
        testimonials: [
          {
            ...canaryPresentation.testimonials[0],
            avatarUrl: "https://private.convex.cloud/avatar",
          },
        ],
      },
      canaryMetadata,
    ),
  ).toThrow();
});

test("bounds validity, payload size and explicit origins before publication", () => {
  for (const metadata of [
    { ...canaryMetadata, validUntil: canaryMetadata.generatedAt + 86400001 },
    { ...canaryMetadata, allowedOrigins: ["https://*.example.com"] },
    { ...canaryMetadata, allowedOrigins: [] },
    {
      ...canaryMetadata,
      allowedOrigins: ["https://staging.cedar.example/path"],
    },
    { ...canaryMetadata, revision: -1 },
  ])
    expect(() =>
      prepareDeliveryPublication(canaryPresentation, metadata),
    ).toThrow();
  expect(() =>
    prepareDeliveryPublication(
      {
        ...canaryPresentation,
        testimonials: Array.from(
          { length: 51 },
          () => canaryPresentation.testimonials[0],
        ),
      },
      canaryMetadata,
    ),
  ).toThrow();
  expect(() =>
    prepareDeliveryPublication(
      {
        ...canaryPresentation,
        testimonials: [
          { ...canaryPresentation.testimonials[0], text: "x".repeat(1000001) },
        ],
      },
      canaryMetadata,
    ),
  ).toThrow();
});

test("strips unexpected private fields from otherwise eligible source cards", () => {
  const card = {
    ...canaryPresentation.testimonials[0],
    email: "private@example.com",
    organizationId: "private-tenant",
    consentEvidence: "private-consent",
  };
  const result = prepareDeliveryPublication(
    { ...canaryPresentation, testimonials: [card] },
    canaryMetadata,
  );
  expect(JSON.stringify(result)).not.toMatch(
    /private@example|private-tenant|private-consent/,
  );
});
