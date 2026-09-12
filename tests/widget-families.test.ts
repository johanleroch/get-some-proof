import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtime = readFileSync("public/embed/v2.js", "utf8");

/**
 * A Testimonial video is shown as the Customer filmed it. A layout that finds
 * a portrait video inconvenient narrows its card until the height fits; it
 * never re-crops the picture, because the framing is the Customer's and a
 * face cut off at the chin reads as a broken embed.
 */
describe("the embed never re-crops a video", () => {
  it("sets no aspect-ratio on the video shell", () => {
    const offenders = runtime
      .split("\n")
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(
        ({ line }) =>
          line.includes("video-shell") && line.includes("aspect-ratio"),
      );
    expect(offenders).toEqual([]);
  });

  it("lets the overlay's text column shrink so the play button survives", () => {
    /* The markup carries Tailwind's min-w-0 on that column, which buys
       nothing inside the shadow root. Without the rule below, a narrow video
       pushes its own play button out of the card and the name runs past the
       edge - and every family that narrows a video hits it. */
    expect(runtime).toContain(".video-overlay > span { min-width: 0; }");
  });

  it("bounds a tall video by narrowing the card, not by reshaping it", () => {
    expect(runtime).toContain("function boundVideoCards");
    /* The width follows the ratio the markup carries, so the shape survives. */
    expect(runtime).toMatch(
      /maxWidth = `\$\{Math\.round\(\(maxHeight \* aspect\[0\]\) \/ aspect\[1\]\)\}px`/,
    );
  });
});
