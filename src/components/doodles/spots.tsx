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

/**
 * A wall of customer proof: a text Testimonial with its five stars, a video
 * Testimonial and a short quote, pinned at slight angles. Cards are filled
 * with `--surface` so they overlap cleanly; the stars are the one amber area.
 */
export function WallFrames(props: DoodleProps) {
  return (
    <svg {...doodleProps(props, "0 0 320 220")}>
      <g transform="rotate(-6 72 158)">
        <path
          {...strokeAttributes}
          d="M34 121.7C56.36 121.4,86.72 122.3,110 121.5Q118 122,118.0 130C117.8 145.76,117.2 169.52,118.0 186Q118 194,110 193.5C86.72 193.9,56.36 193.2,34 193.5Q26 194,25.9 186C26.6 169.52,25.3 145.76,25.7 130Q26 122,34 122.1Z"
          fill="var(--surface)"
        />
        <path
          {...strokeAttributes}
          d="M44 140c-3 1-5 4-4 7 1 2 3 3 5 2 2-1 2-4 0-5M56 140c-3 1-5 4-4 7 1 2 3 3 5 2 2-1 2-4 0-5"
        />
        <path
          {...strokeAttributes}
          d="M44 162Q54.0 161.2,64.0 162Q74.0 162.8,84.0 162Q94.0 161.2,104.0 162"
        />
        <path
          {...strokeAttributes}
          d="M44 172Q55.5 171.2,67.0 172Q78.5 172.8,90.0 172"
        />
        <path
          {...strokeAttributes}
          d="M44 182Q51.0 181.2,58.0 182Q65.0 182.8,72.0 182"
        />
      </g>
      <g transform="rotate(4 258 98)">
        <path
          {...strokeAttributes}
          d="M219 32.8C241.68 32.1,273.36 31.8,297 32.6Q306 32,305.5 41C306.6 75.56,305.6 119.12,305.6 155Q306 164,297 163.6C273.36 163.7,241.68 164.6,219 163.6Q210 164,210.1 155C210.3 119.12,209.8 75.56,210.1 41Q210 32,219 31.6Z"
          fill="var(--surface)"
        />
        <path
          {...strokeAttributes}
          d="M273 88C273 96.25,266.25 103,258 103S243 96.25,243 88S249.75 73,258 73S273.6 80.5,272.6 89.5"
        />
        <path {...strokeAttributes} d="M253 80l12 8-12 8z" />
        <path
          {...strokeAttributes}
          d="M222 134Q231.0 133.2,240.0 134Q249.0 134.8,258.0 134Q267.0 133.2,276.0 134"
        />
        <path
          {...strokeAttributes}
          d="M222 144Q230.0 143.2,238.0 144Q246.0 144.8,254.0 144"
        />
      </g>
      <g transform="rotate(-2.5 130 121)">
        <path
          {...strokeAttributes}
          d="M61 61.2C103.48 61.5,154.96 62.3,199 61.9Q208 62,207.8 71C208.2 100.94,207.9 139.88,207.8 171Q208 180,199 180.3C154.96 180.4,103.48 179.5,61 180.1Q52 180,52.0 171C52.7 139.88,52.4 100.94,51.7 71Q52 62,61 62.5Z"
          fill="var(--surface)"
        />
        <path
          {...strokeAttributes}
          d="M87 88C87 94.05,82.05 99,76 99S65 94.05,65 88S69.95 77,76 77S87.6 82.5,86.6 89.5"
        />
        <path
          {...strokeAttributes}
          d="M94 84Q103.0 83.2,112.0 84Q121.0 84.8,130.0 84Q139.0 83.2,148.0 84"
        />
        <path
          {...strokeAttributes}
          d="M94 93Q102.5 92.2,111.0 93Q119.5 93.8,128.0 93"
        />
        <path
          {...strokeAttributes}
          d="M76.2 106.4L77.5 110.3L81.8 110.3L78.4 112.8L79.6 116.8L75.8 114.5L72.9 116.8L73.3 112.8L70.6 110.3L74.2 110.3ZM90.2 106.4L91.5 110.3L95.8 110.3L92.4 112.8L93.6 116.8L89.8 114.5L86.9 116.8L87.3 112.8L84.6 110.3L88.2 110.3ZM104.2 106.4L105.5 110.3L109.8 110.3L106.4 112.8L107.6 116.8L103.8 114.5L100.9 116.8L101.3 112.8L98.6 110.3L102.2 110.3ZM118.2 106.4L119.5 110.3L123.8 110.3L120.4 112.8L121.6 116.8L117.8 114.5L114.9 116.8L115.3 112.8L112.6 110.3L116.2 110.3ZM132.2 106.4L133.5 110.3L137.8 110.3L134.4 112.8L135.6 116.8L131.8 114.5L128.9 116.8L129.3 112.8L126.6 110.3L130.2 110.3Z"
          fill="var(--brand)"
        />
        <path
          {...strokeAttributes}
          d="M76 131Q85.5 130.2,95.0 131Q104.5 131.8,114.0 131Q123.5 130.2,133.0 131Q142.5 131.8,152.0 131Q161.5 130.2,171.0 131Q180.5 131.8,190.0 131"
        />
        <path
          {...strokeAttributes}
          d="M76 142Q86.2 141.2,96.4 142Q106.6 142.8,116.8 142Q127.0 141.2,137.2 142Q147.4 142.8,157.6 142Q167.8 141.2,178.0 142"
        />
        <path
          {...strokeAttributes}
          d="M76 153Q85.5 152.2,95.0 153Q104.5 153.8,114.0 153Q123.5 152.2,133.0 153Q142.5 153.8,152.0 153"
        />
      </g>
      <g>
        <path
          {...strokeAttributes}
          d="M34 45c0 5.0 2.0 7 7 7c-5.0 0-7 2.0-7 7c0-5.0-2.0-7-7-7c5.0 0 7-2.0 7-7z"
        />
        <path
          {...strokeAttributes}
          d="M186 23c0 3.6 1.4 5 5 5c-3.6 0-5 1.4-5 5c0-3.6-1.4-5-5-5c3.6 0 5-1.4 5-5z"
        />
        <path
          {...strokeAttributes}
          d="M300 190c0 4.3 1.7 6 6 6c-4.3 0-6 1.7-6 6c0-4.3-1.7-6-6-6c4.3 0 6-1.7 6-6z"
        />
      </g>
    </svg>
  );
}
