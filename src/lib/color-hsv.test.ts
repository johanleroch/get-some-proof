import { describe, expect, it } from "vitest";

import { hexToHsv, hsvToHex, normalizeHex, roundHsv } from "./color-hsv";

describe("hexToHsv", () => {
  it("reads the primaries and the greys", () => {
    expect(roundHsv(hexToHsv("#ff0000")!)).toEqual({ h: 0, s: 100, v: 100 });
    expect(roundHsv(hexToHsv("#00ff00")!)).toEqual({ h: 120, s: 100, v: 100 });
    expect(roundHsv(hexToHsv("#0000ff")!)).toEqual({ h: 240, s: 100, v: 100 });
    expect(roundHsv(hexToHsv("#ffffff")!)).toEqual({ h: 0, s: 0, v: 100 });
    expect(roundHsv(hexToHsv("#000000")!)).toEqual({ h: 0, s: 0, v: 0 });
  });

  it("reads Proof Amber and the Brand accent presets", () => {
    expect(roundHsv(hexToHsv("#ffbb16")!)).toEqual({ h: 42, s: 91, v: 100 });
    expect(roundHsv(hexToHsv("#0f766e")!)).toEqual({ h: 175, s: 87, v: 46 });
  });

  it("refuses what is not a colour", () => {
    expect(hexToHsv("teal")).toBeNull();
    expect(hexToHsv("#12345")).toBeNull();
  });
});

describe("hsvToHex", () => {
  it("comes back to the hex it started from, across the wheel", () => {
    const samples = [
      "#ffbb16",
      "#0f766e",
      "#d9483b",
      "#274690",
      "#ffffff",
      "#000000",
      "#7f7f7f",
      "#00ffff",
      "#ff00ff",
    ];
    for (const hex of samples) {
      expect(hsvToHex(hexToHsv(hex)!)).toBe(hex);
    }
  });

  it("wraps the hue instead of clipping it", () => {
    expect(hsvToHex({ h: 360, s: 100, v: 100 })).toBe("#ff0000");
    expect(hsvToHex({ h: -60, s: 100, v: 100 })).toBe("#ff00ff");
  });

  it("keeps out-of-range saturation and value inside the gamut", () => {
    expect(hsvToHex({ h: 43, s: 400, v: 400 })).toBe("#ffb700");
    expect(hsvToHex({ h: 43, s: -20, v: -20 })).toBe("#000000");
  });
});

describe("normalizeHex", () => {
  it("takes what a person types or pastes", () => {
    expect(normalizeHex("ffbb16")).toBe("#ffbb16");
    expect(normalizeHex("#FFBB16")).toBe("#ffbb16");
    expect(normalizeHex("  #0F766E  ")).toBe("#0f766e");
    expect(normalizeHex("#abc")).toBe("#aabbcc");
    expect(normalizeHex("abc")).toBe("#aabbcc");
  });

  it("returns null while the value is still being typed", () => {
    expect(normalizeHex("#ff")).toBeNull();
    expect(normalizeHex("#ffbb1")).toBeNull();
    expect(normalizeHex("#gggggg")).toBeNull();
    expect(normalizeHex("")).toBeNull();
  });
});
