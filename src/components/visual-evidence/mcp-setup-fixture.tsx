"use client";
import { useState } from "react";
import { McpSetupView } from "@/components/mcp/mcp-setup";

export function McpSetupFixture({ paid = true }: { paid?: boolean }) {
  const [activated, setActivated] = useState(false);
  return (
    <main className="bg-paper text-ink min-h-svh p-5 md:p-8">
      <McpSetupView
        paid={paid}
        activated={activated}
        onActivate={async () => setActivated(true)}
      />
    </main>
  );
}
export function McpFreeSetupFixture() {
  return <McpSetupFixture paid={false} />;
}
