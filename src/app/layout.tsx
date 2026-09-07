import type { Metadata } from "next";
import { Caveat, Figtree, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { ConvexClientProvider } from "@/components/convex-client-provider";
import { DevQuickAccess } from "@/components/dev/dev-quick-access";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { productDescription, productName } from "@/lib/brand";
import { getPublicEnvironment } from "@/lib/env/public-env";
import { themeInitializationScript } from "@/lib/theme";

import { displayFont } from "./fonts/display-font";

import "./globals.css";

// Typography per DESIGN.md: Gelica for display (licensed, self-hosted from
// src/app/fonts/gelica and kept out of git, loaded through the module that
// scripts/ensure-display-font.mjs generates: see DESIGN.md section 3),
// Figtree for body and UI, Caveat only for hand-drawn annotations, Geist Mono
// for code.
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: productName,
    template: `%s · ${productName}`,
  },
  description: productDescription,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const environment = getPublicEnvironment();
  // Designer quick access: development only, never in visual-evidence captures.
  const showDevTools =
    process.env.NODE_ENV !== "production" &&
    process.env.VISUAL_EVIDENCE_MODE !== "true";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitializationScript }}
        />
      </head>
      <body
        className={`${displayFont.variable} ${figtree.variable} ${caveat.variable} ${geistMono.variable}`}
      >
        <TooltipProvider>
          {environment.configured ? (
            <ConvexClientProvider url={environment.convexUrl}>
              {children}
              {showDevTools ? <DevQuickAccess /> : null}
            </ConvexClientProvider>
          ) : (
            children
          )}
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
