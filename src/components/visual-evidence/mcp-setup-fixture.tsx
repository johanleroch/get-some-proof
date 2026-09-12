"use client";
import { useState } from "react";
import { McpSetupView } from "@/components/mcp/mcp-setup";

export function McpSetupFixture({
  paid = true,
  connected = false,
}: {
  paid?: boolean;
  connected?: boolean;
}) {
  const [connections, setConnections] = useState<
    { clientId: string; name: string }[]
  >(
    connected
      ? [
          { clientId: "fixture-claude", name: "Claude Code" },
          { clientId: "fixture-codex", name: "Codex CLI" },
        ]
      : [],
  );
  const [activated, setActivated] = useState(connected);
  return (
    <main className="bg-paper text-ink min-h-svh p-5 md:p-8">
      <McpSetupView
        origin="https://getsomeproof.com"
        connections={connections}
        onRevoke={async (clientId) =>
          setConnections((current) =>
            current.filter((item) => item.clientId !== clientId),
          )
        }
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

export function McpConnectedSetupFixture() {
  return <McpSetupFixture connected />;
}
