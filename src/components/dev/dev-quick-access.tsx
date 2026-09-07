"use client";

import {
  Component,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { IconDeviceLaptop, IconMoon, IconSun } from "@tabler/icons-react";
import { useConvexAuth, useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { blobToast } from "@/components/brand/blob-toast";
import { Sparkle } from "@/components/doodles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  applyThemePreference,
  readThemePreference,
  themeChangeEvent,
  themeStorageKey,
  type ThemePreference,
} from "@/lib/theme";

type Organization = { name: string; publicSlug: string; slug: string };

type QuickLink = { href: string; label: string };

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(themeChangeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(themeChangeEvent, onStoreChange);
  };
}

function isFramed() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Development-only floating menu with the pages a designer keeps returning
 * to. Hidden in production builds, in visual-evidence captures, and inside
 * the `/screens` gallery frames.
 */
export function DevQuickAccess() {
  const framed = useSyncExternalStore(
    () => () => {},
    isFramed,
    () => true,
  );
  if (framed) return null;
  return (
    <SessionBoundary
      fallback={
        <QuickAccessMenu organization={null} sessionState="signed-out" />
      }
    >
      <QuickAccessWithSession />
    </SessionBoundary>
  );
}

class SessionBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function QuickAccessWithSession() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const organizations = useQuery(
    api.organizations.listMine,
    isAuthenticated ? {} : "skip",
  );
  const first = organizations?.[0];
  const organization = useMemo<Organization | null>(
    () =>
      first
        ? { name: first.name, publicSlug: first.publicSlug, slug: first.slug }
        : null,
    [first],
  );
  const sessionState = isLoading
    ? "loading"
    : isAuthenticated
      ? organization
        ? "ready"
        : organizations === undefined
          ? "loading"
          : "no-brand"
      : "signed-out";
  return (
    <QuickAccessMenu organization={organization} sessionState={sessionState} />
  );
}

function QuickAccessMenu({
  organization,
  sessionState,
}: {
  organization: Organization | null;
  sessionState: "loading" | "no-brand" | "ready" | "signed-out";
}) {
  const [open, setOpen] = useState(false);
  const theme = useSyncExternalStore(
    subscribeToTheme,
    readThemePreference,
    (): ThemePreference => "system",
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ".") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function updateTheme(next: string) {
    const preference =
      next === "light" || next === "dark" ? next : ("system" as const);
    localStorage.setItem(themeStorageKey, preference);
    applyThemePreference(
      document.documentElement,
      preference,
      window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
    );
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  const workspace: QuickLink[] = organization
    ? [
        { href: `/org/${organization.slug}/dashboard`, label: "Overview" },
        { href: `/org/${organization.slug}/inbox`, label: "Inbox" },
        { href: `/org/${organization.slug}/settings`, label: "Brand settings" },
        { href: `/org/${organization.slug}/billing`, label: "Billing" },
        { href: "/account/profile", label: "Profile" },
        { href: "/account/security", label: "Security" },
      ]
    : [];
  const publicPages: QuickLink[] = [
    { href: "/templates", label: "Templates gallery" },
    ...(organization
      ? [
          { href: `/c/${organization.publicSlug}`, label: "Collection Form" },
          { href: `/w/${organization.publicSlug}`, label: "Public Wall" },
          {
            href: `/c/${organization.publicSlug}/privacy`,
            label: "Privacy notice",
          },
        ]
      : []),
  ];
  const auth: QuickLink[] = [
    { href: "/sign-in", label: "Sign in" },
    { href: "/sign-up", label: "Sign up" },
    { href: "/forgot-password", label: "Forgot password" },
    { href: "/onboarding", label: "Onboarding" },
  ];
  const status =
    sessionState === "ready" && organization
      ? `Signed in · ${organization.name}`
      : sessionState === "no-brand"
        ? "Signed in · no Brand yet"
        : sessionState === "loading"
          ? "Checking session…"
          : "Signed out";

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Designer quick access"
          className="bg-ink text-paper shadow-float hover:bg-ink/90 focus-visible:ring-ring data-[state=open]:bg-ink/90 fixed right-4 bottom-4 z-50 grid size-11 cursor-pointer place-items-center rounded-full transition-[background-color,translate] duration-150 outline-none focus-visible:ring-[3px] active:translate-y-px"
          type="button"
        >
          <Sparkle className="text-brand size-6" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-60"
        side="top"
        sideOffset={8}
      >
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Quick access</span>
          <DropdownMenuShortcut>⌘ .</DropdownMenuShortcut>
        </DropdownMenuLabel>
        <p className="text-ink-2 px-2 pb-1.5 text-xs">{status}</p>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Design</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <a href="/kit">Kit</a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/kit/blob">Blob expressions</a>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              blobToast.success("Testimonial published.", {
                description: "A test toast, to check placement on this screen.",
              })
            }
          >
            Test toast
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/kit/templates">Templates</a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/screens">Screens</a>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {workspace.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Workspace</DropdownMenuLabel>
              {workspace.map((link) => (
                <DropdownMenuItem asChild key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Public</DropdownMenuLabel>
          {publicPages.map((link) => (
            <DropdownMenuItem asChild key={link.href}>
              <a href={link.href}>{link.label}</a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Authentication</DropdownMenuLabel>
          {auth.map((link) => (
            <DropdownMenuItem asChild key={link.href}>
              <a href={link.href}>{link.label}</a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup onValueChange={updateTheme} value={theme}>
            <DropdownMenuRadioItem value="light">
              <IconSun aria-hidden="true" />
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <IconMoon aria-hidden="true" />
              Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <IconDeviceLaptop aria-hidden="true" />
              System
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
