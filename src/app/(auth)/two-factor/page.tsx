import { TwoFactorChallenge } from "@/components/auth/two-factor-challenge";
import { AuthHeading } from "@/components/auth/auth-heading";

export default function TwoFactorPage() {
  return (
    <>
      <AuthHeading
        description="Enter a current authenticator code or a one-time recovery code."
        title="Two-factor verification"
      />
      <TwoFactorChallenge />
    </>
  );
}
