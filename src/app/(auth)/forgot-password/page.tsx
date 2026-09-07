import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AuthHeading } from "@/components/auth/auth-heading";

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading
        description="We will send a secure link if the address matches an account."
        title="Reset your password"
      />
      <ForgotPasswordForm />
    </>
  );
}
