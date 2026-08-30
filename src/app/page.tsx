import { AppShell } from "@/components/app-shell";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { SetupRequired } from "@/components/setup-required";
import { getPublicEnvironment } from "@/lib/env/public-env";

export default function HomePage() {
  const environment = getPublicEnvironment();

  if (!environment.configured) {
    return <SetupRequired missing={environment.missing} />;
  }

  return (
    <ConvexClientProvider url={environment.convexUrl}>
      <AppShell />
    </ConvexClientProvider>
  );
}
