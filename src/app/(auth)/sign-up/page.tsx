import { SignUpForm } from "@/components/auth/sign-up-form";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>
          Verify your email before creating or joining an Organization.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm callbackURL={destination} />
      </CardContent>
    </>
  );
}
