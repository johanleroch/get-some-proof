"use client";

import { BlobLoadingText } from "@/components/brand/blob-loader";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconDotsVertical,
  IconLogout,
  IconShieldLock,
  IconUserCircle,
} from "@tabler/icons-react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function NavUser() {
  const user = useQuery(api.auth.getCurrentUser, {});
  const router = useRouter();

  async function signOut() {
    const result = await authClient.signOut();
    if (!result.error) {
      router.replace("/sign-in");
      router.refresh();
    }
  }

  return <NavUserView user={user} signOut={signOut} />;
}

export function NavUserView({
  user,
  signOut,
}: {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  signOut: () => Promise<void>;
}) {
  const { isMobile } = useSidebar();
  const name = user?.name || "Your account";
  const email = user?.email || "";
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              aria-label="Open user menu"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              size="lg"
            >
              <Avatar className="size-8">
                {user?.image ? (
                  <AvatarImage alt={name} src={user.image} />
                ) : null}
                <AvatarFallback className="text-xs font-medium">
                  {initials(name) || "YA"}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {user === undefined ? (
                    <BlobLoadingText
                      label="Loading profile…"
                      className="text-xs"
                    />
                  ) : (
                    email
                  )}
                </span>
              </div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8">
                  {user?.image ? (
                    <AvatarImage alt={name} src={user.image} />
                  ) : null}
                  <AvatarFallback className="text-xs font-medium">
                    {initials(name) || "YA"}
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {user === undefined ? (
                      <BlobLoadingText
                        label="Loading profile…"
                        className="text-xs"
                      />
                    ) : (
                      email
                    )}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href={"/account/profile" as Route}>
                  <IconUserCircle />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={"/account/security" as Route}>
                  <IconShieldLock />
                  Security
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void signOut();
              }}
              variant="destructive"
            >
              <IconLogout />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
