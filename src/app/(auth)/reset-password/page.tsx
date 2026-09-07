import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthHeading } from "@/components/auth/auth-heading";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <>
      <AuthHeading
        description="Updating your password will revoke your existing sessions."
        title="Choose a new password"
      />
      <ResetPasswordForm token={token} />
    </>
  );
}
