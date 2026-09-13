/**
 * The keyline grid every source mark sits on.
 *
 * Brands publish their marks cropped and centred however they like: one fills
 * its file edge to edge, the next floats in a wide margin, and a letterform
 * lifted out of a badge still carries the offset the badge gave it. Dropping
 * those files in as published is what makes a row of logos look drunk.
 *
 * So no mark is ever redrawn: each is measured, then placed. The box is 24 with
 * 20 of live area, and the governing measure depends on the silhouette, because
 * equal measures do not read equal:
 *
 *   square     18    a square reads larger than anything else at the same size
 *   letter     18.5  a bare f or P towers over enclosed marks at 20
 *   circle     20    a disc reads smaller than a square at the same measure
 *   portrait   20    on its height
 *   landscape  20    on its width
 *
 * Then the centre of the ink lands on the centre of the box.
 */

export const BOX = 24;

export const LIVE_AREA = {
  square: 18,
  letter: 18.5,
  circle: 20,
  portrait: 20,
  landscape: 20,
};

/** Every shape name `fitFor` accepts. */
export const SHAPES = Object.keys(LIVE_AREA);

/**
 * Read the silhouette from measured ink: the aspect tells portrait from
 * landscape, and ink in the corners tells a square from a disc. A bare
 * letterform is the one call a machine should not make - the P of Product Hunt
 * and the TikTok note measure almost the same - so `letter` is only ever asked
 * for by hand.
 */
export function classify({ width, height, cornerRatio }) {
  const aspect = width / height;
  if (aspect >= 1.2) return "landscape";
  if (aspect <= 0.83) return "portrait";
  // A round mark can still put ink in its corners - GitHub's cat has ears, a
  // star has points - so the line sits well above nothing, calibrated on the ten
  // marks the wall already ships.
  return cornerRatio >= 0.25 ? "square" : "circle";
}

/** True when a mark is narrow enough that it is probably a letter, not a graphic. */
export function looksLikeLetter({ width, height }) {
  return width / height <= 0.72;
}

const round = (value, places) => Number(value.toFixed(places));

/**
 * Place measured ink onto the grid. `bounds` are the mark's visual bounds -
 * stroke, mask and all - in the coordinates of the file it came from, so the
 * transform also carries the scale from that file's own space.
 */
export function fitFor(bounds, shape) {
  const live = LIVE_AREA[shape];
  if (!live)
    throw new Error(`Unknown shape "${shape}", expected ${SHAPES.join(", ")}`);
  const governing =
    shape === "landscape"
      ? bounds.width
      : shape === "portrait" || shape === "letter"
        ? bounds.height
        : Math.max(bounds.width, bounds.height);
  const scale = live / governing;
  const tx = BOX / 2 - scale * (bounds.x + bounds.width / 2);
  const ty = BOX / 2 - scale * (bounds.y + bounds.height / 2);
  return {
    shape,
    scale: round(scale, 4),
    transform: `translate(${round(tx, 3)} ${round(ty, 3)}) scale(${round(scale, 4)})`,
    width: round(bounds.width * scale, 2),
    height: round(bounds.height * scale, 2),
  };
}
