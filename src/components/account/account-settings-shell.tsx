"use client";

import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconArrowLeft, IconLock, IconUserCircle } from "@tabler/icons-react";

import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { productName } from "@/lib/brand";
import { cn } from "@/lib/utils";

const accountNavigation = [
  {
    href: "/account/profile" as Route,
    icon: IconUserCircle,
    label: "Profile",
  },
  {
    href: "/account/security" as Route,
    icon: IconLock,
    label: "Security",
  },
];

export function AccountSettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="bg-background min-h-svh">
      <header className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-20 flex h-12 items-center border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 lg:px-6">
          <Button asChild className="-ml-2" size="icon" variant="ghost">
            <Link aria-label="Back to dashboard" href={"/dashboard" as Route}>
              <IconArrowLeft />
            </Link>
          </Button>
          <Separator className="h-4" orientation="vertical" />
          <BrandMark className="size-7 rounded-md" />
          <span className="text-sm font-medium">{productName}</span>
          <span className="text-muted-foreground text-sm">/ Account</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-6 lg:py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your personal profile and sign-in security.
          </p>
        </div>
        <Separator className="my-6" />
        <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <nav
            aria-label="Account settings"
            className="flex gap-2 overflow-x-auto lg:flex-col"
          >
            {accountNavigation.map(({ href, icon: Icon, label }) => {
              const active = pathname === href;
              return (
                <Button
                  asChild
                  className={cn(
                    "justify-start",
                    !active && "text-muted-foreground",
                  )}
                  key={href}
                  variant={active ? "secondary" : "ghost"}
                >
                  <Link aria-current={active ? "page" : undefined} href={href}>
                    <Icon />
                    {label}
                  </Link>
                </Button>
              );
            })}
          </nav>
          <div className="min-w-0">{children}</div>
        </div>
      </main>
    </div>
  );
}
