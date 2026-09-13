import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";

import { BrandLogo } from "@/components/brand-logo";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { productDescription, productName } from "@/lib/brand";

/**
 * Header and footer of our own public pages (the landing page, the templates
 * gallery): the mark and the name on the left, the page's own destinations in
 * the middle from `md`, sign in and the one primary action on the right. The
 * primary action says "Start for free" everywhere it appears (issue #181).
 * Customer surfaces (Collection Form, Wall) never use this chrome.
 */
export function PublicSiteHeader({
  action,
  links,
}: {
  action?: ReactNode;
  /** In-page or cross-page destinations, shown from `md` only. */
  links?: ReadonlyArray<{ href: Route; label: string }>;
}) {
  return (
    <header className="bg-paper/85 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-5 sm:px-8">
        <Link
          className="focus-visible:ring-ring flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px]"
          href="/"
        >
          {/* Below `sm` the wordmark would leave no room for both actions at
              320px, so the mark stands alone and names the link itself. */}
          <BrandLogo className="hidden sm:inline-flex" />
          <BrandMark className="sm:hidden" />
          <span className="sr-only sm:hidden">{productName}</span>
        </Link>
        {links?.length ? (
          <nav
            aria-label="Sections"
            className="hidden items-center gap-1 md:flex"
          >
            {links.map((link) => (
              <Link
                className="type-ui text-ink-2 hover:text-ink hover:bg-surface-2 focus-visible:ring-ring inline-flex h-10 items-center rounded-md px-3 transition-[color,background-color] duration-150 ease-[var(--ease-out-soft)] outline-none focus-visible:ring-[3px] motion-reduce:transition-none"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}
        <nav aria-label="Account" className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          {action ?? (
            <Button asChild>
              <Link href="/sign-up">Start for free</Link>
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
