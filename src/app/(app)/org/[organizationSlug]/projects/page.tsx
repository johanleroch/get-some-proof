import { OrganizationProjects } from "@/components/projects/organization-projects";

export default async function OrganizationProjectsPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;

  return <OrganizationProjects slug={organizationSlug} />;
}
