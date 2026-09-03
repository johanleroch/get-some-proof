import { OrganizationMembers } from "@/components/members/organization-members";

export default async function OrganizationMembersPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;

  return <OrganizationMembers slug={organizationSlug} />;
}
