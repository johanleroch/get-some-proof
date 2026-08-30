import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth-server";

export default async function ApplicationLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await isAuthenticated())) {
    redirect("/sign-in?callbackURL=/dashboard");
  }

  return children;
}
