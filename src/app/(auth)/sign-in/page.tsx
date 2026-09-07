import { SignInForm } from "@/components/auth/sign-in-form";
import { AuthHeading } from "@/components/auth/auth-heading";
import { safeInternalRoute } from "@/lib/safe-route";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const { callbackURL } = await searchParams;
  const destination = safeInternalRoute(callbackURL ?? null, "/dashboard");

  return (
    <>
      <AuthHeading
        description="Sign in to continue to your proof dashboard."
        title="Welcome back"
      />
      <SignInForm callbackURL={destination} />
    </>
  );
}
