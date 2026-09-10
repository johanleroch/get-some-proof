import { McpSetup } from "@/components/mcp/mcp-setup";

export default async function McpSetupPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin)
    return (
      <p className="type-body">
        Import settings are unavailable. Try again later.
      </p>
    );
  return <McpSetup slug={organizationSlug} origin={origin} />;
}
