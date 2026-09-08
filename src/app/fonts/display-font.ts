import localFont from "next/font/local";

/**
 * Gelica, the display face (DESIGN.md section 3), self-hosted from this
 * folder so every environment renders it: the site is built from this
 * repository, so a font kept out of it simply does not exist in production.
 * The files are the licensed OTFs converted to WOFF2, which is lossless (479
 * glyphs, 380 mapped characters, unchanged) and takes the five weights from
 * 704 KB to 256 KB.
 */
export const displayFont = localFont({
  display: "swap",
  src: [
    { path: "./gelica/Gelica-Regular.woff2", style: "normal", weight: "400" },
    { path: "./gelica/Gelica-Medium.woff2", style: "normal", weight: "500" },
    { path: "./gelica/Gelica-SemiBold.woff2", style: "normal", weight: "600" },
    { path: "./gelica/Gelica-Bold.woff2", style: "normal", weight: "700" },
    { path: "./gelica/Gelica-Black.woff2", style: "normal", weight: "900" },
  ],
  variable: "--font-gelica",
});
