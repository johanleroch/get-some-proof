/*
Brand marks are the trademarks of their owners. They appear here for one
purpose only: naming the platform a testimonial was written on.

Every outline is the brand's own mark, never a redraw. Six come from Simple
Icons 16.30.0 (CC0 1.0), each traced from the brand's own resource page.
Instagram is their camera glyph carrying their own two radial gradients,
remapped onto this grid; Facebook is the f alone, lifted from the artwork of
their 2019 mark where it is already drawn as its own contour.
LinkedIn left that set in 14.0.0 at LinkedIn's request, so its bug is the
13.21.0 file, to be swapped for the download from brand.linkedin.com. The
Google G is the official multicolour mark:
https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg
Reddit and Product Hunt hold the mark without its container: the contours of
the official artwork, minus the bubble and the disc, holes cut by evenodd.
GitHub publishes no such version - its mark is the cat in negative space - so
the badge masks GitHub's own mark with the disc it is drawn in, which leaves
that exact cat and nothing else. That circle is r=10.6 because Octicons draws
its disc at r=11 centred on 12,12, and the tenth of a unit keeps the rim's
antialiasing out: swapping that artwork means measuring its disc again. Both read as the mark itself, never a redraw.

The one deliberate deviation: X draws a thin mark that goes weightless beside
ten solid ones, so its official outline is stroked wider - 0.7 in the file's
own units, which its fit then scales to about half a unit of the 24 box. Past
that the slivers between the arms close up and the X turns into a blob.

Marks are drawn as fills on a 24x24 grid, so the family carries one optical
weight at the 20px the wall ships.

Each mark keeps the artwork it was published with and is placed by its own
`fit`: the brands crop and centre their files differently, and Facebook's f
even arrives sitting where the disc had put it. Every fit was computed from
the mark's measured visual bounds - stroke and mask included - onto one
keyline grid: 20 of live area in the 24 box, squares at 18 because a square
reads larger than a circle at the same measure, bare letterforms at 18.5
because past that an f or a P towers over the enclosed marks, and the centre
of the shape on the centre of the box. Re-measure before changing one.
*/
export const sourceIcons = {
  google: {
    color: "#4285f4",
    fit: "translate(1.32 1.116) scale(0.907)",
    label: "Google",
    markup:
      '<g stroke="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></g>',
  },
  trustpilot: {
    color: "#00b67a",
    fit: "translate(1.984 1.984) scale(0.8346)",
    label: "Trustpilot",
    markup:
      '<path d="M17.227 16.67l2.19 6.742-7.413-5.388 5.223-1.354zM24 9.31h-9.165L12.005.589l-2.84 8.723L0 9.3l7.422 5.397-2.84 8.714 7.422-5.388 4.583-3.326L24 9.311z"/>',
  },
  x: {
    color: "#000000",
    fit: "translate(3.352 3.332) scale(0.7223)",
    label: "X",
    markup:
      '<path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" stroke="currentColor" stroke-width="0.7" stroke-linejoin="miter" stroke-linecap="butt"/>',
  },
  linkedin: {
    color: "#0a66c2",
    fit: "translate(3.028 3.028) scale(0.7477)",
    label: "LinkedIn",
    markup:
      '<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>',
  },
  facebook: {
    color: "#0866ff",
    fit: "translate(0.339 -1.732) scale(0.9561)",
    label: "Facebook",
    markup:
      '<g transform="scale(0.00168753)"><path d="M9879 9167l315 -2056 -1972 0 0 -1334c0,-562 275,-1111 1159,-1111l897 0 0 -1750c0,0 -814,-139 -1592,-139 -1624,0 -2686,984 -2686,2767l0 1567 -1806 0 0 2056 1806 0 0 4969c362,57 733,86 1111,86 378,0 749,-30 1111,-86l0 -4969 1657 0z"/></g>',
  },
  instagram: {
    color: "#ff0069",
    fit: "translate(3.028 3.028) scale(0.7477)",
    label: "Instagram",
    markup:
      '<defs><radialGradient id="gsp-src-ig-warm" cx="158.429" cy="578.088" r="65" fx="158.429" fy="578.088" gradientUnits="userSpaceOnUse" gradientTransform="matrix(0.000000 -0.360349 0.335244 0.000000 -187.521954 82.543680)"><stop offset="0" stop-color="#fd5"/><stop offset=".1" stop-color="#fd5"/><stop offset=".5" stop-color="#ff543e"/><stop offset="1" stop-color="#c837ab"/></radialGradient><radialGradient id="gsp-src-ig-blue" cx="147.694" cy="473.455" r="65" fx="147.694" fy="473.455" gradientUnits="userSpaceOnUse" gradientTransform="matrix(0.031624 0.157944 -0.651217 0.130392 299.690555 -83.359838)"><stop offset="0" stop-color="#3771c8"/><stop offset=".128" stop-color="#3771c8"/><stop offset="1" stop-color="#60f" stop-opacity="0"/></radialGradient><path id="gsp-src-ig-glyph" d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/></defs><use href="#gsp-src-ig-glyph" xlink:href="#gsp-src-ig-glyph" fill="url(#gsp-src-ig-warm)"/><use href="#gsp-src-ig-glyph" xlink:href="#gsp-src-ig-glyph" fill="url(#gsp-src-ig-blue)"/>',
  },
  youtube: {
    color: "#ff0000",
    fit: "translate(2.031 2.031) scale(0.8307)",
    label: "YouTube",
    markup:
      '<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>',
  },
  reddit: {
    color: "#ff4500",
    fit: "translate(-0.476 -0.066) scale(1.0396)",
    label: "Reddit",
    markup:
      '<path fill-rule="evenodd" d="M 16.388 3.199 c 1.104 0.0 1.999 0.895 1.999 1.999 c 0.0 1.105 -0.895 2.0 -1.999 2.0 c -0.946 0.0 -1.739 -0.657 -1.947 -1.539 v 0.002 c -1.147 0.162 -2.032 1.15 -2.032 2.341 v 0.007 c 1.776 0.067 3.4 0.567 4.686 1.363 c 0.473 -0.363 1.064 -0.58 1.707 -0.58 c 1.547 0.0 2.802 1.254 2.802 2.802 c 0.0 1.117 -0.655 2.081 -1.601 2.531 c -0.088 3.256 -3.637 5.876 -7.997 5.876 c -4.361 0.0 -7.905 -2.617 -7.998 -5.87 c -0.954 -0.447 -1.614 -1.415 -1.614 -2.538 c 0.0 -1.548 1.255 -2.802 2.803 -2.802 c 0.645 0.0 1.239 0.218 1.712 0.585 c 1.275 -0.79 2.881 -1.291 4.64 -1.365 v -0.01 c 0.0 -1.663 1.263 -3.034 2.88 -3.207 c 0.188 -0.911 0.993 -1.595 1.959 -1.595 z M 8.303 11.575 c -0.784 0.0 -1.459 0.78 -1.506 1.797 c -0.047 1.016 0.64 1.429 1.426 1.429 c 0.786 0.0 1.371 -0.369 1.418 -1.385 c 0.047 -1.017 -0.553 -1.841 -1.338 -1.841 z M 15.709 11.575 c -0.786 0.0 -1.385 0.824 -1.338 1.841 c 0.047 1.017 0.634 1.385 1.418 1.385 c 0.785 0.0 1.473 -0.413 1.426 -1.429 c -0.046 -1.017 -0.721 -1.797 -1.506 -1.797 z M 12.006 15.588 c -0.974 0.0 -1.907 0.048 -2.77 0.135 c -0.147 0.015 -0.241 0.168 -0.183 0.305 c 0.483 1.154 1.622 1.964 2.953 1.964 c 1.33 0.0 2.47 -0.81 2.953 -1.964 c 0.057 -0.137 -0.037 -0.29 -0.184 -0.305 c -0.863 -0.087 -1.795 -0.135 -2.769 -0.135 z"/>',
  },
  producthunt: {
    color: "#da552f",
    fit: "translate(-7.696 -6.442) scale(1.5369)",
    label: "Product Hunt",
    markup:
      '<path fill-rule="evenodd" d="M 13.604 14.4 h -3.405 V 18.0 H 7.801 V 6.0 h 5.804 c 2.319 0.0 4.2 1.88 4.2 4.199 c 0.0 2.321 -1.881 4.201 -4.201 4.201 z M 13.604 8.4 h -3.405 V 12.0 h 3.405 c 0.995 0.0 1.801 -0.806 1.801 -1.801 c 0.0 -0.993 -0.805 -1.799 -1.801 -1.799 z"/>',
  },
  github: {
    color: "#181717",
    fit: "translate(-1.443 -4.469) scale(1.1696)",
    label: "GitHub",
    markup:
      '<defs><mask id="gsp-src-gh" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="#fff"/><path d="M12 1C5.9225 1 1 5.9225 1 12C1 16.8675 4.14875 20.9787 8.52125 22.4362C9.07125 22.5325 9.2775 22.2025 9.2775 21.9137C9.2775 21.6525 9.26375 20.7862 9.26375 19.865C6.5 20.3737 5.785 19.1912 5.565 18.5725C5.44125 18.2562 4.905 17.28 4.4375 17.0187C4.0525 16.8125 3.5025 16.3037 4.42375 16.29C5.29 16.2762 5.90875 17.0875 6.115 17.4175C7.105 19.0812 8.68625 18.6137 9.31875 18.325C9.415 17.61 9.70375 17.1287 10.02 16.8537C7.5725 16.5787 5.015 15.63 5.015 11.4225C5.015 10.2262 5.44125 9.23625 6.1425 8.46625C6.0325 8.19125 5.6475 7.06375 6.2525 5.55125C6.2525 5.55125 7.17375 5.2625 9.2775 6.67875C10.1575 6.43125 11.0925 6.3075 12.0275 6.3075C12.9625 6.3075 13.8975 6.43125 14.7775 6.67875C16.8813 5.24875 17.8025 5.55125 17.8025 5.55125C18.4075 7.06375 18.0225 8.19125 17.9125 8.46625C18.6138 9.23625 19.04 10.2125 19.04 11.4225C19.04 15.6437 16.4688 16.5787 14.0213 16.8537C14.42 17.1975 14.7638 17.8575 14.7638 18.8887C14.7638 20.36 14.75 21.5425 14.75 21.9137C14.75 22.2025 14.9563 22.5462 15.5063 22.4362C19.8513 20.9787 23 16.8537 23 12C23 5.9225 18.0775 1 12 1Z" fill="#000"/></mask></defs><circle cx="12" cy="12" r="10.6" mask="url(#gsp-src-gh)"/>',
  },
  tiktok: {
    color: "#000000",
    fit: "translate(2.031 2.031) scale(0.8307)",
    label: "TikTok",
    markup:
      '<path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>',
  },
} as const;

export type SourcePlatform = keyof typeof sourceIcons;

/**
 * The one badge glyph. The wall, the embed and the kit all read it from here so
 * a mark can never differ between what we review and what a visitor sees.
 * The white chip keeps every brand colour legible on a photo or a dark wall.
 */
export function sourceIconSvg(
  platform: SourcePlatform,
  {
    chip = true,
    key,
    size = 20,
  }: { chip?: boolean; key?: string; size?: number } = {},
) {
  const { color, fit, markup } = sourceIcons[platform];
  // Instagram's gradients and GitHub's mask are reached by id, and this markup
  // is injected into pages we do not own: two cards from the same platform
  // would put the same id twice, where url(#id) takes whichever came first.
  // The caller passes something stable - a testimonial id - so the badge keeps
  // one drawing per card and the same bytes on every render.
  const drawing = key
    ? markup.replaceAll(
        "gsp-src-",
        `gsp-src-${key.replace(/[^A-Za-z0-9_-]/g, "")}-`,
      )
    : markup;
  // The chip is a 3px surround at the 20px the wall ships, and stays that
  // surround at any other size the kit asks for.
  const chipStyle = chip
    ? `;background:white;border-radius:${(size / 20) * 4}px;padding:${(size / 20) * 3}px;box-sizing:content-box`
    : "";
  return `<svg aria-hidden="true" style="color:${color}${chipStyle}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><g transform="${fit}">${drawing}</g></svg>`;
}
