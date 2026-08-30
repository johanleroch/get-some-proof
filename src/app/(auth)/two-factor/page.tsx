import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TwoFactorChallenge } from "@/components/auth/two-factor-challenge";

export default function TwoFactorPage() {
  return (
    <>
      <CardHeader>
        <CardTitle className="text-2xl">Two-factor verification</CardTitle>
        <CardDescription>
          Enter a current authenticator code or a one-time recovery code.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TwoFactorChallenge />
      </CardContent>
    </>
  );
}
