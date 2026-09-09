import { SignUpForm } from "@/components/auth/sign-up-form";
import { safeInternalRoute } from "@/lib/safe-route";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const { callbackURL } = await searchParams;
  const destination = safeInternalRoute(callbackURL ?? null, "/dashboard");

  return <SignUpForm callbackURL={destination} />;
}
