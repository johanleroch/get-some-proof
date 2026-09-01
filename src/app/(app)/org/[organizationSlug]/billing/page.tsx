import { OrganizationBilling } from "@/components/billing/organization-billing";

export default async function OrganizationBillingPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;

  return <OrganizationBilling slug={organizationSlug} />;
}
