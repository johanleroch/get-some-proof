import { SignUpForm } from "@/components/auth/sign-up-form";
import { AuthHeading } from "@/components/auth/auth-heading";
import { safeInternalRoute } from "@/lib/safe-route";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackURL?: string }>;
}) {
  const { callbackURL } = await searchParams;
  const destination = safeInternalRoute(callbackURL ?? null, "/dashboard");

  return (
    <>
      <AuthHeading
        description="Verify your email before creating your Brand."
        title="Create your account"
      />
      <SignUpForm callbackURL={destination} />
    </>
  );
}
