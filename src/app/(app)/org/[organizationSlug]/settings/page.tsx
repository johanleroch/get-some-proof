import { OrganizationSettings } from "@/components/organizations/organization-settings";
import { getPublicEnvironment } from "@/lib/env/public-env";

export default async function OrganizationSettingsPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const environment = getPublicEnvironment();

  return (
    <OrganizationSettings
      embedOrigin={environment.configured ? environment.siteUrl : ""}
      slug={organizationSlug}
    />
  );
}
