/**
 * The hand-drawn marker swash (DESIGN.md section 4) as a CSS background, so a
 * marked phrase reads like a highlighter stroke rather than a coloured box.
 *
 * The path is the one `scripts/doodles/build.mjs` generates for
 * `MarkerHighlight`; keep them in sync when the doodle is regenerated. It ships
 * as a data URI because the same markup paints in the app, in the Inbox and
 * inside the embed's shadow DOM, where no stylesheet of ours is loaded.
 */

const markerPath =
  "M2 10.6C2.9 7,5.5 9.8,7.3 9.3C9 8.9,10.8 8.4,12.5 8C14.3 7.6,16.1 6.9,17.8 6.8C19.6 6.6,21.3 7.1,23.1 7C24.8 6.9,26.6 6.3,28.4 6.2C30.1 6.1,31.9 6.4,33.6 6.3C35.4 6.1,37.2 5.7,38.9 5.4C40.7 5.2,42.4 4.9,44.2 4.7C45.9 4.6,47.7 4.7,49.5 4.5C51.2 4.3,53 3.7,54.7 3.6C56.5 3.5,58.2 3.8,60 3.7C61.8 3.7,63.5 3.4,65.3 3.3C67 3.3,68.8 3.5,70.5 3.5C72.3 3.6,74.1 3.5,75.8 3.5C77.6 3.5,79.3 3.5,81.1 3.6C82.8 3.7,84.6 3.8,86.4 4.1C88.1 4.3,89.9 4.9,91.6 5.1C93.4 5.3,95.2 5.2,96.9 5.4C98.7 5.6,100.4 6,102.2 6.5C103.9 7,105.7 7.8,107.5 8.4C109.2 8.9,111 9.4,112.7 9.8C114.5 10.2,117.1 7.1,118 10.8C118.9 14.5,118.9 28.4,118 32.1C117.1 35.8,114.5 32.6,112.7 32.9C111 33.3,109.2 33.8,107.5 34.2C105.7 34.7,103.9 35.2,102.2 35.4C100.4 35.6,98.7 35.6,96.9 35.5C95.2 35.5,93.4 35.4,91.6 35.2C89.9 35,88.1 34.3,86.4 34.2C84.6 34,82.8 34.3,81.1 34.4C79.3 34.4,77.6 34.5,75.8 34.4C74.1 34.4,72.3 34.1,70.5 34C68.8 33.9,67 33.8,65.3 33.8C63.5 33.8,61.8 33.9,60 34C58.2 34,56.5 33.7,54.7 33.9C53 34,51.2 34.7,49.5 34.9C47.7 35.1,45.9 35.1,44.2 35.1C42.4 35.1,40.7 35,38.9 35.1C37.2 35.1,35.4 35,33.6 35.2C31.9 35.4,30.1 36,28.4 36.1C26.6 36.3,24.8 36,23.1 35.8C21.3 35.7,19.6 35.5,17.8 35.3C16.1 35.1,14.3 35.1,12.5 34.6C10.8 34.2,9 33.1,7.3 32.6C5.5 32,2.9 34.9,2 31.2C1.1 27.5,1.1 14.3,2 10.6Z";
const markerTransform = "rotate(-1.2 60 20)";

/** `background-image` value for a swash in `color` (any CSS color). */
export function markerHighlightImage(color: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" preserveAspectRatio="none">` +
    `<g transform="rotate(-1.2 60 20)"><path d="${markerPath}" fill="${color}"/></g></svg>`;
  // Single quotes: the value also travels inside a double-quoted HTML
  // style attribute, where double quotes would close it early.
  return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
}

/** Inline style for a `<mark>`: the swash behind the words, ink untouched. */
export function markerHighlightStyle(color: string): string {
  return [
    "background:none",
    `background-image:${markerHighlightImage(color)}`,
    "background-size:100% 100%",
    "background-repeat:no-repeat",
    "color:inherit",
    "padding:0 0.14em",
    "margin:0 -0.06em",
  ].join(";");
}

export { markerPath, markerTransform };
