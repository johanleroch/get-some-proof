"use client";

import { type ReactNode, useState } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

export function ConvexClientProvider({
  children,
  url,
}: {
  children: ReactNode;
  url: string;
}) {
  const [client] = useState(() => new ConvexReactClient(url));

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
