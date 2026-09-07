export { ArrowNote } from "./arrow-note";
export type { DoodleProps } from "./doodle";
export { CircleAround, MarkerHighlight, SketchArrow, Sparkle } from "./marks";
export {
  CameraTripod,
  EnvelopeStamp,
  SpeechBubbleStars,
  WallFrames,
} from "./spots";

/**
 * @deprecated The star and the underline left the vocabulary on 2026-09-07;
 * use `Sparkle` and `MarkerHighlight`. Kept one release for pages in flight.
 */
export {
  Sparkle as ScribbleStar,
  MarkerHighlight as WavyUnderline,
} from "./marks";
