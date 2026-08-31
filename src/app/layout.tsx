import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { ConvexClientProvider } from "@/components/convex-client-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { productDescription, productName } from "@/lib/brand";
import { getPublicEnvironment } from "@/lib/env/public-env";
import { themeInitializationScript } from "@/lib/theme";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <TooltipProvider>
          {environment.configured ? (
            <ConvexClientProvider url={environment.convexUrl}>
              {children}
            </ConvexClientProvider>
          ) : (
            children
          )}
        </TooltipProvider>
      </body>
    </html>
  );
}
