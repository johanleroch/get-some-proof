import { McpSetup } from "@/components/mcp/mcp-setup";

export default async function McpSetupPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  return <McpSetup slug={organizationSlug} />;
}
