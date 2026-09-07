import { doodleProps, type DoodleProps, strokeAttributes } from "./doodle";

/** A loosely drawn five-point star, the logo's cousin. */
export function ScribbleStar(props: DoodleProps) {
  return (
    <svg {...doodleProps(props, "0 0 48 48")}>
      <path
        {...strokeAttributes}
        d="M23.6 5.8c1.9 4.3 3.5 8.6 5.6 12.7 4.7.5 9.5.7 14.1 1.6-3.6 3.3-7.4 6.2-10.9 9.6 1.3 4.7 2.4 9.4 3.3 14.1-4.2-2.3-8.2-4.9-12.4-7.1-4.1 2.5-8.3 4.7-12.6 6.8 1.1-4.7 2.2-9.4 3.6-14.1C10.6 26.1 6.9 23 3.4 19.6c4.7-.6 9.5-.9 14.2-1.2 2-4.2 4-8.5 6.4-12.6"
      />
      <path {...strokeAttributes} d="M25.4 9.6c.8 2 1.6 4 2.5 6" />
    </svg>
  );
}

/** Two-stroke wave to sit under one key word. Stretches to its container. */
export function WavyUnderline(props: DoodleProps) {
  return (
    <svg {...doodleProps(props, "0 0 120 12")} preserveAspectRatio="none">
      <path
        {...strokeAttributes}
        d="M2 7.5C11 2.5 20 11 30 6.5S49 2 58 6.5s19 5 28-.5 19-4.5 32-.5"
      />
    </svg>
  );
}

/** A loose ring that does not quite close, for a number or a short label. */
export function CircleAround(props: DoodleProps) {
  return (
    <svg {...doodleProps(props, "0 0 120 60")}>
      <path
        {...strokeAttributes}
        d="M16 31c-3-13 16-24 43-25 30-1 52 7 52 22 0 16-24 26-55 26C30 54 8 46 10 33c1-8 9-13 22-16"
      />
    </svg>
  );
}

/** Curved arrow used with a handwritten caption. */
export function SketchArrow(props: DoodleProps) {
  return (
    <svg {...doodleProps(props, "0 0 80 60")}>
      <path {...strokeAttributes} d="M5 8c14 2 33 6 46 22 4 5 7 10 9 16" />
      <path {...strokeAttributes} d="M52 42l9 5-1-11" />
    </svg>
  );
}
