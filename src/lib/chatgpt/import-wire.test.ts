import { expect, it } from "vitest";
import { previewSchema } from "./import-wire";
it("preserves Senja links and highlights across the widget wire contract", () => {
  const richText = [
    {
      type: "p",
      children: [
        {
          text: "Excellent",
          highlight: true,
          href: "https://example.com/atelier",
        },
      ],
    },
  ];
  const result = previewSchema.parse({
    provider: "senja",
    sourceUrl: "https://love.senja.io/",
    itemCount: 1,
    expiresAt: 1,
    selectedPositions: [],
    nextOffset: null,
    items: [
      {
        position: 0,
        sourceId: "review",
        type: "text",
        authorName: "Camille",
        text: "Excellent",
        richText,
        source: { platform: "x", url: "https://x.com/camille/status/1" },
      },
    ],
  });
  expect(result.items[0]?.source).toEqual({
    platform: "x",
    url: "https://x.com/camille/status/1",
  });
  expect(result.items[0]?.richText).toEqual(richText);
});
