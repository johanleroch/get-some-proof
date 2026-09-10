import { AuthShell } from "@/components/auth/auth-shell";
import { ImportAuthorization } from "@/components/chatgpt/import-authorization";
import { authorizationQuery } from "@/lib/chatgpt/authorization-query";

export const metadata = {
  title: "Connect your account | Get Some Proof",
  robots: { index: false, follow: false },
};

export default async function AuthorizeImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = authorizationQuery(await searchParams);
  return (
    <AuthShell>
      <ImportAuthorization key={query} oauthQuery={query} />
    </AuthShell>
  );
}
