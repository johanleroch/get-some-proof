import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignInForm } from "@/components/auth/sign-in-form";
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
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>
          Sign in to continue to your proof dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm callbackURL={destination} />
      </CardContent>
    </>
  );
}
