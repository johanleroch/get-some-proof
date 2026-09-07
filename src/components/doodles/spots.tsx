import { doodleProps, type DoodleProps, strokeAttributes } from "./doodle";

function starPath(cx: number, cy: number, r: number) {
  const points = [
    [0, -1],
    [0.3, -0.3],
    [1, -0.3],
    [0.45, 0.15],
    [0.6, 0.85],
    [0, 0.45],
    [-0.6, 0.85],
    [-0.45, 0.15],
    [-1, -0.3],
    [-0.3, -0.3],
  ];
  return (
    points
      .map(([x, y], index) => {
        const jitter = index % 2 === 0 ? 0.04 : -0.03;
        return `${index === 0 ? "M" : "L"}${(cx + (x! + jitter) * r).toFixed(1)} ${(cy + y! * r).toFixed(1)}`;
      })
      .join("") + "Z"
  );
}

/** Speech bubble with three stars, one filled in the brand color. */
export function SpeechBubbleStars(props: DoodleProps) {
  return (
    <svg {...doodleProps(props, "0 0 160 120")}>
      <path
        {...strokeAttributes}
        d="M22 18c-6 0-10 4-10 10v44c0 6 4 10 10 10h28l14 16 3-16h51c6 0 10-4 10-10V28c0-6-4-10-10-10H22z"
      />
      <path {...strokeAttributes} d={starPath(50, 50, 11)} />
      <path
        {...strokeAttributes}
        d={starPath(80, 50, 11)}
        fill="var(--brand)"
      />
      <path {...strokeAttributes} d={starPath(110, 50, 11)} />
    </svg>
  );
}

/** Camera on a tripod, recording. */
export function CameraTripod(props: DoodleProps) {
  return (
    <svg {...doodleProps(props, "0 0 160 120")}>
      <path
        {...strokeAttributes}
        d="M40 50h80c4 0 7 3 7 7v34c0 4-3 7-7 7H40c-4 0-7-3-7-7V57c0-4 3-7 7-7z"
      />
      <path {...strokeAttributes} d="M62 50l6-9h24l6 9" />
      <circle {...strokeAttributes} cx="80" cy="74" r="14" />
      <circle {...strokeAttributes} cx="80" cy="74" r="6" />
      <circle
        {...strokeAttributes}
        cx="112"
        cy="61"
        fill="var(--brand)"
        r="3.5"
      />
      <path {...strokeAttributes} d="M70 98l-14 18M90 98l14 18M80 98v18" />
    </svg>
  );
}

/** Envelope with a proof stamp. */
export function EnvelopeStamp(props: DoodleProps) {
  return (
    <svg {...doodleProps(props, "0 0 160 120")}>
      <path
        {...strokeAttributes}
        d="M14 34c0-4 3-7 7-7h118c4 0 7 3 7 7v56c0 4-3 7-7 7H21c-4 0-7-3-7-7V34z"
      />
      <path {...strokeAttributes} d="M16 32l64 40 64-40" />
      <path {...strokeAttributes} d="M104 38h30v26h-30z" />
      <path
        {...strokeAttributes}
        d={starPath(119, 51, 8)}
        fill="var(--brand)"
      />
      <path {...strokeAttributes} d="M84 52c3-3 6 3 9 0s6 3 9 0" />
    </svg>
  );
}

/** Three framed quotes on a wall. */
export function WallFrames(props: DoodleProps) {
  return (
    <svg {...doodleProps(props, "0 0 160 120")}>
      <path {...strokeAttributes} d="M18 32l40-3 2 44-40 3z" />
      <path {...strokeAttributes} d="M27 44h22M27 52h18M27 60h14" />
      <path {...strokeAttributes} d="M70 22h46v50H70z" />
      <path {...strokeAttributes} d="M78 36h30M78 44h26M78 52h20" />
      <path
        {...strokeAttributes}
        d={starPath(105, 62, 6)}
        fill="var(--brand)"
      />
      <path {...strokeAttributes} d="M124 36l30 3-2 44-30-3z" />
      <path {...strokeAttributes} d="M131 48h18M131 56h14M131 64h11" />
      <path {...strokeAttributes} d="M10 100h140" />
    </svg>
  );
}
