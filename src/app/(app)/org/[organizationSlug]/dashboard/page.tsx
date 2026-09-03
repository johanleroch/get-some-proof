import { OrganizationDashboard } from "@/components/organizations/organization-dashboard";

export default async function OrganizationDashboardPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;

  return <OrganizationDashboard slug={organizationSlug} />;
}
