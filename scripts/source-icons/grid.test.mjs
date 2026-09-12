import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { BOX, classify, fitFor, looksLikeLetter } from "./grid.mjs";

/**
 * Every mark the wall ships, as `pnpm icon:fit` measures them: visual ink
 * bounds in the coordinates of each brand's own file, and how much of their own
 * corners they fill. `shape` is what the badge uses - `letter` is the one call
 * asked for by hand, so `auto` records what the classifier says on its own.
 */
const MARKS = {
  google: {
    x: 0.975,
    y: 0.975,
    width: 21.6,
    height: 22.05,
    cornerRatio: 0.066,
    shape: "circle",
  },
  trustpilot: {
    x: 0.019,
    y: 0.581,
    width: 23.963,
    height: 22.838,
    cornerRatio: 0,
    shape: "circle",
  },
  x: {
    x: -0.487,
    y: -0.375,
    width: 24.919,
    height: 24.75,
    cornerRatio: 0.563,
    shape: "square",
  },
  linkedin: {
    x: -0.037,
    y: -0.037,
    width: 24.075,
    height: 24.075,
    cornerRatio: 0.942,
    shape: "square",
  },
  facebook: {
    x: 7.05,
    y: 4.688,
    width: 10.294,
    height: 19.35,
    cornerRatio: 0.223,
    shape: "letter",
    auto: "portrait",
  },
  instagram: {
    x: -0.037,
    y: -0.037,
    width: 24.075,
    height: 24.075,
    cornerRatio: 0.434,
    shape: "square",
  },
  youtube: {
    x: -0.037,
    y: 3.506,
    width: 24.075,
    height: 16.988,
    cornerRatio: 0.635,
    shape: "landscape",
  },
  reddit: {
    x: 2.381,
    y: 3.169,
    width: 19.238,
    height: 16.875,
    cornerRatio: 0.026,
    shape: "circle",
  },
  producthunt: {
    x: 7.781,
    y: 5.981,
    width: 10.069,
    height: 12.037,
    cornerRatio: 0.565,
    shape: "letter",
    auto: "square",
  },
  github: {
    x: 3.9,
    y: 5.531,
    width: 15.188,
    height: 17.1,
    cornerRatio: 0.214,
    shape: "circle",
  },
  tiktok: {
    x: 1.538,
    y: -0.037,
    width: 20.925,
    height: 24.075,
    cornerRatio: 0.093,
    shape: "circle",
  },
};

// vitest runs from the repo root, and import.meta.url is not a file URL here.
const source = await readFile(
  "src/components/testimonials/source-icons.ts",
  "utf8",
);
const shipped = Object.fromEntries(
  [
    ...source.matchAll(
      / {2}(\w+): \{\n {4}color: "[^"]+",\n {4}fit: "([^"]+)"/g,
    ),
  ].map((match) => [match[1], match[2]]),
);

/** The fixtures are rounded to three places, so compare the numbers, not the text. */
function parse(transform) {
  const [, tx, ty, scale] = transform.match(
    /translate\((-?[\d.]+) (-?[\d.]+)\) scale\((-?[\d.]+)\)/,
  );
  return { tx: Number(tx), ty: Number(ty), scale: Number(scale) };
}

describe("the source badge grid", () => {
  it("places every shipped mark, and nothing is hand-tuned off the grid", () => {
    // A platform added to the badge lands here too: run `pnpm icon:fit
    // <file.svg> --json` and record what it measured, so its mark is held to
    // the grid like the rest.
    expect(Object.keys(shipped).sort()).toEqual(Object.keys(MARKS).sort());
    for (const [slug, mark] of Object.entries(MARKS)) {
      const computed = parse(fitFor(mark, mark.shape).transform);
      const onTheWall = parse(shipped[slug]);
      expect(computed.tx, slug).toBeCloseTo(onTheWall.tx, 1);
      expect(computed.ty, slug).toBeCloseTo(onTheWall.ty, 1);
      expect(computed.scale, slug).toBeCloseTo(onTheWall.scale, 2);
    }
  });

  it("reads each silhouette from its ink, asking only for the bare letterforms", () => {
    for (const [slug, mark] of Object.entries(MARKS)) {
      expect(classify(mark), slug).toBe(mark.auto ?? mark.shape);
    }
    expect(looksLikeLetter(MARKS.facebook)).toBe(true);
    expect(looksLikeLetter(MARKS.tiktok)).toBe(false);
  });

  it("centres the ink on the box whatever the file it came from", () => {
    const off = { x: 100, y: -40, width: 30, height: 30, cornerRatio: 0.9 };
    const { scale } = fitFor(off, "square");
    const [, tx, ty] = fitFor(off, "square").transform.match(
      /translate\((-?[\d.]+) (-?[\d.]+)\)/,
    );
    expect(Number(tx) + scale * (off.x + off.width / 2)).toBeCloseTo(
      BOX / 2,
      2,
    );
    expect(Number(ty) + scale * (off.y + off.height / 2)).toBeCloseTo(
      BOX / 2,
      2,
    );
  });

  it("gives a square less room than a disc, and a bare letter less than a graphic", () => {
    const square = { x: 0, y: 0, width: 10, height: 10, cornerRatio: 0.9 };
    const disc = { x: 0, y: 0, width: 10, height: 10, cornerRatio: 0.02 };
    expect(fitFor(square, classify(square)).width).toBe(18);
    expect(fitFor(disc, classify(disc)).width).toBe(20);
    expect(fitFor({ ...square, width: 6 }, "letter").height).toBe(18.5);
  });

  it("refuses a shape it does not know", () => {
    expect(() => fitFor(MARKS.google, "blob")).toThrow(/Unknown shape/);
  });
});
