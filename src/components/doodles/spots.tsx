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
 * with `--surface` so they overlap cleanly; stars and sparkles are amber.
 */
export function WallFrames(props: DoodleProps) {
  return (
    <svg {...doodleProps(props, "0 0 320 220")}>
      <g transform="rotate(-6 72 158)">
        <path
          {...strokeAttributes}
          d="M34 122C56.4 121.7,86.7 121.4,110 122Q118 122,118 130C118.3 145.8,117.2 169.5,118 186Q118 194,110 194C86.7 194.1,56.4 193.8,34 194Q26 194,26 186C25.2 169.5,26.0 145.8,26 130Q26 122,34 122Z"
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
          d="M219 32C241.7 31.2,273.4 31.9,297 32Q306 32,306 41C305.2 75.6,305.3 119.1,306 155Q306 164,297 164C273.4 163.9,241.7 164.6,219 164Q210 164,210 155C209.3 119.1,209.5 75.6,210 41Q210 32,219 32Z"
          fill="var(--surface)"
        />
        <path
          {...strokeAttributes}
          d="M273 88C273.09 96.28,266.28 103.31,258 103C249.72 103.05,242.93 96.28,243 88C243.33 79.72,249.72 72.68,258 73C266.28 73.25,272.85 79.72,273 88Z"
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
          d="M61 62C103.5 61.4,155.0 61.3,199 62Q208 62,208 71C207.7 100.9,208.6 139.9,208 171Q208 180,199 180C155.0 179.4,103.5 180.1,61 180Q52 180,52 171C52.3 139.9,51.8 100.9,52 71Q52 62,61 62Z"
          fill="var(--surface)"
        />
        <path
          {...strokeAttributes}
          d="M87 88C87.03 94.07,82.07 98.69,76 99C69.93 98.69,64.79 94.07,65 88C65.13 81.93,69.93 76.95,76 77C82.07 76.87,87.06 81.93,87 88Z"
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
          fill="var(--brand)"
        />
        <path
          {...strokeAttributes}
          d="M186 23c0 3.6 1.4 5 5 5c-3.6 0-5 1.4-5 5c0-3.6-1.4-5-5-5c3.6 0 5-1.4 5-5z"
          fill="var(--brand)"
        />
        <path
          {...strokeAttributes}
          d="M300 190c0 4.3 1.7 6 6 6c-4.3 0-6 1.7-6 6c0-4.3-1.7-6-6-6c4.3 0 6-1.7 6-6z"
          fill="var(--brand)"
        />
      </g>
    </svg>
  );
}
