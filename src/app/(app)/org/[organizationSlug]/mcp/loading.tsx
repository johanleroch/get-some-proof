"use client";

import { useParams } from "next/navigation";
import { McpSetupView } from "@/components/mcp/mcp-setup";

export default function McpSetupLoading() {
  const { organizationSlug } = useParams<{ organizationSlug: string }>();
  return (
    <McpSetupView
      backHref={`/org/${organizationSlug}/import`}
      origin={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
      loading
      paid={false}
      activated={false}
      onActivate={async () => {}}
    />
  );
}
