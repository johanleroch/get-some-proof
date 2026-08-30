import { OrganizationAudit } from "@/components/audit/organization-audit";

export default async function OrganizationAuditPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;

  return <OrganizationAudit slug={organizationSlug} />;
}
