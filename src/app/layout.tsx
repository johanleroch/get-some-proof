import type { Metadata } from "next";
import {
  Bricolage_Grotesque,
  Caveat,
  DM_Sans,
  Geist_Mono,
} from "next/font/google";
import type { ReactNode } from "react";

import { ConvexClientProvider } from "@/components/convex-client-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { productDescription, productName } from "@/lib/brand";
import { getPublicEnvironment } from "@/lib/env/public-env";
import { themeInitializationScript } from "@/lib/theme";

import "./globals.css";

// Typography per DESIGN.md: DM Sans for body and UI, Bricolage Grotesque for
// display, Caveat only for hand-drawn annotations, Geist Mono for code.
const dmSans = DM_Sans({
  axes: ["opsz"],
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const bricolage = Bricolage_Grotesque({
  axes: ["opsz"],
  subsets: ["latin"],
  variable: "--font-bricolage",
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

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitializationScript }}
        />
      </head>
      <body
        className={`${dmSans.variable} ${bricolage.variable} ${caveat.variable} ${geistMono.variable}`}
      >
        <TooltipProvider>
          {environment.configured ? (
            <ConvexClientProvider url={environment.convexUrl}>
              {children}
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
