// The blob mascot in motion.
//
// Six behaviours for loaders, idle states and success moments. Same body,
// same eyes as the expression set; only transforms and opacity move, so the
// files stay light and `prefers-reduced-motion` freezes them on the neutral
// face. Each animation is a standalone SVG with its own <style>, usable
// inline (React, see components/brand/animated-blob.tsx) or as a file
// (public/brand/blob/animated/<name>.svg, exported by blob-set.mjs).
//
// Motion rules, from DESIGN.md section 8 and the mascot's character:
// - Amplitudes stay small (2 to 5% of the body); the blob is a jelly, not a
//   ball. Every squash keeps the volume: wider means shorter.
// - Loops use a sine-like curve (cubic-bezier(.45, 0, .55, 1)); one-shot
//   moves use a soft back-out (cubic-bezier(.34, 1.4, .64, 1)) and never
//   overshoot visibly.
// - The body pivots on its base (transform-origin bottom centre); eyes move
//   inside the body and blink on their own centre.

import {
  EYE_Y,
  INK,
  LEFT,
  RIGHT,
  arch,
  blobBody,
  blobDefs,
  pill,
} from "./blob-expressions.ts";

/** The expression viewBox plus headroom, so hops and wobbles never clip. */
export const ANIMATED_VIEWBOX = "176 140 648 648";

export type BlobAnimation = {
  /** File and id-safe name. */
  name: string;
  label: string;
  /** Where the product would use it. */
  use: string;
  /** What moves, for whoever adds the next one. */
  how: string;
  /** Loop length in seconds, for the gallery. */
  duration: number;
  /** Keyframes and rules; `$` is replaced by the instance scope selector. */
  css: string;
};

const LOOP = "cubic-bezier(0.45, 0, 0.55, 1)";
const POP = "cubic-bezier(0.34, 1.4, 0.64, 1)";

/**
 * Every behaviour blinks: a 120 ms close every 4 s, on each pill's own
 * centre. `phase` shifts the cycle so two blobs on one page never blink
 * together.
 */
const blink = (phase: number) => `
$ .eye { animation: blink 4s cubic-bezier(0.4, 0, 0.2, 1) ${-phase}s infinite; }
@keyframes blink {
  0%, 91%, 97%, 100% { transform: scaleY(1); }
  94% { transform: scaleY(0.12); }
}`;

export const blobAnimations: BlobAnimation[] = [
  {
    name: "breathe",
    label: "Breathe",
    use: "Any resting blob that stays on screen: empty states, the onboarding preview.",
    how: "The body swells 2% wider and 1.5% shorter on its base, the eyes ride along and blink. 3.2 s loop.",
    duration: 3.2,
    css: `
$ .body { animation: breathe 3.2s ${LOOP} infinite; }
@keyframes breathe {
  0%, 100% { transform: scale(1, 1); }
  50% { transform: scale(1.02, 0.985); }
}
${blink(0.6)}`,
  },
  {
    name: "blink",
    label: "Blink",
    use: "The blink every behaviour carries, shown alone on a still body. Use it where even breathing would be too much.",
    how: "Each pill closes on its centre to 12% height in 120 ms, then reopens. Every 4 s; the other behaviours add it too.",
    duration: 4,
    css: blink(0),
  },
  {
    name: "look",
    label: "Look",
    use: "Loading and searching: the inbox fetching, a Wall building, a search running.",
    how: "Both eyes glide up-right, hold, cross to the left, hold, come home. The body leans 2° with the glance and keeps breathing. 3 s loop.",
    duration: 3,
    css: `
$ .body { animation: lean 3s ${LOOP} infinite; }
$ .eyes { animation: look 3s ${LOOP} infinite; }
@keyframes lean {
  0%, 100% { transform: rotate(0deg) scale(1, 1); }
  20%, 42% { transform: rotate(2deg) scale(1.01, 0.995); }
  62%, 84% { transform: rotate(-2deg) scale(1.01, 0.995); }
}
@keyframes look {
  0%, 100% { transform: translate(0, 0); }
  20%, 42% { transform: translate(46px, -36px); }
  62%, 84% { transform: translate(-42px, -8px); }
}
${blink(1.4)}`,
  },
  {
    name: "bounce",
    label: "Bounce",
    use: "Working hard: an upload, a video processing, a long submit.",
    how: "Squash on the ground, stretch in the air, land soft. Volume is kept at every frame. 1.1 s loop.",
    duration: 1.1,
    css: `
$ .body { animation: bounce 1.1s infinite; }
@keyframes bounce {
  0% { transform: translateY(0) scale(1.06, 0.94); animation-timing-function: cubic-bezier(0.2, 0, 0.3, 1); }
  38% { transform: translateY(-48px) scale(0.965, 1.04); animation-timing-function: ${LOOP}; }
  52% { transform: translateY(-54px) scale(1, 1); animation-timing-function: cubic-bezier(0.6, 0, 0.9, 0.6); }
  88% { transform: translateY(0) scale(1.08, 0.92); animation-timing-function: cubic-bezier(0.2, 0, 0.4, 1); }
  100% { transform: translateY(0) scale(1.06, 0.94); }
}
${blink(2.2)}`,
  },
  {
    name: "wobble",
    label: "Wobble",
    use: "An entrance or a hover: the blob arrives, wobbles once, settles. Loops here for the gallery only.",
    how: "A jelly wobble on the base: rotate and skew in three shrinking swings over 900 ms, then still.",
    duration: 2.6,
    css: `
$ .body { animation: wobble 2.6s ${LOOP} infinite; }
@keyframes wobble {
  0%, 36%, 100% { transform: rotate(0deg) skewX(0deg); }
  8% { transform: rotate(-4deg) skewX(3deg); }
  18% { transform: rotate(3deg) skewX(-2deg); }
  28% { transform: rotate(-1.5deg) skewX(1deg); }
}
${blink(3)}`,
  },
  {
    name: "pop",
    label: "Pop",
    use: "Success: a testimonial published, a form sent, the Wall live. One-shot in the product.",
    how: "A small hop with squash and stretch; the eyes blink shut, come back as the Happy arches, hold a beat, and blink back. 2.4 s loop.",
    duration: 2.4,
    css: `
$ .body { animation: hop 2.4s infinite; }
$ .eyes { animation: swap-blink 2.4s cubic-bezier(0.3, 0, 0.2, 1) infinite; }
$ .eye { animation: pills-out 2.4s step-end infinite; }
$ .arches { animation: arches-in 2.4s step-end infinite; }
@keyframes hop {
  0%, 6% { transform: translateY(0) scale(1, 1); animation-timing-function: cubic-bezier(0.4, 0, 1, 1); }
  12% { transform: translateY(0) scale(1.07, 0.93); animation-timing-function: ${POP}; }
  26% { transform: translateY(-44px) scale(0.96, 1.05); animation-timing-function: cubic-bezier(0.5, 0, 0.8, 0.6); }
  40% { transform: translateY(0) scale(1.05, 0.95); animation-timing-function: ${LOOP}; }
  50%, 100% { transform: translateY(0) scale(1, 1); }
}
@keyframes swap-blink {
  0%, 14%, 26%, 84%, 96%, 100% { transform: scaleY(1); }
  19%, 21% { transform: scaleY(0.08); }
  89%, 91% { transform: scaleY(0.08); }
}
@keyframes pills-out {
  0%, 20% { opacity: 1; }
  20.01%, 90% { opacity: 0; }
  90.01%, 100% { opacity: 1; }
}
@keyframes arches-in {
  0%, 20% { opacity: 0; }
  20.01%, 90% { opacity: 1; }
  90.01%, 100% { opacity: 0; }
}`,
  },
];

/**
 * Standalone animated SVG. The style is scoped to this instance's id so
 * several animated blobs can share one document. Reduced motion stops
 * everything on the neutral face.
 */
export function animatedBlobSvg(
  animation: BlobAnimation,
  { id = animation.name, size }: { id?: string; size?: number } = {},
): string {
  const svgId = `blob-anim-${id}`;
  const scope = `#${svgId}`;
  const dimensions = size ? ` width="${size}" height="${size}"` : "";
  const css = animation.css.replaceAll("$", scope);
  return `<svg xmlns="http://www.w3.org/2000/svg" id="${svgId}" viewBox="${ANIMATED_VIEWBOX}"${dimensions} overflow="visible" fill="none" role="img" aria-label="Get Some Proof mascot, ${animation.label.toLowerCase()}">
<style>
${scope} .body, ${scope} .eyes, ${scope} .eye, ${scope} .arches { transform-box: fill-box; will-change: transform; }
${scope} .body { transform-origin: 50% 100%; }
${scope} .eyes, ${scope} .eye, ${scope} .arches { transform-origin: 50% 50%; }
${scope} .arches { opacity: 0; }
${css}
@media (prefers-reduced-motion: reduce) {
  ${scope} .body, ${scope} .eyes, ${scope} .eye, ${scope} .arches { animation: none !important; }
}
</style>
<g class="body">
${blobBody(id)}
<g class="eyes">
<path class="eye" d="${pill(LEFT, EYE_Y)}" fill="${INK}"/>
<path class="eye" d="${pill(RIGHT, EYE_Y)}" fill="${INK}"/>
<g class="arches">${arch(LEFT)}${arch(RIGHT)}</g>
</g>
</g>
${blobDefs(id)}
</svg>`;
}
