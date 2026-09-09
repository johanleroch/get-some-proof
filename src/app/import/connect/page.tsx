import { AuthShell } from "@/components/auth/auth-shell";
import { ImportAuthorization } from "@/components/chatgpt/import-authorization";
import { authorizationQuery } from "@/lib/chatgpt/authorization-query";

export const metadata = {
  title: "Sign in to connect | Get Some Proof",
  robots: { index: false, follow: false },
};

export default async function ConnectImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = authorizationQuery(await searchParams);
  return (
    <AuthShell>
      <ImportAuthorization signInRequired key={query} oauthQuery={query} />
    </AuthShell>
  );
}
