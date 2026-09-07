import type { ReactNode } from "react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { productDescription, productName } from "@/lib/brand";

/**
 * Header and footer of our own public pages (the templates gallery): the
 * mark and the name on the left, sign in and one primary action on the
 * right. Customer surfaces (Collection Form, Wall) never use this chrome.
 */
export function PublicSiteHeader({ action }: { action?: ReactNode }) {
  return (
    <header className="bg-paper/85 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-5 sm:px-8">
        <Link
          className="focus-visible:ring-ring flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px]"
          href="/"
        >
          <BrandLogo />
        </Link>
        <nav aria-label="Account" className="flex items-center gap-2">
          <Button
            asChild
            className="hidden sm:inline-flex"
            size="sm"
            variant="ghost"
          >
            <Link href="/sign-in">Sign in</Link>
          </Button>
          {action ?? (
            <Button asChild size="sm">
              <Link href="/sign-up">Get started free</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

export function PublicSiteFooter() {
  const links = [
    { href: "/templates", label: "Templates" },
    { href: "/sign-in", label: "Sign in" },
    { href: "/sign-up", label: "Sign up" },
  ] as const;
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-8 sm:px-8">
        <p className="type-small text-ink-2">
          {productName}. {productDescription}
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          {links.map((link) => (
            <Link
              className="type-small text-ink-2 hover:text-ink focus-visible:ring-ring rounded-sm outline-none focus-visible:ring-[3px]"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
