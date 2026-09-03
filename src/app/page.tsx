import { redirect } from "next/navigation";

import { SetupRequired } from "@/components/setup-required";
import { isAuthenticated } from "@/lib/auth-server";
import { getPublicEnvironment } from "@/lib/env/public-env";

export default async function HomePage() {
  const environment = getPublicEnvironment();

  if (!environment.configured) {
    return <SetupRequired missing={environment.missing} />;
  }

  redirect((await isAuthenticated()) ? "/dashboard" : "/sign-in");
}
