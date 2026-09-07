import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  CameraTripod,
  CircleAround,
  EnvelopeStamp,
  MarkerHighlight,
  SketchArrow,
  Sparkle,
  SpeechBubbleStars,
  WallFrames,
} from "@/components/doodles";
import { spotViewBox } from "@/components/doodles/spots";

const marks = { CircleAround, MarkerHighlight, SketchArrow, Sparkle };
const spots = { CameraTripod, EnvelopeStamp, SpeechBubbleStars, WallFrames };
const allowedFills = new Set([
  "var(--surface)",
  "var(--brand)",
  "currentColor",
]);

afterEach(cleanup);

function renderSvg(Doodle: (props: { draw?: boolean }) => React.ReactNode) {
  const { container } = render(<Doodle />);
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("Doodle did not render an svg");
  return svg;
}

describe("hand-drawn signature grammar (DESIGN.md section 4)", () => {
  it.each(Object.entries({ ...marks, ...spots }))(
    "%s is decorative and strokes in the current ink",
    (_name, Doodle) => {
      const svg = renderSvg(Doodle);
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
      expect(svg.getAttribute("fill")).toBe("none");
      expect(svg.getAttribute("stroke")).toBe("currentColor");
      expect(svg.getAttribute("stroke-width")).toBe("2");
      expect(svg.getAttribute("stroke-linecap")).toBe("round");
      expect(svg.getAttribute("stroke-linejoin")).toBe("round");
      expect(svg.outerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    },
  );

  it.each(Object.entries({ ...marks, ...spots }))(
    "%s keeps every stroke drawable at a constant width",
    (_name, Doodle) => {
      const shapes = renderSvg(Doodle).querySelectorAll("path, circle");
      expect(shapes.length).toBeGreaterThan(0);
      for (const shape of shapes) {
        // Dashed by its own length, so the draw-in is progressive.
        expect(shape.getAttribute("style")).toMatch(/--draw-length:\s*\d+/);
        expect(shape.getAttribute("vector-effect")).toBe("non-scaling-stroke");
        const fill = shape.getAttribute("fill");
        if (fill !== null) expect(allowedFills.has(fill)).toBe(true);
      }
    },
  );

  it.each(Object.entries(spots))(
    "%s sits on the shared artboard with an amber accent",
    (_name, Doodle) => {
      const svg = renderSvg(Doodle);
      expect(svg.getAttribute("viewBox")).toBe(spotViewBox);
      const amber = svg.querySelectorAll('[fill="var(--brand)"]');
      expect(amber.length).toBeGreaterThanOrEqual(1);
      const sparkles = [...svg.querySelectorAll("path")].filter((path) =>
        /^M[\d.]+ [\d.]+c0 [\d.]+ [\d.]+ [\d.]+ [\d.]+ [\d.]+c-/.test(
          path.getAttribute("d") ?? "",
        ),
      );
      expect(sparkles.length).toBeGreaterThanOrEqual(1);
      expect(sparkles.length).toBeLessThanOrEqual(3);
      for (const path of svg.querySelectorAll('[fill="var(--surface)"]')) {
        expect(path.getAttribute("d")).toMatch(/Z$/);
      }
    },
  );

  it("draws in only when asked", () => {
    const { container } = render(<WallFrames draw />);
    expect(container.querySelector("svg")).toHaveClass("doodle-draw");
    cleanup();
    const still = render(<WallFrames />);
    expect(still.container.querySelector("svg")).not.toHaveClass("doodle-draw");
  });
});
