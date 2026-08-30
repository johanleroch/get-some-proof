import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { ConvexClientProvider } from "@/components/convex-client-provider";
import { getPublicEnvironment } from "@/lib/env/public-env";

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
    default: "Convex Admin Starter",
    template: "%s · Convex Admin Starter",
  },
  description:
    "A production-oriented multi-tenant administration starter built with Next.js and Convex.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const environment = getPublicEnvironment();

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {environment.configured ? (
          <ConvexClientProvider url={environment.convexUrl}>
            {children}
          </ConvexClientProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
