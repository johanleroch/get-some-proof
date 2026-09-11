import { Studio } from "@/components/studio/studio";
export default async function StudioPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  return <Studio slug={organizationSlug} />;
}
