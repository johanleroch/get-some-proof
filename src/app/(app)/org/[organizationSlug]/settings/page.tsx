import { OrganizationSettings } from "@/components/organizations/organization-settings";

export default async function OrganizationSettingsPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;

  return <OrganizationSettings slug={organizationSlug} />;
}
