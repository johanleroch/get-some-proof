import { redirect } from "next/navigation";

export default async function OrganizationAuditPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  redirect(`/org/${organizationSlug}/dashboard`);
}
