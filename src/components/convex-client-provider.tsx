"use client";

import { type ReactNode, useState } from "react";
import {
  ConvexBetterAuthProvider,
  type AuthClient as ConvexBetterAuthClient,
} from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";

import { authClient } from "@/lib/auth-client";

export function ConvexClientProvider({
  children,
  url,
}: {
  children: ReactNode;
  url: string;
}) {
  const [client] = useState(() => new ConvexReactClient(url));

  return (
    <ConvexBetterAuthProvider
      // The 0.12.5 provider declaration narrows Better Auth 1.6 session data to
      // `never`; both packages share the same runtime client contract.
      authClient={authClient as unknown as ConvexBetterAuthClient}
      client={client}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
}
